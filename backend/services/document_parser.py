"""
Document Parser Service — parse-once pipeline (PRD §4.7).

Extracts text from PDF, Word (.docx), and Excel (.xlsx) files
and splits it into chunks with section references for later retrieval.

All functions are pure (bytes in, data out) — no DB access.
"""
import io
import re
import uuid
from typing import Any, Dict, List

try:
    import pdfplumber
except ImportError:  # pragma: no cover
    pdfplumber = None  # type: ignore


class UnsupportedDocumentType(ValueError):
    """Raised when the file extension is not supported."""


def parse_document(
    file_bytes: bytes,
    filename: str,
    doc_type: str,
) -> Dict[str, Any]:
    """
    Entry point: dispatch to the correct extractor based on file extension.

    Returns:
        {
            "parsed_content": str,      # full extracted text
            "chunks_meta": List[Dict],  # chunked with section_ref
        }
    """
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""

    if ext == "pdf":
        text = _parse_pdf(file_bytes)
    elif ext in ("docx", "doc"):
        text = _parse_docx(file_bytes)
    elif ext in ("xlsx", "xls"):
        text = _parse_xlsx(file_bytes)
    else:
        raise UnsupportedDocumentType(
            f"Cannot parse '{filename}': unsupported extension '{ext}'. "
            "Supported: pdf, docx, doc, xlsx, xls."
        )

    chunks = _chunk_text(text)
    return {"parsed_content": text, "chunks_meta": chunks}


# ---------------------------------------------------------------------------
# Extractors
# ---------------------------------------------------------------------------

def _parse_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF using pdfplumber."""
    if pdfplumber is None:
        raise ImportError("pdfplumber is required for PDF parsing. Run: pip install pdfplumber")

    buf = io.BytesIO(file_bytes)
    pages = []
    with pdfplumber.open(buf) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                pages.append(page_text)
    return "\n\n".join(pages)


def _parse_docx(file_bytes: bytes) -> str:
    """Extract text from a Word .docx file using python-docx."""
    from docx import Document as DocxDocument

    buf = io.BytesIO(file_bytes)
    doc = DocxDocument(buf)
    paragraphs = [para.text for para in doc.paragraphs if para.text.strip()]
    return "\n\n".join(paragraphs)


def _parse_xlsx(file_bytes: bytes) -> str:
    """Extract text from an Excel .xlsx file using openpyxl."""
    import openpyxl

    buf = io.BytesIO(file_bytes)
    wb = openpyxl.load_workbook(buf, read_only=True, data_only=True)
    try:
        sheet_texts = []
        for sheet in wb.worksheets:
            rows = []
            for row in sheet.iter_rows(values_only=True):
                cells = [str(cell) for cell in row if cell is not None]
                if cells:
                    rows.append("\t".join(cells))
            if rows:
                sheet_texts.append(f"[Sheet: {sheet.title}]\n" + "\n".join(rows))
    finally:
        wb.close()
    return "\n\n".join(sheet_texts)


# ---------------------------------------------------------------------------
# Chunking
# ---------------------------------------------------------------------------

_HEADING_RE = re.compile(
    r"""
    ^                         # start of line
    (?:
        \d+(?:\.\d+)*\.?\s+   # numbered: "5.", "5.1", "12.3.4"
        |
        [A-Z][A-Z\s]{4,}$     # ALL CAPS line (min 5 chars)
    )
    """,
    re.VERBOSE,
)

_MIN_CHUNK_CHARS = 30  # skip very short paragraphs (headings handled separately)


def _chunk_text(text: str) -> List[Dict[str, Any]]:
    """
    Split text into logical chunks with section references.

    Strategy:
    - Split on two or more consecutive newlines (paragraph boundaries).
    - Detect numbered / ALL-CAPS headings; use them as running section_ref.
    - Skip paragraphs shorter than _MIN_CHUNK_CHARS (after heading detection).
    """
    if not text or not text.strip():
        return []

    paragraphs = [p.strip() for p in re.split(r"\n{2,}", text) if p.strip()]
    chunks: List[Dict[str, Any]] = []
    current_section = "Introduction"

    for para in paragraphs:
        first_line = para.split("\n")[0].strip()
        if _is_heading(first_line):
            current_section = first_line[:80]
            # Still include the heading paragraph as a chunk if it has content
            if len(para) < _MIN_CHUNK_CHARS:
                continue

        if len(para) < _MIN_CHUNK_CHARS:
            continue

        chunks.append({
            "chunk_id": str(uuid.uuid4()),
            "section_ref": current_section,
            "text": para,
            "embedding_id": None,
        })

    return chunks


def _is_heading(line: str) -> bool:
    """Heuristic: return True if line looks like a document section heading."""
    if not line or len(line) > 120:
        return False
    return bool(_HEADING_RE.match(line))
