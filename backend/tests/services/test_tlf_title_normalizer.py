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


def test_confidence_medium_title_only_no_analysis_set():
    # title present and explicit (parsed_from_raw_title), no subtitle, no analysis_set.
    # Trace: title_explicit=True, subtitle_source=None → subtitle_explicit=True (missing is OK),
    # analysis_set_source=None → aset_explicit=False.
    # First branch: title_explicit AND (not subtitle OR subtitle_explicit) AND (not analysis_set OR aset_explicit)
    #   = True AND (True) AND (True) → enters branch.
    # Inside: analysis_set is falsy, subtitle is falsy → returns "medium".
    result = _calculate_confidence(
        title="Demographics", subtitle=None, analysis_set=None,
        title_source="parsed_from_raw_title", subtitle_source=None,
        analysis_set_source=None,
    )
    assert result == "medium"


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
    # subtitle and analysis_set come in via user_subtitle/user_analysis_set,
    # so their source is "user_edit" (the uploaded-source override only fires
    # when the source is NOT already "user_edit")
    assert result["subtitle_source"] == "user_edit"
    assert result["analysis_set_source"] == "user_edit"


def test_uploaded_row_combined_title():
    row = {"raw_title": "Adverse Events by SOC (Safety Population)"}
    result = normalize_uploaded_row(row)
    assert result["title"] == "Adverse Events"
    assert result["analysis_set"] == "Safety Population"
