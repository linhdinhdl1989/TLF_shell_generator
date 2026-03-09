"""
TLF Shell Generator — FastAPI backend.

Start with:
    uvicorn app:app --reload

Quick smoke-test sequence:
    # 1. Create a study
    curl -s -X POST http://localhost:8000/studies \
        -H "Content-Type: application/json" \
        -d '{"name": "StudyXYZ"}' | jq .

    # 2. Upload a document (multipart)
    curl -s -X POST http://localhost:8000/studies/{study_id}/documents \
        -F "file=@sap.pdf" \
        -F "type=sap" | jq .

    # 3. Get the TLF list (empty until extracted/added)
    curl -s http://localhost:8000/studies/{study_id}/tlf-list | jq .

    # 4. Add a TLF entry manually
    curl -s -X POST http://localhost:8000/studies/{study_id}/tlf-list \
        -H "Content-Type: application/json" \
        -d '{"number":"14.1.1","title":"Demographics","type":"table","section_ref":"SAP 12.1"}' | jq .

    # 5. Create a shell for a TLF
    curl -s -X POST http://localhost:8000/studies/{study_id}/shells \
        -H "Content-Type: application/json" \
        -d '{"tlf_id":"{tlf_id}","title":"Demographics by ARM"}' | jq .

    # 6. Send a chat message
    curl -s -X POST http://localhost:8000/studies/{study_id}/chat \
        -H "Content-Type: application/json" \
        -d '{"prompt":"Add a footnote referencing SAP Section 12.1"}' | jq .

All routes are scoped to a study_id for RLS-readiness.
"""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime
from typing import List, Optional

from fastapi import (
    BackgroundTasks,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db, init_db
from models import Action, Document, GlobalRequirement, Message, Shell, Study, TLF
from schemas import (
    ActionCreate,
    ActionList,
    ActionRead,
    ChatRequest,
    ChatResponse,
    DocumentList,
    DocumentRead,
    DocumentType,
    DocumentUpdate,
    GlobalRequirementCreate,
    GlobalRequirementList,
    GlobalRequirementRead,
    GlobalRequirementUpdate,
    MessageList,
    MessageRead,
    ShellCreate,
    ShellList,
    ShellRead,
    ShellUpdate,
    StudyCreate,
    StudyList,
    StudyRead,
    TLFCreate,
    TLFList,
    TLFListBulkUpdate,
    TLFRead,
    TLFUpdate,
)


# ---------------------------------------------------------------------------
# App lifecycle
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialise DB tables on startup (dev/SQLite).  Use Alembic in prod."""
    await init_db()
    yield


app = FastAPI(
    title="TLF Shell Generator API",
    description=(
        "Backend for the AI-powered TLF mock shell generator. "
        "All routes are study-scoped for RLS readiness.  "
        "See PRD v1.8 for full feature description."
    ),
    version="0.1.0",
    lifespan=lifespan,
)

# Allow the React dev server (and any local origin) to call the API.
# Restrict CORS_ORIGINS in production via environment variable.
_ALLOWED_ORIGINS: List[str] = os.getenv(
    "CORS_ORIGINS", "http://localhost:3000,http://localhost:5173"
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _not_found(entity: str, id_: str) -> HTTPException:
    return HTTPException(status_code=404, detail=f"{entity} '{id_}' not found.")


async def _get_study(study_id: str, db: AsyncSession) -> Study:
    row = await db.get(Study, study_id)
    if row is None:
        raise _not_found("Study", study_id)
    return row


async def _get_tlf(study_id: str, tlf_id: str, db: AsyncSession) -> TLF:
    row = await db.get(TLF, tlf_id)
    if row is None or row.study_id != study_id:
        raise _not_found("TLF", tlf_id)
    return row


async def _get_shell(study_id: str, shell_id: str, db: AsyncSession) -> Shell:
    row = await db.get(Shell, shell_id)
    if row is None or row.study_id != study_id:
        raise _not_found("Shell", shell_id)
    return row


async def _log_action(
    db: AsyncSession,
    *,
    study_id: str,
    action_type: str,
    tlf_id: Optional[str] = None,
    shell_id: Optional[str] = None,
    target: Optional[str] = None,
    before: Optional[dict] = None,
    after: Optional[dict] = None,
    actor: str = "user",
) -> Action:
    """Create an Action (audit trail) row inside the current session."""
    entry = Action(
        id=str(uuid.uuid4()),
        study_id=study_id,
        tlf_id=tlf_id,
        shell_id=shell_id,
        type=action_type,
        target=target,
        before_state=before,
        after_state=after,
        actor=actor,
        timestamp=datetime.utcnow(),
    )
    db.add(entry)
    return entry


# ---------------------------------------------------------------------------
# Background task: document parse stub  (PRD §4.7)
# ---------------------------------------------------------------------------

async def _parse_document_stub(doc_id: str) -> None:
    """
    Stub for the parse-once pipeline (PRD §4.7).

    Real implementation would:
      1. Retrieve raw bytes from temporary storage.
      2. Extract text (pdfplumber / python-docx / openpyxl).
      3. Fallback OCR for scanned PDFs.
      4. Split into chunks with section_ref tags.
      5. Embed chunks (pgvector / external API).
      6. Store parsed_content + chunks_meta on Document row.
      7. Delete raw file.
      8. Set status = "ready" (or "error" on failure).

    The stub simply marks the document as "ready" after a simulated delay.
    Replace with a Celery/ARQ/BackgroundTasks task in production.
    """
    import asyncio

    # Simulate I/O work (parsing, embedding)
    await asyncio.sleep(0.5)

    # Re-open a fresh session — background tasks run outside the request session
    from database import AsyncSessionLocal

    async with AsyncSessionLocal() as session:
        doc = await session.get(Document, doc_id)
        if doc is None:
            return
        if doc.status == "processing":
            doc.parsed_content = (
                f"[STUB] Parsed content for document '{doc.name}' "
                "(replace with real extraction pipeline)"
            )
            doc.chunks_meta = [
                {
                    "chunk_id": str(uuid.uuid4()),
                    "section_ref": "Section 1",
                    "text": f"[STUB] Chunk 1 from {doc.name}",
                    "embedding_id": None,
                }
            ]
            doc.status = "ready"
            doc.updated_at = datetime.utcnow()
            await session.commit()


# ---------------------------------------------------------------------------
# Root
# ---------------------------------------------------------------------------

@app.get("/", tags=["Health"])
async def root():
    """Health check / API root."""
    return {
        "service": "TLF Shell Generator API",
        "version": "0.1.0",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok"}


# ===========================================================================
# Studies
# ===========================================================================

@app.post(
    "/studies",
    response_model=StudyRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Studies"],
    summary="Create a new study",
)
async def create_study(
    body: StudyCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    POST /studies  →  {id, name, created_at, updated_at}

    Example:
        curl -X POST /studies -d '{"name": "StudyXYZ"}'
    """
    study = Study(id=str(uuid.uuid4()), name=body.name)
    db.add(study)
    await db.flush()
    await db.refresh(study)
    return study


@app.get(
    "/studies",
    response_model=StudyList,
    tags=["Studies"],
    summary="List all studies",
)
async def list_studies(
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    total_result = await db.execute(select(func.count(Study.id)))
    total = total_result.scalar_one()

    result = await db.execute(
        select(Study).order_by(Study.created_at.desc()).offset(skip).limit(limit)
    )
    rows = result.scalars().all()
    return StudyList(studies=list(rows), total=total)


@app.get(
    "/studies/{study_id}",
    response_model=StudyRead,
    tags=["Studies"],
    summary="Get a study by ID",
)
async def get_study(study_id: str, db: AsyncSession = Depends(get_db)):
    return await _get_study(study_id, db)


# ===========================================================================
# Documents
# ===========================================================================

@app.post(
    "/studies/{study_id}/documents",
    response_model=DocumentRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Documents"],
    summary="Upload a document (multipart)",
)
async def upload_document(
    study_id: str,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    type: DocumentType = Form(...),
    label: Optional[str] = Form(None, description="Human label for 'other' type"),
    db: AsyncSession = Depends(get_db),
):
    """
    POST /studies/{study_id}/documents

    Multipart form fields:
      - file   : the binary file
      - type   : sap | protocol | tlf_library | study_tlf_list | other
      - label  : (optional) free-text label for 'other' documents

    Returns the document record with status='processing'.
    A background task moves it to 'ready' after parsing.

    Example:
        curl -X POST /studies/{id}/documents \\
            -F "file=@sap.pdf" \\
            -F "type=sap"
    """
    await _get_study(study_id, db)

    file_bytes = await file.read()
    doc = Document(
        id=str(uuid.uuid4()),
        study_id=study_id,
        name=file.filename or "untitled",
        original_filename=file.filename,
        type=type.value,
        label=label,
        status="processing",
        file_size=len(file_bytes),
        content_type=file.content_type,
    )
    db.add(doc)
    await db.flush()
    await db.refresh(doc)

    # Fire-and-forget parse pipeline (stub)
    background_tasks.add_task(_parse_document_stub, doc.id)

    return doc


@app.get(
    "/studies/{study_id}/documents",
    response_model=DocumentList,
    tags=["Documents"],
    summary="List documents for a study",
)
async def list_documents(
    study_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    result = await db.execute(
        select(Document)
        .where(Document.study_id == study_id)
        .order_by(Document.created_at)
    )
    rows = result.scalars().all()
    return DocumentList(documents=list(rows), total=len(rows))


@app.get(
    "/studies/{study_id}/documents/{doc_id}",
    response_model=DocumentRead,
    tags=["Documents"],
    summary="Get a single document",
)
async def get_document(
    study_id: str,
    doc_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    doc = await db.get(Document, doc_id)
    if doc is None or doc.study_id != study_id:
        raise _not_found("Document", doc_id)
    return doc


@app.put(
    "/studies/{study_id}/documents/{doc_id}",
    response_model=DocumentRead,
    tags=["Documents"],
    summary="Update document metadata (name, label, type)",
)
async def update_document(
    study_id: str,
    doc_id: str,
    body: DocumentUpdate,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    doc = await db.get(Document, doc_id)
    if doc is None or doc.study_id != study_id:
        raise _not_found("Document", doc_id)

    if body.name is not None:
        doc.name = body.name
    if body.label is not None:
        doc.label = body.label
    if body.type is not None:
        doc.type = body.type.value
    doc.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(doc)
    return doc


# ===========================================================================
# TLF List
# ===========================================================================

@app.get(
    "/studies/{study_id}/tlf-list",
    response_model=TLFList,
    tags=["TLF List"],
    summary="Get the TLF list for a study",
)
async def get_tlf_list(
    study_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    GET /studies/{study_id}/tlf-list

    Returns an ordered array of TLF entries.
    If no TLF list has been uploaded, this returns an empty list.
    (Populate it via the POST endpoint or the bulk PUT endpoint.)

    Example:
        curl http://localhost:8000/studies/{study_id}/tlf-list
    """
    await _get_study(study_id, db)
    result = await db.execute(
        select(TLF)
        .where(TLF.study_id == study_id)
        .order_by(TLF.order_index, TLF.number)
    )
    rows = result.scalars().all()
    return TLFList(tlfs=list(rows), total=len(rows))


@app.post(
    "/studies/{study_id}/tlf-list",
    response_model=TLFRead,
    status_code=status.HTTP_201_CREATED,
    tags=["TLF List"],
    summary="Add a single TLF entry",
)
async def add_tlf(
    study_id: str,
    body: TLFCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    tlf = TLF(
        id=str(uuid.uuid4()),
        study_id=study_id,
        **body.model_dump(),
    )
    db.add(tlf)
    await _log_action(
        db,
        study_id=study_id,
        action_type="add_row",
        tlf_id=tlf.id,
        target=f"tlf:{tlf.number}",
        after={"number": tlf.number, "title": tlf.title},
    )
    await db.flush()
    await db.refresh(tlf)
    return tlf


@app.put(
    "/studies/{study_id}/tlf-list",
    response_model=TLFList,
    tags=["TLF List"],
    summary="Bulk-replace the TLF list (editable table save)",
)
async def bulk_replace_tlf_list(
    study_id: str,
    body: TLFListBulkUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    PUT /studies/{study_id}/tlf-list

    Replaces the entire TLF list.  Existing TLFs for this study are deleted
    and re-created from the payload.  Use this for the 'Save TLF List' action
    in the tabbed editor.

    All order_index values should be provided by the client to preserve row order.
    """
    await _get_study(study_id, db)

    # Snapshot before state for audit
    existing_result = await db.execute(
        select(TLF).where(TLF.study_id == study_id).order_by(TLF.order_index)
    )
    before_tlfs = [
        {"number": t.number, "title": t.title, "status": t.status}
        for t in existing_result.scalars().all()
    ]

    await db.execute(delete(TLF).where(TLF.study_id == study_id))

    new_tlfs: List[TLF] = []
    for item in body.tlfs:
        tlf = TLF(id=str(uuid.uuid4()), study_id=study_id, **item.model_dump())
        db.add(tlf)
        new_tlfs.append(tlf)

    after_tlfs = [{"number": t.number, "title": t.title} for t in new_tlfs]

    await _log_action(
        db,
        study_id=study_id,
        action_type="reorder_rows",
        target="tlf_list",
        before={"tlfs": before_tlfs},
        after={"tlfs": after_tlfs},
    )

    await db.flush()
    for tlf in new_tlfs:
        await db.refresh(tlf)

    return TLFList(tlfs=new_tlfs, total=len(new_tlfs))


@app.put(
    "/studies/{study_id}/tlf-list/{tlf_id}",
    response_model=TLFRead,
    tags=["TLF List"],
    summary="Update a single TLF entry",
)
async def update_tlf(
    study_id: str,
    tlf_id: str,
    body: TLFUpdate,
    db: AsyncSession = Depends(get_db),
):
    tlf = await _get_tlf(study_id, tlf_id, db)

    before = {"number": tlf.number, "title": tlf.title, "status": tlf.status}

    for field, value in body.model_dump(exclude_none=True).items():
        if hasattr(tlf, field) and value is not None:
            if hasattr(value, "value"):
                setattr(tlf, field, value.value)
            else:
                setattr(tlf, field, value)

    tlf.updated_at = datetime.utcnow()
    after = {"number": tlf.number, "title": tlf.title, "status": tlf.status}

    await _log_action(
        db,
        study_id=study_id,
        action_type="update_row",
        tlf_id=tlf_id,
        target=f"tlf:{tlf.number}",
        before=before,
        after=after,
    )

    await db.flush()
    await db.refresh(tlf)
    return tlf


@app.delete(
    "/studies/{study_id}/tlf-list/{tlf_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["TLF List"],
    summary="Delete a TLF entry",
)
async def delete_tlf(
    study_id: str,
    tlf_id: str,
    db: AsyncSession = Depends(get_db),
):
    tlf = await _get_tlf(study_id, tlf_id, db)

    await _log_action(
        db,
        study_id=study_id,
        action_type="delete_row",
        tlf_id=tlf_id,
        target=f"tlf:{tlf.number}",
        before={"number": tlf.number, "title": tlf.title},
    )

    await db.delete(tlf)


# ===========================================================================
# Global Requirements  (shell structure per section type, PRD §4.3)
# ===========================================================================

@app.get(
    "/studies/{study_id}/global-requirements",
    response_model=GlobalRequirementList,
    tags=["Global Requirements"],
    summary="Get global shell structure requirements for a study",
)
async def get_global_requirements(
    study_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    GET /studies/{study_id}/global-requirements

    Returns per-section shell structure configs (number pattern, title template,
    column headers).  Users configure these before per-shell generation (PRD §4.3).
    """
    await _get_study(study_id, db)
    result = await db.execute(
        select(GlobalRequirement)
        .where(GlobalRequirement.study_id == study_id)
        .order_by(GlobalRequirement.section_type)
    )
    rows = result.scalars().all()
    return GlobalRequirementList(requirements=list(rows), total=len(rows))


@app.post(
    "/studies/{study_id}/global-requirements",
    response_model=GlobalRequirementRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Global Requirements"],
    summary="Create a global requirement for a section type",
)
async def create_global_requirement(
    study_id: str,
    body: GlobalRequirementCreate,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    req = GlobalRequirement(
        id=str(uuid.uuid4()),
        study_id=study_id,
        **body.model_dump(),
    )
    db.add(req)
    await db.flush()
    await db.refresh(req)
    return req


@app.put(
    "/studies/{study_id}/global-requirements/{req_id}",
    response_model=GlobalRequirementRead,
    tags=["Global Requirements"],
    summary="Update a global requirement",
)
async def update_global_requirement(
    study_id: str,
    req_id: str,
    body: GlobalRequirementUpdate,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    req = await db.get(GlobalRequirement, req_id)
    if req is None or req.study_id != study_id:
        raise _not_found("GlobalRequirement", req_id)

    for field, value in body.model_dump(exclude_none=True).items():
        setattr(req, field, value)
    req.updated_at = datetime.utcnow()

    await db.flush()
    await db.refresh(req)
    return req


@app.delete(
    "/studies/{study_id}/global-requirements/{req_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Global Requirements"],
    summary="Delete a global requirement",
)
async def delete_global_requirement(
    study_id: str,
    req_id: str,
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)
    req = await db.get(GlobalRequirement, req_id)
    if req is None or req.study_id != study_id:
        raise _not_found("GlobalRequirement", req_id)
    await db.delete(req)


# ===========================================================================
# Shells  (per-shell AI-generated mock shells, PRD §4.4)
# ===========================================================================

@app.get(
    "/studies/{study_id}/shells",
    response_model=ShellList,
    tags=["Shells"],
    summary="List all shells for a study (React sidebar data)",
)
async def list_shells(
    study_id: str,
    tlf_id: Optional[str] = Query(None, description="Filter by TLF"),
    status_filter: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /studies/{study_id}/shells

    Returns all shells for the React sidebar.
    Optional query params:
      - tlf_id : show shells for a specific TLF only
      - status : draft | in_review | approved
    """
    await _get_study(study_id, db)

    stmt = select(Shell).where(Shell.study_id == study_id)
    if tlf_id:
        stmt = stmt.where(Shell.tlf_id == tlf_id)
    if status_filter:
        stmt = stmt.where(Shell.status == status_filter)

    stmt = stmt.order_by(Shell.created_at)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return ShellList(shells=list(rows), total=len(rows))


@app.post(
    "/studies/{study_id}/shells",
    response_model=ShellRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Shells"],
    summary="Create a new shell for a TLF",
)
async def create_shell(
    study_id: str,
    body: ShellCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    POST /studies/{study_id}/shells

    Creates a new shell record.  In production this would trigger the
    Biostat Expert → Builder → Reviewer AI loop (PRD §4.4).
    """
    await _get_study(study_id, db)
    await _get_tlf(study_id, body.tlf_id, db)

    shell = Shell(
        id=str(uuid.uuid4()),
        study_id=study_id,
        tlf_id=body.tlf_id,
        type=body.type.value,
        title=body.title,
        subtitle=body.subtitle,
        population=body.population,
        columns=body.columns,
        rows=body.rows,
        footnotes=body.footnotes,
        status="draft",
        ai_generation_log={"note": "AI generation stub — replace with per-shell loop"},
    )
    db.add(shell)

    await _log_action(
        db,
        study_id=study_id,
        action_type="ai_suggestion",
        tlf_id=body.tlf_id,
        shell_id=shell.id,
        target="shell",
        after={"title": shell.title, "status": shell.status},
        actor="ai",
    )

    await db.flush()
    await db.refresh(shell)
    return shell


@app.get(
    "/studies/{study_id}/shells/{shell_id}",
    response_model=ShellRead,
    tags=["Shells"],
    summary="Get a single shell",
)
async def get_shell(
    study_id: str,
    shell_id: str,
    db: AsyncSession = Depends(get_db),
):
    return await _get_shell(study_id, shell_id, db)


@app.put(
    "/studies/{study_id}/shells/{shell_id}",
    response_model=ShellRead,
    tags=["Shells"],
    summary="Update a shell (updateActiveShell)",
)
async def update_shell(
    study_id: str,
    shell_id: str,
    body: ShellUpdate,
    db: AsyncSession = Depends(get_db),
):
    """
    PUT /studies/{study_id}/shells/{shell_id}

    Partial update — only provided fields are changed.
    Logs an audit action for every field updated.
    Use to:
      - Edit title / subtitle / population
      - Replace columns / rows / footnotes after user table edits
      - Transition status (draft → in_review → approved)
    """
    shell = await _get_shell(study_id, shell_id, db)

    updates = body.model_dump(exclude_none=True)
    for field, new_value in updates.items():
        old_value = getattr(shell, field, None)
        # Resolve enum → string for storage
        store_value = new_value.value if hasattr(new_value, "value") else new_value
        setattr(shell, field, store_value)

        # Choose a meaningful action_type for the audit log
        action_map = {
            "title": "update_title",
            "subtitle": "update_subtitle",
            "population": "update_population",
            "columns": "update_column",
            "rows": "update_row",
            "footnotes": "update_footnote",
            "status": "update_status",
        }
        action_type = action_map.get(field, "update_row")

        await _log_action(
            db,
            study_id=study_id,
            action_type=action_type,
            tlf_id=shell.tlf_id,
            shell_id=shell_id,
            target=field,
            before={field: old_value},
            after={field: store_value},
        )

    shell.updated_at = datetime.utcnow()
    await db.flush()
    await db.refresh(shell)
    return shell


@app.delete(
    "/studies/{study_id}/shells/{shell_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["Shells"],
    summary="Delete a shell",
)
async def delete_shell(
    study_id: str,
    shell_id: str,
    db: AsyncSession = Depends(get_db),
):
    shell = await _get_shell(study_id, shell_id, db)
    await _log_action(
        db,
        study_id=study_id,
        action_type="reject_shell",
        tlf_id=shell.tlf_id,
        shell_id=shell_id,
        target="shell",
        before={"title": shell.title, "status": shell.status},
    )
    await db.delete(shell)


# ===========================================================================
# Chat  (AI interaction log, PRD §5.1)
# ===========================================================================

@app.post(
    "/studies/{study_id}/chat",
    response_model=ChatResponse,
    status_code=status.HTTP_201_CREATED,
    tags=["Chat"],
    summary="Send a message and get an AI response stub",
)
async def post_chat(
    study_id: str,
    body: ChatRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    POST /studies/{study_id}/chat

    Stores the user message and a stub AI response.
    In production: forward context + prompt to the per-shell AI loop
    (Biostat Expert → Builder → Reviewer, PRD §4.4), then stream reply.

    Body:
        {
            "tlf_id":   "optional-tlf-uuid",
            "shell_id": "optional-shell-uuid",
            "prompt":   "Add a footnote referencing SAP Section 12.1"
        }
    """
    await _get_study(study_id, db)

    # Persist user message
    user_msg = Message(
        id=str(uuid.uuid4()),
        study_id=study_id,
        tlf_id=body.tlf_id,
        shell_id=body.shell_id,
        role="user",
        text=body.prompt,
        timestamp=datetime.utcnow(),
    )
    db.add(user_msg)

    # --- AI stub -------------------------------------------------------
    # Real implementation: retrieve top-k chunks from parsed documents,
    # run multi-role AI loop, return structured shell update + explanation.
    ai_text = (
        f'[AI STUB] Received: "{body.prompt}". '
        "In production this triggers the Biostat Expert -> Builder -> "
        "Reviewer loop and returns structured shell updates."
    )
    ai_msg = Message(
        id=str(uuid.uuid4()),
        study_id=study_id,
        tlf_id=body.tlf_id,
        shell_id=body.shell_id,
        role="ai",
        text=ai_text,
        timestamp=datetime.utcnow(),
        metadata={
            "model": "stub",
            "retrieved_chunks": [],
            "confidence": None,
        },
    )
    db.add(ai_msg)
    # -------------------------------------------------------------------

    await db.flush()
    await db.refresh(user_msg)
    await db.refresh(ai_msg)

    return ChatResponse(
        user_message=MessageRead.model_validate(user_msg),
        ai_message=MessageRead.model_validate(ai_msg),
    )


@app.get(
    "/studies/{study_id}/chat",
    response_model=MessageList,
    tags=["Chat"],
    summary="Get chat history for a study (optionally filtered by TLF/shell)",
)
async def get_chat_history(
    study_id: str,
    tlf_id: Optional[str] = Query(None),
    shell_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
):
    await _get_study(study_id, db)

    stmt = (
        select(Message)
        .where(Message.study_id == study_id)
        .order_by(Message.timestamp)
    )
    if tlf_id:
        stmt = stmt.where(Message.tlf_id == tlf_id)
    if shell_id:
        stmt = stmt.where(Message.shell_id == shell_id)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return MessageList(messages=list(rows), total=len(rows))


# ===========================================================================
# Audit trail  (GxP-style action log, PRD §5.1)
# ===========================================================================

@app.get(
    "/studies/{study_id}/audit",
    response_model=ActionList,
    tags=["Audit"],
    summary="Get the audit trail for a study",
)
async def get_audit_trail(
    study_id: str,
    tlf_id: Optional[str] = Query(None),
    shell_id: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(200, ge=1, le=1000),
    db: AsyncSession = Depends(get_db),
):
    """
    GET /studies/{study_id}/audit

    Returns every logged action (user edits + AI suggestions).
    Exportable to CSV for the compliance audit log (PRD §3.1).
    """
    await _get_study(study_id, db)

    stmt = (
        select(Action)
        .where(Action.study_id == study_id)
        .order_by(Action.timestamp.desc())
    )
    if tlf_id:
        stmt = stmt.where(Action.tlf_id == tlf_id)
    if shell_id:
        stmt = stmt.where(Action.shell_id == shell_id)

    stmt = stmt.offset(skip).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return ActionList(actions=list(rows), total=len(rows))


@app.post(
    "/studies/{study_id}/audit",
    response_model=ActionRead,
    status_code=status.HTTP_201_CREATED,
    tags=["Audit"],
    summary="Log a manual audit action",
)
async def log_audit_action(
    study_id: str,
    body: ActionCreate,
    db: AsyncSession = Depends(get_db),
):
    """
    POST /studies/{study_id}/audit

    Explicitly log a user or AI action (e.g. direct table edits from React UI).
    The backend also logs actions automatically on shell/TLF mutations.
    """
    await _get_study(study_id, db)

    action = await _log_action(
        db,
        study_id=study_id,
        action_type=body.type.value,
        tlf_id=body.tlf_id,
        shell_id=body.shell_id,
        target=body.target,
        before=body.before_state,
        after=body.after_state,
        actor=body.actor,
    )
    await db.flush()
    await db.refresh(action)
    return action
