"""
Document parsing pipeline for TLF Shell Generator.

Supported formats
-----------------
  .pdf   — pypdf  (text-layer PDFs; scanned PDFs yield empty text)
  .docx  — python-docx

Pipeline
--------
  1. Detect format from filename extension.
  2. Extract raw text:
       PDF  → per-page text via pypdf.PdfReader
       Word → paragraphs via docx.Document
  3. Split into logical sections using:
       PDF  → regex-based heading detection on each line
       Word → Word Heading styles (Heading 1/2/3…) or regex fallback
  4. Return (parsed_content, chunks_meta) — no raw bytes are persisted.

Chunk metadata schema (one dict per chunk)
------------------------------------------
  {
    "chunk_id":    str    # UUID v4
    "section_ref": str    # inferred section heading
    "text":        str    # cleaned section body text
    "char_count":  int
    "doc_type":    str    # mirrors Document.type (sap | protocol | …)
    "page_num":    int    # PDF only — first page of this section
    "para_range":  [int, int]  # Word only — [start_para_idx, end_para_idx]
  }
"""

from __future__ import annotations

import io
import re
import uuid
from typing import List, Tuple

# ---------------------------------------------------------------------------
# Internal type alias
# ---------------------------------------------------------------------------

Chunk = dict


# ---------------------------------------------------------------------------
# Section-heading heuristics
# ---------------------------------------------------------------------------

# Matches lines like:
#   "1.  Introduction"
#   "2.1 Study Objectives"
#   "SECTION 3"
#   "Appendix A"
#   "CHAPTER 4 — Results"
_NUMBERED_RE = re.compile(
    r"""
    ^
    (?:
        \d{1,2}(?:\.\d{1,3}){0,3}   # numeric: 1 | 1.1 | 1.2.3 | 1.2.3.4
        [\s\t]+\S                     # followed by a space and non-empty title
      |
        (?:SECTION|APPENDIX|CHAPTER|ANNEX|TABLE|FIGURE|LIST)\s+\w
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)


def _is_heading(text: str) -> bool:
    """Return True if *text* looks like a section heading."""
    stripped = text.strip()
    # Must be non-empty and reasonably short
    if not stripped or len(stripped) > 120:
        return False
    return bool(_NUMBERED_RE.match(stripped))


def _clean(text: str) -> str:
    """Collapse runs of ≥3 blank lines to two; strip trailing whitespace."""
    text = re.sub(r"[ \t]+\n", "\n", text)          # trailing spaces on lines
    text = re.sub(r"\n{3,}", "\n\n", text)           # blank-line runs
    return text.strip()


# ---------------------------------------------------------------------------
# PDF parsing — pypdf
# ---------------------------------------------------------------------------

def _extract_pdf(file_bytes: bytes) -> List[Tuple[int, str]]:
    """
    Extract (page_number, page_text) for every page in a PDF.

    Returns a list of (1-based page index, extracted text).
    Pages that cannot be extracted yield an empty string rather than raising.
    """
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "pypdf is required for PDF parsing.  "
            "Run: pip install 'pypdf>=3.9.0'"
        ) from exc

    reader = PdfReader(io.BytesIO(file_bytes))
    pages: List[Tuple[int, str]] = []
    for i, page in enumerate(reader.pages, start=1):
        try:
            text = page.extract_text() or ""
        except Exception:  # noqa: BLE001 — tolerate corrupt pages
            text = ""
        pages.append((i, text))
    return pages


def _chunk_pdf(
    pages: List[Tuple[int, str]],
) -> Tuple[str, List[Chunk]]:
    """
    Walk the page list line-by-line.  Each time a heading is detected, flush
    the current accumulated text as a new chunk and start fresh.
    """
    chunks: List[Chunk] = []
    current_heading = "Preamble"
    current_lines: List[str] = []
    current_page = 1

    def _flush(heading: str, lines: List[str], page: int) -> None:
        body = _clean("\n".join(lines))
        if body:
            chunks.append(
                {
                    "chunk_id": str(uuid.uuid4()),
                    "section_ref": heading,
                    "text": body,
                    "char_count": len(body),
                    "page_num": page,
                }
            )

    for page_num, page_text in pages:
        for line in page_text.splitlines():
            if _is_heading(line):
                _flush(current_heading, current_lines, current_page)
                current_heading = line.strip()
                current_lines = []
                current_page = page_num
            else:
                current_lines.append(line)

    _flush(current_heading, current_lines, current_page)

    full_text = "\n\n".join(
        f"## {c['section_ref']}\n{c['text']}" for c in chunks
    )
    return full_text, chunks


# ---------------------------------------------------------------------------
# Word parsing — python-docx
# ---------------------------------------------------------------------------

def _extract_docx(file_bytes: bytes) -> List[Tuple[str, str]]:
    """
    Return (style_name, paragraph_text) for every non-empty paragraph in a
    .docx document.
    """
    try:
        from docx import Document as DocxDocument  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "python-docx is required for Word parsing.  "
            "Run: pip install 'python-docx>=1.1.0'"
        ) from exc

    doc = DocxDocument(io.BytesIO(file_bytes))
    paras: List[Tuple[str, str]] = []
    for para in doc.paragraphs:
        style = para.style.name if para.style else "Normal"
        text = para.text.strip()
        if text:
            paras.append((style, text))
    return paras


def _is_word_heading(style: str, text: str) -> bool:
    """True if the paragraph uses a Word Heading style or looks like a heading."""
    if style.lower().startswith("heading"):
        return True
    return _is_heading(text)


def _chunk_docx(
    paras: List[Tuple[str, str]],
) -> Tuple[str, List[Chunk]]:
    """
    Walk paragraphs, flushing a new chunk each time a heading is encountered.
    """
    chunks: List[Chunk] = []
    current_heading = "Preamble"
    current_lines: List[str] = []
    para_start = 0

    def _flush(heading: str, lines: List[str], start: int, end: int) -> None:
        body = _clean("\n".join(lines))
        if body:
            chunks.append(
                {
                    "chunk_id": str(uuid.uuid4()),
                    "section_ref": heading,
                    "text": body,
                    "char_count": len(body),
                    "para_range": [start, end],
                }
            )

    for idx, (style, text) in enumerate(paras):
        if _is_word_heading(style, text):
            _flush(current_heading, current_lines, para_start, idx - 1)
            current_heading = text
            current_lines = []
            para_start = idx
        else:
            current_lines.append(text)

    _flush(current_heading, current_lines, para_start, len(paras) - 1)

    full_text = "\n\n".join(
        f"## {c['section_ref']}\n{c['text']}" for c in chunks
    )
    return full_text, chunks


# ---------------------------------------------------------------------------
# Plain-text fallback
# ---------------------------------------------------------------------------

def _chunk_plaintext(raw: str) -> Tuple[str, List[Chunk]]:
    """Split plain text by blank lines and group under detected headings."""
    chunks: List[Chunk] = []
    current_heading = "Full Document"
    current_lines: List[str] = []

    def _flush(heading: str, lines: List[str]) -> None:
        body = _clean("\n".join(lines))
        if body:
            chunks.append(
                {
                    "chunk_id": str(uuid.uuid4()),
                    "section_ref": heading,
                    "text": body,
                    "char_count": len(body),
                }
            )

    for line in raw.splitlines():
        if _is_heading(line):
            _flush(current_heading, current_lines)
            current_heading = line.strip()
            current_lines = []
        else:
            current_lines.append(line)

    _flush(current_heading, current_lines)

    if not chunks:
        # No headings detected — one big chunk
        body = _clean(raw)
        chunks = [
            {
                "chunk_id": str(uuid.uuid4()),
                "section_ref": "Full Document",
                "text": body,
                "char_count": len(body),
            }
        ]

    full_text = "\n\n".join(
        f"## {c['section_ref']}\n{c['text']}" for c in chunks
    )
    return full_text, chunks


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def parse_document(
    file_bytes: bytes,
    filename: str,
    doc_type: str,
) -> Tuple[str, List[Chunk]]:
    """
    Parse a PDF or Word document and return (parsed_content, chunks_meta).

    Parameters
    ----------
    file_bytes : bytes
        Raw file content.  **Not stored** — only extracted text is kept.
    filename : str
        Original upload filename; extension determines the parser.
    doc_type : str
        Document type tag (sap | protocol | tlf_library | …).
        Stored in every chunk for downstream retrieval filtering.

    Returns
    -------
    parsed_content : str
        Full document text with ``## Section`` markers.
    chunks_meta : list[dict]
        One dict per logical section; see module docstring for field layout.

    Raises
    ------
    RuntimeError
        If a required parsing library (pypdf / python-docx) is not installed.
    ValueError
        If file_bytes is empty.
    """
    if not file_bytes:
        raise ValueError(f"Received empty file bytes for '{filename}'.")

    name_lower = (filename or "").lower()

    if name_lower.endswith(".pdf"):
        pages = _extract_pdf(file_bytes)
        parsed_content, chunks = _chunk_pdf(pages)

    elif name_lower.endswith(".docx"):
        paras = _extract_docx(file_bytes)
        parsed_content, chunks = _chunk_docx(paras)

    elif name_lower.endswith(".doc"):
        # Legacy binary Word — not natively supported; surface a clear message.
        msg = (
            f"Legacy .doc format is not supported for '{filename}'. "
            "Please convert to .docx and re-upload."
        )
        parsed_content = msg
        chunks = [
            {
                "chunk_id": str(uuid.uuid4()),
                "section_ref": "Unsupported Format",
                "text": msg,
                "char_count": len(msg),
            }
        ]

    else:
        # Unknown format — attempt UTF-8 plain-text decode
        try:
            raw_text = file_bytes.decode("utf-8", errors="replace")
        except Exception:  # noqa: BLE001
            raw_text = "[PARSE ERROR] Could not decode file as text."
        parsed_content, chunks = _chunk_plaintext(raw_text)

    # Tag every chunk with the document type for retrieval filtering
    for chunk in chunks:
        chunk["doc_type"] = doc_type

    return parsed_content, chunks
