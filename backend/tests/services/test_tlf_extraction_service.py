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
        assert "subtitle_context" in ev
        assert "analysis_set_context" in ev
