"""
Pydantic v2 schemas for TLF Shell Generator API.

Mirrors SQLAlchemy models in models.py.  Used for request validation,
response serialisation, and OpenAPI docs.

Column / row / footnote shapes
───────────────────────────────
columns:   list[ColumnDef]   – ordered list, used in both Shell and GlobalRequirement
rows:      list[RowDef]      – hierarchical variable/parameter rows with stat info
footnotes: list[str]         – plain strings, ordered, cited in rendered table
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums (kept in sync with SQLAlchemy Enum columns)
# ---------------------------------------------------------------------------

class DocumentType(str, Enum):
    sap = "sap"
    protocol = "protocol"
    tlf_library = "tlf_library"
    study_tlf_list = "study_tlf_list"
    other = "other"


class DocumentStatus(str, Enum):
    uploading = "uploading"
    processing = "processing"
    ready = "ready"
    error = "error"


class TLFType(str, Enum):
    table = "table"
    listing = "listing"
    figure = "figure"


class TLFStatus(str, Enum):
    proposed = "proposed"
    approved = "approved"


class ShellStatus(str, Enum):
    draft = "draft"
    in_review = "in_review"
    approved = "approved"


class MessageRole(str, Enum):
    user = "user"
    ai = "ai"


class ActionType(str, Enum):
    # Row-level edits (PRD §4.4.1)
    add_row = "add_row"
    delete_row = "delete_row"
    update_row = "update_row"
    reorder_rows = "reorder_rows"
    # Column-level edits
    add_column = "add_column"
    delete_column = "delete_column"
    update_column = "update_column"
    # Header / metadata
    update_title = "update_title"
    update_subtitle = "update_subtitle"
    update_population = "update_population"
    # Footnotes
    add_footnote = "add_footnote"
    update_footnote = "update_footnote"
    delete_footnote = "delete_footnote"
    # Lifecycle
    update_status = "update_status"
    approve_shell = "approve_shell"
    reject_shell = "reject_shell"
    # AI events
    ai_suggestion = "ai_suggestion"
    ai_variable_flagged = "ai_variable_flagged"
    ai_reviewer_correction = "ai_reviewer_correction"


# ---------------------------------------------------------------------------
# Shared sub-schemas (JSONB fields)
# ---------------------------------------------------------------------------

class ColumnDef(BaseModel):
    """One column header entry stored in Shell.columns / GlobalRequirement.columns."""
    key: str = Field(..., description="Machine-readable key, e.g. 'arm_a'")
    label: str = Field(..., description="Display label, e.g. 'ARM A'")
    width: Optional[int] = Field(None, description="Pixel/unit width hint for renderer")
    align: str = Field("left", description="'left' | 'center' | 'right'")


class RowDef(BaseModel):
    """
    One variable / parameter row in a shell.
    ai_suggested=True + confirmed=False → shown as 'AI-suggested (unconfirmed)'
    per PRD §4.4 Variable Review Round.
    """
    id: Optional[str] = Field(None, description="Stable row identifier for diff tracking")
    label: str
    type: Optional[str] = Field(None, description="'numeric' | 'categorical' | 'header'")
    stat: Optional[str] = Field(None, description="e.g. 'Mean (SD)', 'n (%)'")
    indent: int = Field(0, ge=0, description="Hierarchy indent level (0 = top)")
    is_header: bool = False
    confirmed: bool = True
    ai_suggested: bool = False
    section_ref: Optional[str] = Field(None, description="SAP/protocol section reference")


# ---------------------------------------------------------------------------
# Study
# ---------------------------------------------------------------------------

class StudyCreate(BaseModel):
    name: str = Field(..., min_length=1, description="Human-readable study name, e.g. 'StudyXYZ'")


class StudyRead(BaseModel):
    id: str
    name: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class StudyList(BaseModel):
    studies: List[StudyRead]
    total: int


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------

class DocumentRead(BaseModel):
    id: str
    study_id: str
    name: str
    original_filename: Optional[str] = None
    type: DocumentType
    label: Optional[str] = None
    status: DocumentStatus
    error_message: Optional[str] = None
    file_size: Optional[int] = None
    content_type: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DocumentUpdate(BaseModel):
    """Allowed metadata updates after upload (type reclassification, label)."""
    name: Optional[str] = None
    label: Optional[str] = None
    type: Optional[DocumentType] = None


class DocumentList(BaseModel):
    documents: List[DocumentRead]
    total: int


# ---------------------------------------------------------------------------
# TLF list
# ---------------------------------------------------------------------------

class TLFCreate(BaseModel):
    number: str = Field(..., description="TLF number, e.g. '14.1.1'")
    title: str
    type: TLFType = TLFType.table
    section_ref: Optional[str] = Field(None, description="SAP section reference, e.g. 'SAP 12.1'")
    status: TLFStatus = TLFStatus.proposed
    order_index: int = Field(0, ge=0)


class TLFRead(BaseModel):
    id: str
    study_id: str
    number: str
    title: str
    type: TLFType
    section_ref: Optional[str] = None
    status: TLFStatus
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TLFUpdate(BaseModel):
    number: Optional[str] = None
    title: Optional[str] = None
    type: Optional[TLFType] = None
    section_ref: Optional[str] = None
    status: Optional[TLFStatus] = None
    order_index: Optional[int] = None


class TLFListBulkUpdate(BaseModel):
    """
    Replace the entire TLF list for a study (PUT /studies/{id}/tlf-list).
    Existing TLFs not present in the payload are deleted.
    """
    tlfs: List[TLFCreate]


class TLFList(BaseModel):
    tlfs: List[TLFRead]
    total: int


# ---------------------------------------------------------------------------
# Shell
# ---------------------------------------------------------------------------

class ShellCreate(BaseModel):
    tlf_id: Optional[str] = Field(None, description="Optional TLF entry this shell belongs to")
    type: TLFType = TLFType.table
    title: str
    subtitle: Optional[str] = None
    population: Optional[str] = Field(None, description="e.g. 'Full Analysis Set'")
    columns: List[Dict[str, Any]] = Field(default_factory=list)
    rows: List[Dict[str, Any]] = Field(default_factory=list)
    footnotes: List[str] = Field(default_factory=list)


class ShellRead(BaseModel):
    id: str
    study_id: str
    tlf_id: Optional[str] = None
    type: TLFType
    title: str
    subtitle: Optional[str] = None
    population: Optional[str] = None
    columns: List[Dict[str, Any]]
    rows: List[Dict[str, Any]]
    footnotes: List[str]
    status: ShellStatus
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShellUpdate(BaseModel):
    """
    Partial update for updateActiveShell (PUT /studies/{id}/shells/{shell_id}).
    All fields optional — only provided fields are changed.
    """
    type: Optional[TLFType] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    population: Optional[str] = None
    columns: Optional[List[Dict[str, Any]]] = None
    rows: Optional[List[Dict[str, Any]]] = None
    footnotes: Optional[List[str]] = None
    status: Optional[ShellStatus] = None


class ShellList(BaseModel):
    shells: List[ShellRead]
    total: int


# ---------------------------------------------------------------------------
# Global Requirements
# ---------------------------------------------------------------------------

class GlobalRequirementCreate(BaseModel):
    section_type: str = Field(..., description="e.g. 'demographics', 'safety', 'efficacy'")
    number_pattern: Optional[str] = Field(None, description="e.g. '14.1.x'")
    title_template: Optional[str] = Field(None, description="e.g. '{title} by Treatment Arm'")
    subtitle_template: Optional[str] = None
    columns: List[Dict[str, Any]] = Field(default_factory=list)


class GlobalRequirementRead(BaseModel):
    id: str
    study_id: str
    section_type: str
    number_pattern: Optional[str] = None
    title_template: Optional[str] = None
    subtitle_template: Optional[str] = None
    columns: List[Dict[str, Any]]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GlobalRequirementUpdate(BaseModel):
    section_type: Optional[str] = None
    number_pattern: Optional[str] = None
    title_template: Optional[str] = None
    subtitle_template: Optional[str] = None
    columns: Optional[List[Dict[str, Any]]] = None


class GlobalRequirementList(BaseModel):
    requirements: List[GlobalRequirementRead]
    total: int


# ---------------------------------------------------------------------------
# Message / Chat
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    """POST /studies/{id}/chat — user sends a message with optional TLF/shell context."""
    tlf_id: Optional[str] = Field(None, description="Scopes conversation to a specific TLF")
    shell_id: Optional[str] = Field(None, description="Scopes conversation to a specific shell")
    prompt: str = Field(..., min_length=1, description="User's natural language message")
    # Extensible target-based routing (alternative to tlf_id/shell_id)
    target: Optional[str] = Field(None, description="Routing target type: 'shell' | 'tlf' | 'study'")
    target_id: Optional[str] = Field(None, description="ID of the target entity")


class MessageRead(BaseModel):
    id: str
    study_id: str
    tlf_id: Optional[str] = None
    shell_id: Optional[str] = None
    role: MessageRole
    text: str
    extra_metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime

    model_config = {"from_attributes": True}


class ChatResponse(BaseModel):
    """Returned by POST /studies/{id}/chat — includes stored user msg + AI reply."""
    user_message: MessageRead
    ai_message: MessageRead


class MessageList(BaseModel):
    messages: List[MessageRead]
    total: int


# ---------------------------------------------------------------------------
# Action / Audit
# ---------------------------------------------------------------------------

class ActionCreate(BaseModel):
    tlf_id: Optional[str] = None
    shell_id: Optional[str] = None
    type: ActionType
    target: Optional[str] = Field(None, description="e.g. 'row:3', 'column:arm_a'")
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    actor: str = Field("user", description="'user' | 'ai'")


class ActionRead(BaseModel):
    id: str
    study_id: str
    tlf_id: Optional[str] = None
    shell_id: Optional[str] = None
    type: ActionType
    target: Optional[str] = None
    before_state: Optional[Dict[str, Any]] = None
    after_state: Optional[Dict[str, Any]] = None
    actor: str
    timestamp: datetime

    model_config = {"from_attributes": True}


class ActionList(BaseModel):
    actions: List[ActionRead]
    total: int


# ---------------------------------------------------------------------------
# TLFListItem schemas
# ---------------------------------------------------------------------------

class TLFListItemRead(BaseModel):
    id: str
    study_id: str
    number: str
    output_type: Optional[str] = None
    section: Optional[str] = None
    raw_title: Optional[str] = None
    source: str
    extraction_notes: Optional[str] = None
    title: str
    subtitle: Optional[str] = None
    analysis_set: Optional[str] = None
    composed_title: str
    title_source: Optional[str] = None
    subtitle_source: Optional[str] = None
    analysis_set_source: Optional[str] = None
    parsing_confidence: str
    status: str
    approved: bool
    order_index: int
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}

class TLFListItemCreate(BaseModel):
    number: str
    title: str
    subtitle: Optional[str] = None
    analysis_set: Optional[str] = None
    raw_title: Optional[str] = None
    section: Optional[str] = "other"
    output_type: Optional[str] = "table"
    source: str = "user"
    order_index: int = 0

class TLFListItemUpdate(BaseModel):
    number: Optional[str] = None
    title: Optional[str] = None
    subtitle: Optional[str] = None
    analysis_set: Optional[str] = None
    section: Optional[str] = None
    output_type: Optional[str] = None
    status: Optional[str] = None
    approved: Optional[bool] = None
    order_index: Optional[int] = None

class TLFListResponse(BaseModel):
    items: List[TLFListItemRead]
    total: int
    approved_count: int

class BulkUpdateAnalysisSetRequest(BaseModel):
    item_ids: List[str]
    analysis_set: str
