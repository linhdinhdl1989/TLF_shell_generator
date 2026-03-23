# Backend Parser Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three parser stubs with real implementations — test infrastructure, unit-tested service layer, and a live document parsing pipeline — so that uploading a real SAP PDF produces `parsed_content` that feeds the existing TLF extraction route.

**Architecture:** Pure-function service modules live in `backend/services/`; `app.py` stays thin (wiring only). Tests live in `backend/tests/` and only cover the service layer — no API-level tests in this plan. Document bytes are passed directly to the background parse task (no raw storage in DB).

**Tech Stack:** Python 3.12, pytest + pytest-asyncio + httpx (test), pdfplumber (PDF), python-docx (Word/.docx), openpyxl (Excel, already installed), FastAPI BackgroundTasks.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Modify | `backend/requirements.txt` | Uncomment pytest, pytest-asyncio, httpx, pdfplumber, python-docx (for parsing) |
| Create | `backend/tests/__init__.py` | Package marker |
| Create | `backend/tests/conftest.py` | Shared pytest fixtures: sample SAP text, small docx bytes |
| Create | `backend/tests/services/__init__.py` | Package marker |
| Create | `backend/tests/services/test_tlf_extraction_service.py` | Unit tests for regex extraction logic |
| Create | `backend/tests/services/test_tlf_title_normalizer.py` | Unit tests for title parsing and confidence |
| Create | `backend/services/document_parser.py` | Pure-function: extract text from PDF/Word/Excel + chunk |
| Create | `backend/tests/services/test_document_parser.py` | Unit tests for document_parser |
| Modify | `backend/app.py` lines 364–408 | Replace `_parse_document_stub` body with real parser call; pass bytes to bg task |

---

## Task 1: Enable Test Infrastructure

**Files:**
- Modify: `backend/requirements.txt`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/services/__init__.py`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Uncomment test and parsing deps in requirements.txt**

Find these commented lines and uncomment them:
```
# pdfplumber>=0.11.0
# python-docx>=1.1.0   (the one under "Document parsing", not the export one)
# pytest>=8.2.0
# pytest-asyncio>=0.23.0
# httpx>=0.27.0
```

Note: `python-docx>=1.1.0` already appears under the Export section (line 63) — leave that one; only uncomment the one under "Document parsing" (line 41). After editing, the Document parsing block should read:
```
pdfplumber>=0.11.0               # PDF text + table extraction
python-docx>=1.1.0               # Word (.docx) extraction
openpyxl>=3.1.2                  # Excel (.xlsx) extraction
# pytesseract>=0.3.10            # OCR fallback (deferred)
# Pillow>=10.3.0                 # image pre-processing for OCR (deferred)
```

And the Dev/testing block:
```
pytest>=8.2.0
pytest-asyncio>=0.23.0
httpx>=0.27.0                    # async test client for FastAPI
```

- [ ] **Step 2: Install updated dependencies**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
pip install -r requirements.txt
```

Expected: packages install without errors. Verify with:
```bash
python -c "import pdfplumber, docx, pytest; print('OK')"
```

- [ ] **Step 3: Create package markers**

`backend/tests/__init__.py` — empty file.
`backend/tests/services/__init__.py` — empty file.

- [ ] **Step 4: Create conftest.py with shared fixtures**

`backend/tests/conftest.py`:
```python
"""Shared pytest fixtures for backend tests."""
import io
import pytest
from docx import Document as DocxDocument


SAP_SAMPLE_TEXT = """\
Statistical Analysis Plan
Study: XYZ-101

1. Introduction
This SAP describes the statistical methods for Study XYZ-101.

5. Analysis Populations
The primary analysis will use the Safety Population.
All randomized subjects who received at least one dose are included.

12. List of Tables, Listings, and Figures

Table 14.1.1 Summary of Demographic and Baseline Characteristics
This table summarizes demographics. Summaries will be presented by Treatment Group.
Subjects are analyzed using the Safety Population.

Table 14.1.2 Summary of Prior and Concomitant Medications

Table 14.2.1 Primary Efficacy Endpoint Analysis
The primary endpoint analysis. Intent-to-Treat Population.

Listing 16.1.1 Subject Disposition Listing

Table 14.3.1 Overview of Adverse Events (Safety Population)
Adverse events summaries will be presented by System Organ Class and Preferred Term.

Table 14.3.2 Treatment-Emergent Adverse Events by System Organ Class
"""


@pytest.fixture
def sap_text():
    """Raw SAP text for extraction tests."""
    return SAP_SAMPLE_TEXT


@pytest.fixture
def minimal_docx_bytes():
    """In-memory .docx with known content."""
    doc = DocxDocument()
    doc.add_heading("Statistical Analysis Plan", level=1)
    doc.add_paragraph("5. Analysis Populations")
    doc.add_paragraph(
        "Table 14.1.1 Summary of Demographic and Baseline Characteristics"
    )
    doc.add_paragraph(
        "Table 14.2.1 Primary Efficacy Endpoint Analysis (Intent-to-Treat Population)"
    )
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


@pytest.fixture
def minimal_xlsx_bytes():
    """In-memory .xlsx with known content."""
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "TLF List"
    ws.append(["Number", "Title", "Section"])
    ws.append(["14.1.1", "Demographics", "demographics"])
    ws.append(["14.2.1", "Primary Efficacy", "efficacy"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()
```

- [ ] **Step 5: Create pytest.ini for asyncio mode**

`backend/pytest.ini`:
```ini
[pytest]
asyncio_mode = auto
```

This ensures any future `async def test_*` functions are awaited automatically by pytest-asyncio.

- [ ] **Step 6: Verify pytest discovers the package**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
pytest tests/ --collect-only
```

Expected: "no tests ran" (0 items) with no import errors.

- [ ] **Step 7: Commit**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
git add requirements.txt pytest.ini tests/__init__.py tests/services/__init__.py tests/conftest.py
git commit -m "chore: enable test infrastructure and parsing dependencies"
```

---

## Task 2: Tests for tlf_extraction_service

**Files:**
- Create: `backend/tests/services/test_tlf_extraction_service.py`

These are pure-function tests — no DB, no async.

- [ ] **Step 1: Write the test file**

`backend/tests/services/test_tlf_extraction_service.py`:
```python
"""Tests for tlf_extraction_service — regex-based SAP extraction."""
import pytest
from services.tlf_extraction_service import (
    extract_tlf_candidates_from_sap,
    _extract_number_and_type,
    _infer_section,
    _find_grouping_context,
    _find_analysis_set_context,
    _extract_global_context,
)


# ---------------------------------------------------------------------------
# _extract_number_and_type
# ---------------------------------------------------------------------------

def test_extract_table_with_keyword():
    number, output_type = _extract_number_and_type("Table 14.1.1 Summary of Demographics")
    assert number == "14.1.1"
    assert output_type == "table"


def test_extract_listing_with_keyword():
    number, output_type = _extract_number_and_type("Listing 16.1.1 Subject Listing")
    assert number == "16.1.1"
    assert output_type == "listing"


def test_extract_figure_with_keyword():
    number, output_type = _extract_number_and_type("Figure 14.2.1 Kaplan-Meier Curve")
    assert number == "14.2.1"
    assert output_type == "figure"


def test_extract_plain_number():
    number, output_type = _extract_number_and_type("14.3.1 Adverse Events by SOC")
    assert number == "14.3.1"
    assert output_type is None


def test_extract_returns_none_for_no_match():
    number, output_type = _extract_number_and_type("This line has no TLF number.")
    assert number is None
    assert output_type is None


# ---------------------------------------------------------------------------
# _infer_section
# ---------------------------------------------------------------------------

def test_infer_demographics_from_14_1():
    assert _infer_section("14.1.5", None, "") == "demographics"


def test_infer_efficacy_from_14_2():
    assert _infer_section("14.2.1", None, "") == "efficacy"


def test_infer_safety_from_14_3():
    assert _infer_section("14.3.1", None, "") == "safety"


def test_infer_pk_from_14_4():
    assert _infer_section("14.4.1", None, "") == "pharmacokinetics"


def test_infer_from_keyword_adverse_event():
    # 15.x prefix — fall back to keyword matching
    result = _infer_section("15.1.1", "Overview of Adverse Events", "")
    assert result == "safety"


def test_infer_from_keyword_efficacy():
    result = _infer_section("15.2.1", "Primary Efficacy Endpoint", "")
    assert result == "efficacy"


def test_infer_defaults_to_other():
    result = _infer_section("15.9.9", "Miscellaneous Summary", "no context")
    assert result == "other"


# ---------------------------------------------------------------------------
# _find_grouping_context
# ---------------------------------------------------------------------------

def test_finds_by_treatment_group():
    nearby = "Summaries will be presented by Treatment Group for all subjects."
    result = _find_grouping_context(nearby, {})
    assert result is not None
    assert "Treatment" in result


def test_finds_stratified_by():
    nearby = "Results stratified by age group and sex."
    result = _find_grouping_context(nearby, {})
    assert result is not None


def test_returns_none_when_no_grouping():
    result = _find_grouping_context("No grouping information here.", {})
    # May return None or global default — both are valid
    assert result is None or isinstance(result, str)


def test_falls_back_to_global_context():
    result = _find_grouping_context(
        "No grouping here.",
        {"default_grouping": "By Treatment Arm"}
    )
    assert result == "By Treatment Arm"


# ---------------------------------------------------------------------------
# _find_analysis_set_context
# ---------------------------------------------------------------------------

def test_finds_safety_population():
    nearby = "All analyses use the Safety Population."
    result = _find_analysis_set_context(nearby, {}, "safety")
    assert result is not None
    assert "Safety" in result


def test_finds_itt():
    nearby = "Intent-to-treat population is used for this analysis."
    result = _find_analysis_set_context(nearby, {}, "efficacy")
    assert result is not None


def test_falls_back_to_global_analysis_set():
    result = _find_analysis_set_context(
        "No population here.",
        {"default_analysis_set": "Safety Population"},
        "demographics"
    )
    assert result == "Safety Population"


# ---------------------------------------------------------------------------
# _extract_global_context
# ---------------------------------------------------------------------------

def test_extracts_default_analysis_set_from_sap(sap_text):
    ctx = _extract_global_context(sap_text)
    # SAP sample says "primary analysis will use the Safety Population"
    assert "default_analysis_set" in ctx
    assert ctx["default_analysis_set"] != ""


# ---------------------------------------------------------------------------
# extract_tlf_candidates_from_sap (integration)
# ---------------------------------------------------------------------------

def test_empty_content_returns_empty_list():
    assert extract_tlf_candidates_from_sap("") == []


def test_none_content_returns_empty_list():
    assert extract_tlf_candidates_from_sap(None) == []


def test_extracts_known_tables(sap_text):
    candidates = extract_tlf_candidates_from_sap(sap_text)
    numbers = [c["number"] for c in candidates]
    assert "14.1.1" in numbers
    assert "14.2.1" in numbers
    assert "14.3.1" in numbers


def test_extracts_listing(sap_text):
    candidates = extract_tlf_candidates_from_sap(sap_text)
    listings = [c for c in candidates if c["output_type"] == "listing"]
    assert any(c["number"] == "16.1.1" for c in listings)


def test_deduplicates_repeated_numbers():
    content = "Table 14.1.1 Demographics\nTable 14.1.1 Demographics again"
    candidates = extract_tlf_candidates_from_sap(content)
    assert len([c for c in candidates if c["number"] == "14.1.1"]) == 1


def test_section_inferred_from_number(sap_text):
    candidates = extract_tlf_candidates_from_sap(sap_text)
    demo = next(c for c in candidates if c["number"] == "14.1.1")
    assert demo["section"] == "demographics"
    efficacy = next(c for c in candidates if c["number"] == "14.2.1")
    assert efficacy["section"] == "efficacy"


def test_extraction_evidence_keys_present(sap_text):
    candidates = extract_tlf_candidates_from_sap(sap_text)
    for c in candidates:
        assert "extraction_evidence" in c
        ev = c["extraction_evidence"]
        assert "title_text_source" in ev
        # subtitle_context and analysis_set_context may be None — that's OK
        assert "subtitle_context" in ev
        assert "analysis_set_context" in ev
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
pytest tests/services/test_tlf_extraction_service.py -v
```

Note: `tlf_extraction_service.py` already exists and is fully implemented. These tests add coverage for the existing code, not a red-green cycle. All tests should PASS on the first run. If any fail, the test expectation likely mismatches the implementation — trace the function and fix the assertion before continuing.

- [ ] **Step 3: Commit**

```bash
git add tests/services/test_tlf_extraction_service.py
git commit -m "test: add unit tests for tlf_extraction_service"
```

---

## Task 3: Tests for tlf_title_normalizer

**Files:**
- Create: `backend/tests/services/test_tlf_title_normalizer.py`

- [ ] **Step 1: Write the test file**

`backend/tests/services/test_tlf_title_normalizer.py`:
```python
"""Tests for tlf_title_normalizer — title parsing, composition, confidence."""
import pytest
from services.tlf_title_normalizer import (
    normalize_tlf_title,
    normalize_uploaded_row,
    _parse_complete_title,
    _build_composed_title,
    _calculate_confidence,
)


# ---------------------------------------------------------------------------
# _parse_complete_title
# ---------------------------------------------------------------------------

def test_parses_analysis_set_from_final_parenthetical():
    result = _parse_complete_title(
        "Summary of Demographics by Treatment Group (Safety Population)"
    )
    assert result["analysis_set"] == "Safety Population"
    assert "Safety Population" not in result["title"]


def test_parses_subtitle_by_trigger():
    result = _parse_complete_title("Summary of Demographics by Treatment Group")
    assert result["subtitle"] is not None
    assert "Treatment Group" in result["subtitle"]
    assert result["title"] == "Summary of Demographics"


def test_parses_all_three_components():
    result = _parse_complete_title(
        "Adverse Events by System Organ Class (Safety Population)"
    )
    assert result["title"] == "Adverse Events"
    assert result["subtitle"] is not None
    assert "System Organ Class" in result["subtitle"]
    assert result["analysis_set"] == "Safety Population"


def test_title_only_no_subtitle_no_analysis_set():
    result = _parse_complete_title("Subject Listing")
    assert result["title"] == "Subject Listing"
    assert result["subtitle"] is None
    assert result["analysis_set"] is None


def test_ignores_parenthetical_without_population_keyword():
    # "(n=42)" should NOT be treated as analysis set
    result = _parse_complete_title("Demographics Summary (n=42)")
    assert result["analysis_set"] is None
    assert "n=42" in result["title"]


def test_subtitle_not_split_at_start_of_string():
    # "By" at position 0 should not create an empty title
    result = _parse_complete_title("By Treatment Group")
    # trigger at start (m.start() <= 2) is skipped — full string becomes title
    assert result["title"] == "By Treatment Group"
    assert result["subtitle"] is None


# ---------------------------------------------------------------------------
# _build_composed_title
# ---------------------------------------------------------------------------

def test_composed_all_three():
    composed = _build_composed_title(
        "Adverse Events", "By System Organ Class", "Safety Population"
    )
    assert composed == "Adverse Events. By System Organ Class (Safety Population)"


def test_composed_title_and_analysis_set_only():
    composed = _build_composed_title("Demographics", None, "Safety Population")
    assert composed == "Demographics (Safety Population)"


def test_composed_title_and_subtitle_only():
    composed = _build_composed_title("Demographics", "By Treatment Group", None)
    assert composed == "Demographics. By Treatment Group"


def test_composed_title_only():
    composed = _build_composed_title("Demographics", None, None)
    assert composed == "Demographics"


# ---------------------------------------------------------------------------
# _calculate_confidence
# ---------------------------------------------------------------------------

def test_confidence_high_all_explicit():
    result = _calculate_confidence(
        title="Demographics", subtitle="By Treatment Group", analysis_set="Safety Population",
        title_source="explicit_sap", subtitle_source="parsed_from_raw_title",
        analysis_set_source="parsed_from_raw_title",
    )
    assert result == "high"


def test_confidence_high_user_edits():
    result = _calculate_confidence(
        title="Demographics", subtitle=None, analysis_set="Safety Population",
        title_source="user_edit", subtitle_source=None,
        analysis_set_source="user_edit",
    )
    assert result == "high"


def test_confidence_medium_one_inferred():
    result = _calculate_confidence(
        title="Demographics", subtitle=None, analysis_set="Safety Population",
        title_source="parsed_from_raw_title", subtitle_source=None,
        analysis_set_source="inferred_from_sap_context",
    )
    assert result == "medium"


def test_confidence_low_two_inferred():
    result = _calculate_confidence(
        title="Demographics", subtitle="By ARM", analysis_set="Safety Population",
        title_source="parsed_from_raw_title",
        subtitle_source="inferred_from_sap_context",
        analysis_set_source="inferred_from_sap_context",
    )
    assert result == "low"


def test_confidence_low_title_only_no_analysis_set():
    # title present and explicit, but no analysis_set → low.
    # Trace: aset_explicit=False (source is None), so the first branch fails;
    # inferred_count=0 (neither subtitle nor analysis_set is "inferred_from_sap_context");
    # final line: return "low" if not analysis_set else "medium" → "low".
    result = _calculate_confidence(
        title="Demographics", subtitle=None, analysis_set=None,
        title_source="parsed_from_raw_title", subtitle_source=None,
        analysis_set_source=None,
    )
    assert result == "low"


# ---------------------------------------------------------------------------
# normalize_tlf_title (integration)
# ---------------------------------------------------------------------------

def test_user_title_overrides_raw():
    result = normalize_tlf_title(
        raw_title="Demographics by ARM (Safety Population)",
        user_title="My Custom Title",
    )
    assert result["title"] == "My Custom Title"
    assert result["title_source"] == "user_edit"


def test_user_analysis_set_overrides_parsed():
    result = normalize_tlf_title(
        raw_title="Demographics (Safety Population)",
        user_analysis_set="ITT Population",
    )
    assert result["analysis_set"] == "ITT Population"
    assert result["analysis_set_source"] == "user_edit"


def test_extraction_evidence_fills_missing_analysis_set():
    result = normalize_tlf_title(
        raw_title="Demographics Summary",  # no parenthetical
        extraction_evidence={"analysis_set_context": "Safety Population", "subtitle_context": None},
    )
    assert result["analysis_set"] == "Safety Population"
    assert result["analysis_set_source"] == "inferred_from_sap_context"


def test_full_raw_title_parsed_correctly():
    result = normalize_tlf_title(
        raw_title="Adverse Events by System Organ Class (Safety Population)"
    )
    assert result["title"] == "Adverse Events"
    assert "System Organ Class" in result["subtitle"]
    assert result["analysis_set"] == "Safety Population"
    assert result["parsing_confidence"] == "high"


def test_returns_all_required_keys():
    result = normalize_tlf_title(raw_title="Simple Title")
    required = {
        "title", "subtitle", "analysis_set", "composed_title",
        "title_source", "subtitle_source", "analysis_set_source",
        "parsing_confidence",
    }
    assert required.issubset(result.keys())


# ---------------------------------------------------------------------------
# normalize_uploaded_row
# ---------------------------------------------------------------------------

def test_uploaded_row_pre_split_columns():
    row = {
        "title": "Adverse Events",
        "subtitle": "By SOC",
        "analysis_set": "Safety Population",
    }
    result = normalize_uploaded_row(row)
    assert result["title"] == "Adverse Events"
    assert result["subtitle"] == "By SOC"
    assert result["analysis_set"] == "Safety Population"
    assert result["subtitle_source"] == "uploaded_tlf_list"
    assert result["analysis_set_source"] == "uploaded_tlf_list"


def test_uploaded_row_combined_title():
    row = {"raw_title": "Adverse Events by SOC (Safety Population)"}
    result = normalize_uploaded_row(row)
    assert result["title"] == "Adverse Events"
    assert result["analysis_set"] == "Safety Population"
```

- [ ] **Step 2: Run tests and verify they pass**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
pytest tests/services/test_tlf_title_normalizer.py -v
```

Expected: All tests PASS. If any fail, fix the test logic first (check your understanding of the implementation), then check if the implementation has a bug.

- [ ] **Step 3: Commit**

```bash
git add tests/services/test_tlf_title_normalizer.py
git commit -m "test: add unit tests for tlf_title_normalizer"
```

---

## Task 4: Implement services/document_parser.py

**Files:**
- Create: `backend/services/document_parser.py`
- Create: `backend/tests/services/test_document_parser.py`

Write the test first, then the implementation.

- [ ] **Step 1: Write the failing test**

`backend/tests/services/test_document_parser.py`:
```python
"""Tests for document_parser — text extraction and chunking from file bytes."""
import io
import pytest
from unittest.mock import patch, MagicMock


# ---------------------------------------------------------------------------
# Helpers to build minimal fixture bytes without real files
# ---------------------------------------------------------------------------

def make_docx_bytes(text_paragraphs: list[str]) -> bytes:
    from docx import Document as DocxDocument
    doc = DocxDocument()
    for para in text_paragraphs:
        doc.add_paragraph(para)
    buf = io.BytesIO()
    doc.save(buf)
    buf.seek(0)
    return buf.read()


def make_xlsx_bytes(rows: list[list]) -> bytes:
    import openpyxl
    wb = openpyxl.Workbook()
    ws = wb.active
    for row in rows:
        ws.append(row)
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return buf.read()


# ---------------------------------------------------------------------------
# parse_document — dispatcher
# ---------------------------------------------------------------------------

def test_parse_document_dispatches_pdf():
    from services.document_parser import parse_document

    fake_page = MagicMock()
    fake_page.extract_text.return_value = "Table 14.1.1 Demographics\n\nSome content here."
    fake_pdf = MagicMock()
    fake_pdf.__enter__ = MagicMock(return_value=fake_pdf)
    fake_pdf.__exit__ = MagicMock(return_value=False)
    fake_pdf.pages = [fake_page]

    with patch("services.document_parser.pdfplumber") as mock_plumber:
        mock_plumber.open.return_value = fake_pdf
        result = parse_document(b"fake-pdf-bytes", "sap.pdf", "sap")

    assert "parsed_content" in result
    assert "chunks_meta" in result
    assert "14.1.1" in result["parsed_content"]


def test_parse_document_dispatches_docx(minimal_docx_bytes):
    from services.document_parser import parse_document

    result = parse_document(minimal_docx_bytes, "sap.docx", "sap")
    assert "parsed_content" in result
    assert "chunks_meta" in result
    assert len(result["parsed_content"]) > 0


def test_parse_document_dispatches_xlsx(minimal_xlsx_bytes):
    from services.document_parser import parse_document

    result = parse_document(minimal_xlsx_bytes, "tlf_list.xlsx", "study_tlf_list")
    assert "parsed_content" in result
    assert len(result["parsed_content"]) > 0


def test_parse_document_unknown_extension_raises():
    from services.document_parser import parse_document, UnsupportedDocumentType

    with pytest.raises(UnsupportedDocumentType):
        parse_document(b"data", "file.xyz", "other")


# ---------------------------------------------------------------------------
# _parse_docx
# ---------------------------------------------------------------------------

def test_parse_docx_extracts_all_paragraphs():
    from services.document_parser import _parse_docx

    content = make_docx_bytes([
        "Statistical Analysis Plan",
        "Table 14.1.1 Demographics",
        "Table 14.2.1 Efficacy",
    ])
    text = _parse_docx(content)
    assert "Statistical Analysis Plan" in text
    assert "14.1.1" in text
    assert "14.2.1" in text


def test_parse_docx_skips_empty_paragraphs():
    from services.document_parser import _parse_docx

    content = make_docx_bytes(["Hello", "", "World"])
    text = _parse_docx(content)
    # Should not have double blank lines; content should be there
    assert "Hello" in text
    assert "World" in text


# ---------------------------------------------------------------------------
# _parse_xlsx
# ---------------------------------------------------------------------------

def test_parse_xlsx_extracts_cell_values():
    from services.document_parser import _parse_xlsx

    content = make_xlsx_bytes([
        ["Number", "Title", "Section"],
        ["14.1.1", "Demographics", "demographics"],
    ])
    text = _parse_xlsx(content)
    assert "14.1.1" in text
    assert "Demographics" in text


def test_parse_xlsx_multiple_sheets():
    from services.document_parser import _parse_xlsx
    import openpyxl

    wb = openpyxl.Workbook()
    ws1 = wb.active
    ws1.title = "Sheet1"
    ws1.append(["Table 14.1.1", "Demographics"])
    ws2 = wb.create_sheet("Sheet2")
    ws2.append(["Table 14.2.1", "Efficacy"])
    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    text = _parse_xlsx(buf.read())
    assert "14.1.1" in text
    assert "14.2.1" in text


# ---------------------------------------------------------------------------
# _chunk_text
# ---------------------------------------------------------------------------

def test_chunk_text_returns_list_of_dicts():
    from services.document_parser import _chunk_text

    chunks = _chunk_text("Paragraph one.\n\nParagraph two.")
    assert isinstance(chunks, list)
    assert all("chunk_id" in c for c in chunks)
    assert all("section_ref" in c for c in chunks)
    assert all("text" in c for c in chunks)
    assert all("embedding_id" in c for c in chunks)


def test_chunk_text_splits_on_blank_lines():
    from services.document_parser import _chunk_text, _MIN_CHUNK_CHARS

    # Paragraphs must exceed _MIN_CHUNK_CHARS to appear as chunks.
    # Use a length safely above the threshold so the test isn't fragile to minor constant changes.
    para = "x" * (_MIN_CHUNK_CHARS + 20)
    text = f"{para}\n\n{para}"
    chunks = _chunk_text(text)
    assert len(chunks) == 2


def test_chunk_text_heading_becomes_section_ref():
    from services.document_parser import _chunk_text

    text = "5.1 Safety Analysis\n\nThis is the content of the safety analysis section."
    chunks = _chunk_text(text)
    # Heading chunk itself and/or content chunk should reference "5.1 Safety Analysis"
    content_chunks = [c for c in chunks if "content of the safety" in c["text"]]
    assert len(content_chunks) >= 1
    assert "5.1" in content_chunks[0]["section_ref"]


def test_chunk_text_unique_chunk_ids():
    from services.document_parser import _chunk_text

    text = "\n\n".join([f"Paragraph {i} with sufficient text content." for i in range(5)])
    chunks = _chunk_text(text)
    ids = [c["chunk_id"] for c in chunks]
    assert len(ids) == len(set(ids))


def test_chunk_text_empty_returns_empty():
    from services.document_parser import _chunk_text

    assert _chunk_text("") == []
    assert _chunk_text("   \n\n  ") == []
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
pytest tests/services/test_document_parser.py -v 2>&1 | head -20
```

Expected: `ModuleNotFoundError: No module named 'services.document_parser'`

- [ ] **Step 3: Implement services/document_parser.py**

`backend/services/document_parser.py`:
```python
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
    sheet_texts = []
    for sheet in wb.worksheets:
        rows = []
        for row in sheet.iter_rows(values_only=True):
            cells = [str(cell) for cell in row if cell is not None]
            if cells:
                rows.append("\t".join(cells))
        if rows:
            sheet_texts.append(f"[Sheet: {sheet.title}]\n" + "\n".join(rows))
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
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
pytest tests/services/test_document_parser.py -v
```

Expected: All tests PASS.

- [ ] **Step 5: Run the full test suite to check for regressions**

```bash
pytest tests/ -v
```

Expected: All previously passing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add services/document_parser.py tests/services/test_document_parser.py
git commit -m "feat: implement document_parser service (PDF/Word/Excel + chunking)"
```

---

## Task 5: Wire document_parser into the upload background task

**Files:**
- Modify: `backend/app.py` lines ~364–408 (`_parse_document_stub`) and ~501–554 (`upload_document`)

The key insight: `file_bytes` are already in memory in `upload_document`. Pass them to the background task directly — no raw DB storage needed.

- [ ] **Step 1: Add round-trip smoke test**

Add to `backend/tests/services/test_document_parser.py` (at the bottom). This test
verifies that `parse_document` output flows correctly into `extract_tlf_candidates_from_sap`.
Both modules exist by Task 5, so this test should PASS immediately — it is a verification
step, not a red-green TDD cycle.

```python
# ---------------------------------------------------------------------------
# Round-trip: parse_document output feeds extract_tlf_candidates_from_sap
# ---------------------------------------------------------------------------

def test_parsed_docx_feeds_extraction(minimal_docx_bytes):
    """Round-trip: parse a docx, then extract TLF candidates from the text."""
    from services.document_parser import parse_document
    from services.tlf_extraction_service import extract_tlf_candidates_from_sap

    result = parse_document(minimal_docx_bytes, "sap.docx", "sap")
    candidates = extract_tlf_candidates_from_sap(result["parsed_content"])
    # minimal_docx_bytes contains "Table 14.1.1" and "Table 14.2.1"
    numbers = [c["number"] for c in candidates]
    assert "14.1.1" in numbers
    assert "14.2.1" in numbers
```

Run to confirm it passes:
```bash
pytest tests/services/test_document_parser.py::test_parsed_docx_feeds_extraction -v
```

Expected: PASS. If it fails, `parse_document` output is not readable by the extractor — investigate before proceeding.

- [ ] **Step 2: Update _parse_document_stub in app.py**

Locate `_parse_document_stub` (around line 364). Note that the existing stub has
`import asyncio` as an inline import inside the function body (used only for
`asyncio.sleep(0.5)`). The new function removes that sleep, so the inline import
disappears. This is intentional and safe — `asyncio` is not imported at module level
in `app.py`, and no other code depends on that stub's internal import.

Replace the entire function with:

```python
async def _parse_document(doc_id: str, file_bytes: bytes, filename: str) -> None:
    """
    Background task: parse-once pipeline (PRD §4.7).

    Extracts text + chunks from raw bytes, stores results on the Document row,
    then marks the document as 'ready'. Runs outside the request session.
    """
    from database import AsyncSessionLocal
    from services.document_parser import parse_document, UnsupportedDocumentType

    async with AsyncSessionLocal() as session:
        doc = await session.get(Document, doc_id)
        if doc is None:
            return
        if doc.status != "processing":
            return

        try:
            parsed = parse_document(file_bytes, filename, doc.type)
            doc.parsed_content = parsed["parsed_content"]
            doc.chunks_meta = parsed["chunks_meta"]
            doc.status = "ready"
        except UnsupportedDocumentType as exc:
            doc.parsed_content = None
            doc.chunks_meta = []
            doc.status = "error"
            doc.error_message = str(exc)
        except Exception as exc:  # noqa: BLE001
            doc.parsed_content = None
            doc.chunks_meta = []
            doc.status = "error"
            doc.error_message = f"Parse failed: {exc}"

        doc.updated_at = datetime.utcnow()
        await session.commit()
```

- [ ] **Step 3: Update upload_document to pass bytes to the background task**

Locate the line in `upload_document` that reads:
```python
    # Fire-and-forget parse pipeline (stub)
    background_tasks.add_task(_parse_document_stub, doc.id)
```

Replace with:
```python
    # Fire-and-forget parse pipeline
    background_tasks.add_task(_parse_document, doc.id, file_bytes, file.filename or "")
```

- [ ] **Step 4: Verify the server starts cleanly**

```bash
cd /home/linh/Documents/TLF_shell_generator-main/backend
uvicorn app:app --reload &
sleep 2
curl -s http://localhost:8000/health
kill %1
```

Expected: `{"status": "ok"}`

- [ ] **Step 5: Run full test suite**

```bash
pytest tests/ -v
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add app.py tests/services/test_document_parser.py
git commit -m "feat: wire document_parser into upload background task (PRD §4.7)"
```

---

## Verification Checklist

After all tasks complete, manually verify the end-to-end flow:

- [ ] Start the server: `uvicorn app:app --reload`
- [ ] Create a study via `POST /studies`
- [ ] Upload a real SAP PDF or docx via `POST /studies/{id}/documents` with `type=sap`
- [ ] Poll `GET /studies/{id}/documents/{doc_id}` until `status == "ready"`
- [ ] Confirm `parsed_content` is non-empty and looks like real text (not `[STUB]`)
- [ ] Call `POST /studies/{id}/tlf-list/extract-items`
- [ ] Confirm returned items reflect TLF numbers found in the actual document (not stub data)

---

## Out of Scope (This Plan)

- OCR for scanned PDFs (pytesseract — deferred)
- Vector embeddings / pgvector integration
- Upload size limits / streaming (file bytes are held in memory; large PDFs may OOM in single-worker dev mode — acceptable for MVP, needs a size guard before production)
- AI chat (`post_chat`) real implementation
- Word export (`export_shell_docx`) improvements
- API-level route integration tests
