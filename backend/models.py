"""
SQLAlchemy ORM models for TLF Shell Generator.

All tables carry study_id for Row-Level Security (RLS) readiness.
JSON columns map to JSONB in Postgres and JSON in SQLite (dev).

Test flow:
    curl -X POST /studies -d '{"name": "StudyXYZ"}' -> study_id
    curl -X POST /studies/{study_id}/documents -F "file=@sap.pdf" -F "type=sap"
    curl -X GET /studies/{study_id}/tlf-list
"""

import uuid
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy.types import JSON


def _uuid() -> str:
    return str(uuid.uuid4())


class Base(DeclarativeBase):
    pass


# ---------------------------------------------------------------------------
# Study
# ---------------------------------------------------------------------------

class Study(Base):
    """Top-level entity; all other records are scoped by study_id."""
    __tablename__ = "studies"

    id = Column(String, primary_key=True, default=_uuid)
    name = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    documents = relationship("Document", back_populates="study", cascade="all, delete-orphan")
    tlfs = relationship("TLF", back_populates="study", cascade="all, delete-orphan", order_by="TLF.order_index")
    global_requirements = relationship("GlobalRequirement", back_populates="study", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="study", cascade="all, delete-orphan")
    actions = relationship("Action", back_populates="study", cascade="all, delete-orphan")


# ---------------------------------------------------------------------------
# Document
# ---------------------------------------------------------------------------

class Document(Base):
    """
    Document metadata only.  Raw files are deleted after parsing (PRD §4.7).
    parsed_content holds extracted text for per-shell chunk retrieval.
    """
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=_uuid)
    study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String, nullable=False)           # display name
    original_filename = Column(String)              # original upload filename
    type = Column(
        Enum(
            "sap", "protocol", "tlf_library", "study_tlf_list", "other",
            name="document_type",
        ),
        nullable=False,
    )
    # "other" documents may carry a free-text label (PRD §3.1.1)
    label = Column(String)

    status = Column(
        Enum(
            "uploading", "processing", "ready", "error",
            name="document_status",
        ),
        nullable=False,
        default="uploading",
    )
    error_message = Column(String)

    # Stored after parse-once pipeline; raw file is discarded (PRD §4.7)
    parsed_content = Column(Text)
    # Chunk metadata stored as JSON list of {chunk_id, section_ref, text, embedding_id}
    chunks_meta = Column(JSON, default=list)

    file_size = Column(Integer)
    content_type = Column(String)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    study = relationship("Study", back_populates="documents")


# ---------------------------------------------------------------------------
# TLF  (Table / Listing / Figure entry in the approved TLF list)
# ---------------------------------------------------------------------------

class TLF(Base):
    """
    One row in the study TLF list.  Drives per-shell generation (PRD §4.2).
    status: proposed → approved (user must approve list before generation).
    """
    __tablename__ = "tlfs"

    id = Column(String, primary_key=True, default=_uuid)
    study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)

    number = Column(String, nullable=False)          # e.g. "14.1.1"
    title = Column(String, nullable=False)
    type = Column(
        Enum("table", "listing", "figure", name="tlf_type"),
        nullable=False,
        default="table",
    )
    section_ref = Column(String)                     # e.g. "SAP Section 12.1"
    status = Column(
        Enum("proposed", "approved", name="tlf_status"),
        nullable=False,
        default="proposed",
    )
    order_index = Column(Integer, default=0, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    study = relationship("Study", back_populates="tlfs")
    shells = relationship("Shell", back_populates="tlf", cascade="all, delete-orphan")
    messages = relationship("Message", back_populates="tlf")
    actions = relationship("Action", back_populates="tlf")


# ---------------------------------------------------------------------------
# Shell  (the AI-generated TLF mock shell)
# ---------------------------------------------------------------------------

class Shell(Base):
    """
    Internal JSON shell stored after the Biostat Expert → Builder → Reviewer
    loop (PRD §4.4).  Users see a rendered table preview, not raw JSON.

    columns: list[dict]  e.g. [{"key": "arm_a", "label": "ARM A", "width": 80}]
    rows:    list[dict]  e.g. [{"id": "r1", "label": "Age (years)", "type":
                                "numeric", "stat": "Mean (SD)", "indent": 0,
                                "is_header": false, "confirmed": true,
                                "ai_suggested": false, "section_ref": "SAP 12.1"}]
    footnotes: list[str]
    """
    __tablename__ = "shells"

    id = Column(String, primary_key=True, default=_uuid)
    study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)
    tlf_id = Column(String, ForeignKey("tlfs.id", ondelete="SET NULL"), nullable=True, index=True)

    type = Column(
        Enum("table", "listing", "figure", name="shell_type"),
        nullable=False,
        default="table",
    )
    title = Column(String, nullable=False)
    subtitle = Column(String)
    population = Column(String)                      # e.g. "Full Analysis Set"

    # JSONB in Postgres, JSON in SQLite
    columns = Column(JSON, default=list, nullable=False)
    rows = Column(JSON, default=list, nullable=False)
    footnotes = Column(JSON, default=list, nullable=False)

    status = Column(
        Enum("draft", "in_review", "approved", name="shell_status"),
        nullable=False,
        default="draft",
    )

    # Internal: AI generation reasoning log (Biostat Expert / Builder / Reviewer)
    ai_generation_log = Column(JSON, default=dict)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    study = relationship("Study")
    tlf = relationship("TLF", back_populates="shells")
    messages = relationship("Message", back_populates="shell")
    actions = relationship("Action", back_populates="shell")


# ---------------------------------------------------------------------------
# GlobalRequirement  (per-section shell structure configuration, PRD §4.3)
# ---------------------------------------------------------------------------

class GlobalRequirement(Base):
    """
    Stores the section-level shell structure the user configures before
    per-shell generation (number pattern, title/subtitle templates, columns).

    columns: list[dict]  e.g. [{"key": "arm_a", "label": "ARM A"},
                                {"key": "arm_b", "label": "ARM B"},
                                {"key": "total",  "label": "Total"}]
    """
    __tablename__ = "global_requirements"

    id = Column(String, primary_key=True, default=_uuid)
    study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)

    section_type = Column(String, nullable=False)    # e.g. "demographics", "safety", "efficacy"
    number_pattern = Column(String)                  # e.g. "14.1.x"
    title_template = Column(String)                  # e.g. "{title} by Treatment Arm"
    subtitle_template = Column(String)

    # Column headers shared across all shells of this section type
    columns = Column(JSON, default=list, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    study = relationship("Study", back_populates="global_requirements")


# ---------------------------------------------------------------------------
# Message  (chat history: user ↔ AI, PRD §5.1)
# ---------------------------------------------------------------------------

class Message(Base):
    """
    Stores both free-text user prompts and AI responses for a study/TLF/shell
    context.  Drives the AI chat panel and audit trail.
    """
    __tablename__ = "messages"

    id = Column(String, primary_key=True, default=_uuid)
    study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)
    tlf_id = Column(String, ForeignKey("tlfs.id", ondelete="SET NULL"), nullable=True, index=True)
    shell_id = Column(String, ForeignKey("shells.id", ondelete="SET NULL"), nullable=True, index=True)

    role = Column(
        Enum("user", "ai", name="message_role"),
        nullable=False,
    )
    text = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Optional: structured metadata attached by AI (chunk refs, confidence)
    extra_metadata = Column(JSON, default=dict)

    study = relationship("Study", back_populates="messages")
    tlf = relationship("TLF", back_populates="messages")
    shell = relationship("Shell", back_populates="messages")


# ---------------------------------------------------------------------------
# Action  (GxP-style audit trail of every user edit + AI suggestion, PRD §5.1)
# ---------------------------------------------------------------------------

class Action(Base):
    """
    Immutable audit log entry.  Every row/column/title/footnote change and
    every AI suggestion is captured here with before/after JSON snapshots.

    type values cover PRD §4.4.1 direct table edits plus AI loop events.
    actor: "user" | "ai" — who initiated the change.
    """
    __tablename__ = "actions"

    id = Column(String, primary_key=True, default=_uuid)
    study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True)
    tlf_id = Column(String, ForeignKey("tlfs.id", ondelete="SET NULL"), nullable=True, index=True)
    shell_id = Column(String, ForeignKey("shells.id", ondelete="SET NULL"), nullable=True, index=True)

    # Using String instead of Enum to support extensible action types without
    # requiring a DB migration every time a new event category is added.
    type = Column(String, nullable=False)

    # Human-readable target, e.g. "row:3", "column:arm_a", "footnote:0"
    target = Column(String)

    # JSON snapshots for full diff / rollback capability
    before_state = Column(JSON)
    after_state = Column(JSON)

    actor = Column(String, nullable=False, default="user")   # "user" | "ai"
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    # Enriched fields for human-readable audit event display
    summary = Column(String)          # e.g. "Shell title updated: 'Demographics...'"
    entity_type = Column(String)      # e.g. "shell" | "tlf_list" | "global_requirements"

    study = relationship("Study", back_populates="actions")
    tlf = relationship("TLF", back_populates="actions")
    shell = relationship("Shell", back_populates="actions")
