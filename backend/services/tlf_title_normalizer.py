"""
TLF Title Normalizer / Composition Service.
Takes raw evidence (from SAP extraction or upload) and produces normalized fields.
Separate from extraction logic.
"""
import re
from typing import Optional, Dict, Any

# Analysis set terms for parenthetical extraction
ANALYSIS_SET_TERMS = [
    "population", "set", "subjects", "patients", "itt", "fas", "mitt",
    "ias", "pp", "per protocol", "intent to treat", "intent-to-treat",
    "full analysis", "modified intent", "safety analysis", "safety population",
    "all treated", "randomized", "evaluable",
]

# Subtitle split triggers (in priority order, longer phrases first)
SUBTITLE_TRIGGERS = [
    "stratified by", "grouped by", "broken down by", "summarized by",
    "presented by", "tabulated by", "split by",
    "by treatment group", "by treatment arm", "by visit", "by time point",
    "by age group", "by sex", "by region",
    "by", "for", "versus", "vs.", "across", "over time", "within",
    "compared to", "compared with",
]


def normalize_tlf_title(
    *,
    raw_title: Optional[str] = None,
    extraction_evidence: Optional[Dict[str, Any]] = None,
    user_title: Optional[str] = None,
    user_subtitle: Optional[str] = None,
    user_analysis_set: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Normalize TLF title into structured components.
    
    Priority order for each field:
    - user_edit > uploaded/explicit > parsed from raw_title > inferred from context
    
    Returns dict with: title, subtitle, analysis_set, composed_title,
                       title_source, subtitle_source, analysis_set_source, parsing_confidence
    """
    title = None
    subtitle = None
    analysis_set = None
    title_source = None
    subtitle_source = None
    analysis_set_source = None
    
    # --- Step 1: User edits override everything ---
    if user_title is not None:
        title = user_title
        title_source = "user_edit"
    if user_subtitle is not None:
        subtitle = user_subtitle
        subtitle_source = "user_edit"
    if user_analysis_set is not None:
        analysis_set = user_analysis_set
        analysis_set_source = "user_edit"
    
    # --- Step 2: Parse from raw_title if we have it and fields aren't set ---
    if raw_title and (title is None or subtitle is None or analysis_set is None):
        parsed = _parse_complete_title(raw_title)
        
        if title is None and parsed.get("title"):
            title = parsed["title"]
            title_source = "explicit_sap" if not extraction_evidence else "parsed_from_raw_title"
        
        if subtitle is None and parsed.get("subtitle"):
            subtitle = parsed["subtitle"]
            subtitle_source = "parsed_from_raw_title"
        
        if analysis_set is None and parsed.get("analysis_set"):
            analysis_set = parsed["analysis_set"]
            analysis_set_source = "parsed_from_raw_title"
    
    # --- Step 3: Fill from extraction evidence context ---
    if extraction_evidence:
        if subtitle is None and extraction_evidence.get("subtitle_context"):
            subtitle = extraction_evidence["subtitle_context"]
            subtitle_source = "inferred_from_sap_context"
        
        if analysis_set is None and extraction_evidence.get("analysis_set_context"):
            analysis_set = extraction_evidence["analysis_set_context"]
            analysis_set_source = "inferred_from_sap_context"
    
    # Fallback: use raw_title as title if nothing parsed
    if title is None:
        title = raw_title or ""
        title_source = title_source or "explicit_sap"
    
    # --- Step 4: Build composed_title ---
    composed_title = _build_composed_title(title, subtitle, analysis_set)
    
    # --- Step 5: Calculate confidence ---
    parsing_confidence = _calculate_confidence(
        title=title,
        subtitle=subtitle,
        analysis_set=analysis_set,
        title_source=title_source,
        subtitle_source=subtitle_source,
        analysis_set_source=analysis_set_source,
    )
    
    return {
        "title": title,
        "subtitle": subtitle,
        "analysis_set": analysis_set,
        "composed_title": composed_title,
        "title_source": title_source,
        "subtitle_source": subtitle_source,
        "analysis_set_source": analysis_set_source,
        "parsing_confidence": parsing_confidence,
    }


def _parse_complete_title(raw: str) -> Dict[str, Optional[str]]:
    """Parse a complete title string into title/subtitle/analysis_set components."""
    working = raw.strip()
    subtitle = None
    analysis_set = None
    
    # 1. Extract analysis set from final parenthetical
    paren_m = re.search(r'\(([^()]+)\)\s*$', working)
    if paren_m:
        candidate = paren_m.group(1).strip()
        if any(term in candidate.lower() for term in ANALYSIS_SET_TERMS):
            analysis_set = candidate
            working = working[:paren_m.start()].strip()
            working = re.sub(r'[\s\-\u2013,\.]+$', '', working)
    
    # 2. Split on subtitle trigger (longest match first)
    triggers_sorted = sorted(SUBTITLE_TRIGGERS, key=len, reverse=True)
    for trigger in triggers_sorted:
        pattern = r'\b' + re.escape(trigger) + r'\b'
        m = re.search(pattern, working, re.IGNORECASE)
        if m and m.start() > 2:  # not at very start
            subtitle_raw = working[m.start():].strip()
            # Capitalize 'by' -> 'By' etc.
            subtitle = subtitle_raw[0].upper() + subtitle_raw[1:]
            working = working[:m.start()].strip()
            working = re.sub(r'[\s\-\u2013,\.]+$', '', working)
            break
    
    return {
        "title": working if working else raw,
        "subtitle": subtitle,
        "analysis_set": analysis_set,
    }


def _build_composed_title(title: str, subtitle: Optional[str], analysis_set: Optional[str]) -> str:
    """Build the final composed display title."""
    base = (title or "").strip()
    
    if subtitle and analysis_set:
        sub = subtitle.strip()
        aset = analysis_set.strip()
        return f"{base}. {sub} ({aset})"
    elif subtitle:
        sub = subtitle.strip()
        return f"{base}. {sub}"
    elif analysis_set:
        aset = analysis_set.strip()
        return f"{base} ({aset})"
    else:
        return base


def _calculate_confidence(
    title, subtitle, analysis_set,
    title_source, subtitle_source, analysis_set_source
) -> str:
    """Calculate parsing confidence based on what was found and how."""
    # High confidence: user edits or explicit sources for all present fields
    explicit_sources = {"explicit_sap", "uploaded_tlf_list", "parsed_from_raw_title", "user_edit"}
    
    title_explicit = title_source in explicit_sources if title_source else False
    subtitle_explicit = subtitle_source in explicit_sources if subtitle_source else True  # missing is OK
    aset_explicit = analysis_set_source in explicit_sources if analysis_set_source else False
    
    if title_explicit and (not subtitle or subtitle_explicit) and (not analysis_set or aset_explicit):
        if analysis_set:  # complete
            return "high"
        elif subtitle:    # title + subtitle, no analysis_set
            return "high"
        else:             # title only, no inferred fields
            return "medium"
    
    # Low confidence: significant inference or missing
    inferred_count = sum([
        subtitle_source == "inferred_from_sap_context",
        analysis_set_source == "inferred_from_sap_context",
    ])
    
    if inferred_count >= 2 or not title:
        return "low"
    if inferred_count == 1:
        return "medium"
    
    return "low" if not analysis_set else "medium"


def normalize_uploaded_row(row: Dict[str, Any]) -> Dict[str, Any]:
    """
    Normalize a row from an uploaded TLF list CSV/Excel.
    Handles both pre-split columns and combined title columns.
    """
    # Check if pre-split columns exist
    if row.get("title") and not row.get("raw_title"):
        # Pre-split format: use as-is, but still try to parse if subtitle/analysis_set missing
        raw_for_parse = None
        if not row.get("subtitle") and not row.get("analysis_set"):
            raw_for_parse = row["title"]
    else:
        raw_for_parse = row.get("raw_title") or row.get("complete_title") or row.get("title")
    
    result = normalize_tlf_title(
        raw_title=raw_for_parse,
        user_title=row.get("title") if row.get("subtitle") or row.get("analysis_set") else None,
        user_subtitle=row.get("subtitle") or None,
        user_analysis_set=row.get("analysis_set") or None,
    )
    
    # Override sources for uploaded data
    if result["title_source"] not in ("user_edit",):
        result["title_source"] = "uploaded_tlf_list"
    if result["subtitle_source"] not in ("user_edit",) and result["subtitle"]:
        if row.get("subtitle"):
            result["subtitle_source"] = "uploaded_tlf_list"
    if result["analysis_set_source"] not in ("user_edit",) and result["analysis_set"]:
        if row.get("analysis_set"):
            result["analysis_set_source"] = "uploaded_tlf_list"
    
    return result
