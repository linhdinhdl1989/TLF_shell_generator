"""
SAP Extraction Service - finds candidate TLF entries from parsed SAP content.
Separate from normalization/composition (that's tlf_title_normalizer.py).
"""
import re
from typing import List, Dict, Any, Optional

# TLF number patterns in SAP
TLF_NUMBER_PATTERNS = [
    r'\b(Table|Listing|Figure)\s+(1[456]\.\d+(?:\.\d+)*)',
    r'\b(1[456]\.\d+(?:\.\d+)*)\b',
]

# Section/domain keyword mappings
SECTION_KEYWORDS = {
    "demographics": ["demographic", "baseline", "medical history", "concomitant medication", "prior medication", "disposition", "exposure"],
    "efficacy": ["efficacy", "endpoint", "response", "kaplan", "survival", "time to event", "responder"],
    "safety": ["adverse event", "adverse events", "ae ", "aes ", "laboratory", "lab parameter", "vital sign", "discontinuation", "death", "serious adverse"],
    "pharmacokinetics": ["pharmacokinetic", "pk ", "concentration", "auc", "cmax"],
}

# Grouping/subtitle context phrases
GROUPING_PATTERNS = [
    r'(?:summaries?\s+will\s+be|presented|tabulated|summarized)\s+by\s+(\w[\w\s]+?)(?:\.|,|and|$)',
    r'(?:stratified|split|grouped|broken down)\s+by\s+(\w[\w\s]+?)(?:\.|,|and|$)',
    r'by\s+(treatment\s+(?:group|arm|period)|visit|time point|age group|sex|region)',
]

# Analysis set context phrases
ANALYSIS_SET_PATTERNS = [
    r'(?:safety|efficacy|per.protocol|intent.to.treat|full analysis|modified itt|mitt|fas|ias|pp|itt)\s*(?:population|set|analysis set|subjects)',
    r'(?:all|treated)\s+(?:randomized|randomised|patients|subjects)',
]

def extract_tlf_candidates_from_sap(parsed_content: str) -> List[Dict[str, Any]]:
    """
    Extract candidate TLF entries from parsed SAP content.
    Returns list of evidence objects - does NOT do final normalization.
    """
    if not parsed_content:
        return []

    lines = parsed_content.split('\n')
    candidates = []
    seen_numbers = set()

    # Find global context clues (analysis set, grouping)
    global_context = _extract_global_context(parsed_content)

    for i, line in enumerate(lines):
        line_stripped = line.strip()
        if not line_stripped:
            continue

        # Try to find TLF number in line
        number, output_type = _extract_number_and_type(line_stripped)
        if not number or number in seen_numbers:
            continue
        seen_numbers.add(number)

        # Extract raw title text (text after the number on the same line)
        raw_title = _extract_raw_title(line_stripped, number, output_type)

        # Get nearby context (surrounding lines)
        context_lines = lines[max(0, i-3):min(len(lines), i+4)]
        nearby_context = ' '.join(context_lines)

        # Infer section from number prefix and title keywords
        section = _infer_section(number, raw_title, nearby_context)

        # Look for subtitle/grouping clues in nearby context
        subtitle_context = _find_grouping_context(nearby_context, global_context)

        # Look for analysis set clues
        analysis_set_context = _find_analysis_set_context(nearby_context, global_context, section)

        candidates.append({
            "number": number,
            "raw_title": raw_title,
            "output_type": output_type or "table",
            "section": section,
            "extraction_evidence": {
                "title_text_source": f"SAP line {i+1}",
                "subtitle_context": subtitle_context,
                "analysis_set_context": analysis_set_context,
            }
        })

    return candidates


def _extract_number_and_type(line: str):
    """Extract TLF number and output type from a line."""
    # Pattern: "Table 14.1.1" or "14.1.1"
    m = re.search(r'\b(Table|Listing|Figure)\s+(1[456]\.\d+(?:\.\d+)*)', line, re.IGNORECASE)
    if m:
        output_type = m.group(1).lower()
        return m.group(2), output_type

    # Plain number pattern
    m = re.search(r'\b(1[456]\.\d+(?:\.\d+)*)\b', line)
    if m:
        return m.group(1), None

    return None, None


def _extract_raw_title(line: str, number: str, output_type: Optional[str]) -> Optional[str]:
    """Extract the raw title text from the line."""
    # Remove the number and output_type prefix
    text = line
    if output_type:
        text = re.sub(r'\b(?:Table|Listing|Figure)\s+' + re.escape(number), '', text, flags=re.IGNORECASE)
    else:
        text = text.replace(number, '', 1)

    # Clean up
    text = re.sub(r'^[\s\-\u2013:\.]+', '', text.strip())
    text = re.sub(r'[\s\.]+$', '', text)
    return text if text else None


def _infer_section(number: str, raw_title: Optional[str], context: str) -> str:
    """Infer section from TLF number prefix and keyword matching."""
    # Standard CTD section 14 numbering
    if re.match(r'^14\.1', number):
        return "demographics"
    if re.match(r'^14\.2', number):
        return "efficacy"
    if re.match(r'^14\.3', number):
        return "safety"
    if re.match(r'^14\.4', number):
        return "pharmacokinetics"

    # Fall back to keyword matching
    search_text = ((raw_title or '') + ' ' + context).lower()
    for section, keywords in SECTION_KEYWORDS.items():
        if any(kw in search_text for kw in keywords):
            return section

    return "other"


def _find_grouping_context(nearby: str, global_context: Dict) -> Optional[str]:
    """Find subtitle/grouping context in nearby text."""
    text = nearby.lower()
    for pattern in GROUPING_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                return f"by {m.group(1).strip().title()}"
            except IndexError:
                pass

    # Check global context
    return global_context.get("default_grouping")


def _find_analysis_set_context(nearby: str, global_context: Dict, section: str) -> Optional[str]:
    """Find analysis set context."""
    text = nearby.lower()
    for pattern in ANALYSIS_SET_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            return m.group(0).strip().title()

    # Fall back to section defaults from global context
    return global_context.get(f"default_analysis_set_{section}") or global_context.get("default_analysis_set")


def _extract_global_context(content: str) -> Dict[str, Any]:
    """Extract global/study-level context clues from SAP."""
    ctx = {}
    text = content.lower()

    # Look for default grouping
    for pattern in GROUPING_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            try:
                ctx["default_grouping"] = f"By {m.group(1).strip().title()}"
            except IndexError:
                pass
            break

    # Look for primary analysis set
    m = re.search(r'(?:primary|main)\s+analysis\s+(?:will\s+use\s+the\s+)?(\w[\w\s]+?(?:population|set))', text, re.IGNORECASE)
    if m:
        ctx["default_analysis_set"] = m.group(1).strip().title()

    return ctx
