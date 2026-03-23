# CODEBASE MAP — TLF Shell Generator

> Generated: 2026-03-22
> Codebase status: MVP scaffolding complete; AI integration, document parsing, and export are stubs.

---

## 1. Directory Structure

```
TLF_shell_generator-main/
│
├── backend/                        # FastAPI application (Python 3.12)
│   ├── app.py                      # All route handlers + helper functions (2544 lines)
│   ├── models.py                   # SQLAlchemy ORM models (349 lines)
│   ├── schemas.py                  # Pydantic v2 request/response schemas (486 lines)
│   ├── database.py                 # Async engine, session factory, init_db (136 lines)
│   ├── services/
│   │   ├── __init__.py             # Empty package marker
│   │   ├── tlf_extraction_service.py  # Regex-based TLF candidate extraction from SAP (192 lines)
│   │   └── tlf_title_normalizer.py    # Title parsing + confidence + provenance (238 lines)
│   ├── requirements.txt            # Python dependencies (with commented stubs for Phase 2)
│   ├── Dockerfile                  # Multi-stage build (builder + runtime, non-root user)
│   ├── docker-compose.yml          # Postgres (pgvector/pg16) + FastAPI API service
│   └── .env.example                # Environment variable template
│
├── frontend/                       # React 18 + Vite 5 (Node 20)
│   ├── src/
│   │   ├── main.jsx                # React entry point; mounts StudyPage with hardcoded studyId="XYZ-101"
│   │   ├── StudyPage.jsx           # Master container with 5 tabs (2669 lines)
│   │   ├── TLFListTab.jsx          # TLF list management component (829 lines)
│   │   └── index.css               # Tailwind directives + global body style
│   ├── index.html                  # HTML shell; loads Inter font from Google Fonts
│   ├── package.json                # Dependencies: react, lucide-react, tailwindcss, vite
│   ├── vite.config.js              # Dev server on :5000; proxies /api → :8000
│   ├── tailwind.config.js          # Inter font family; scans src/**/*.{js,jsx,ts,tsx}
│   └── postcss.config.js           # tailwindcss + autoprefixer plugins
│
├── docs/
│   └── CODEBASE_MAP.md             # This file
│
├── tlf-shell-generator-prd.md      # Product Requirements Document v1.8 — canonical source of truth
├── Claude.md                       # Behavioral guide for Claude AI assistant
├── CLAUDE.md                       # Claude Code operational guide (commands, architecture)
├── README.md                       # Minimal (one line, project name only)
└── replit.md                       # Replit deployment notes and gotchas
```

---

## 2. Core Modules

### `backend/app.py` — FastAPI Application

The entire backend lives here. It owns:

- **Lifespan context** (`lifespan()`, lines 117–128): calls `init_db()` at startup.
- **CORS middleware** (lines 129–138): reads `CORS_ORIGINS` env var; defaults to `localhost:3000/5000/5173`.
- **Private helper functions** (lines 154–413):

| Function | Purpose |
|---|---|
| `_not_found(entity, id)` | Returns a standard `HTTPException(404)` |
| `_get_study(db, study_id)` | Fetches Study or raises 404 |
| `_get_tlf(db, study_id, tlf_id)` | Fetches TLF or raises 404 |
| `_get_shell(db, study_id, shell_id)` | Fetches Shell or raises 404 |
| `_log_action(db, study_id, ...)` | **Core audit logger** — writes immutable Action record with before/after JSON snapshots |
| `_derive_entity_type(tlf_id, shell_id)` | Maps FKs to entity type string |
| `_compute_action_summary(type, target, ...)` | Human-readable action description |
| `_action_to_event(action)` | Converts Action ORM → AuditEventRead schema |
| `_parse_document_stub(db, doc_id, ...)` | **STUB** — background task placeholder for PDF/Word/Excel extraction |
| `_get_stub_extraction_candidates()` | **STUB** — returns hardcoded TLF data; should call `tlf_extraction_service` |
| `_shell_to_export_dict()` | Serializes Shell for export |
| `_tlf_to_export_dict()` | Serializes TLF for export |
| `_req_to_export_dict()` | Serializes GlobalRequirement for export |
| `_action_to_export_dict()` | Serializes Action for export |

---

### `backend/models.py` — SQLAlchemy ORM

All models share `study_id` FK for row-level security readiness. Timestamps on every entity.

| Model | Key Fields | Notes |
|---|---|---|
| `Study` | `id`, `name`, `created_at`, `updated_at` | Top-level entity; all others FK to it |
| `Document` | `type` (enum), `status` (enum), `parsed_content` (Text), `chunks_meta` (JSON), `file_size` | Raw file deleted after parse; chunks stored for retrieval |
| `TLF` | `number`, `title`, `type` (enum), `section_ref`, `status` (enum), `order_index` | **Deprecated** — kept for backward compat; use `TLFListItem` instead |
| `TLFListItem` | `number`, `raw_title`, `title`, `subtitle`, `analysis_set`, `composed_title`, `source`, `title_source`, `subtitle_source`, `analysis_set_source`, `parsing_confidence`, `status`, `approved` | New model with full provenance tracking |
| `Shell` | `type` (enum), `title`, `subtitle`, `population`, `columns` (JSON), `rows` (JSON), `footnotes` (JSON), `status` (enum), `ai_generation_log` (JSON) | JSON columns hold structured table data |
| `GlobalRequirement` | `section_type`, `number_pattern`, `title_template`, `subtitle_template`, `columns` (JSON) | Per-section shell structure config |
| `Message` | `role` (enum: user/ai), `text`, `tlf_id`, `shell_id`, `extra_metadata` (JSON) | Note: field is `extra_metadata`, not `metadata` (reserved by SQLAlchemy) |
| `Action` | `type` (String, not Enum), `target`, `before_state` (JSON), `after_state` (JSON), `actor`, `summary`, `entity_type` | **Immutable audit log** — never modified after creation |

`Action.type` uses `String` rather than Enum for extensibility — new action types can be added without a migration.

---

### `backend/schemas.py` — Pydantic v2 Schemas

All Read schemas use `model_config = {"from_attributes": True}` for SQLAlchemy ORM compatibility.

**Enums** (lines 27–98):
- `DocumentType`: `sap | protocol | tlf_library | study_tlf_list | other`
- `DocumentStatus`: `uploading | processing | ready | error`
- `TLFType`: `table | listing | figure`
- `TLFStatus`: `proposed | approved`
- `ShellStatus`: `draft | in_review | approved`
- `MessageRole`: `user | ai`
- `ActionType`: 25+ action type strings

**Sub-schemas** (lines 104–127):
- `ColumnDef`: `key, label, width, align` (default `"left"`)
- `RowDef`: `id, label, type, stat, indent, is_header, confirmed, ai_suggested, section_ref`

**Schema families**: Each entity has `Create`, `Read`, `Update`, and `List` variants. Notable schemas:
- `TLFListItemRead` — full provenance and confidence fields
- `TLFListResponse` — includes `approved_count` alongside `items` and `total`
- `AuditEventRead` — enriched view with `entity_type`, `action`, `summary`, `source` for UI display
- `BulkUpdateAnalysisSetRequest` — `item_ids: List[str]`, `analysis_set: str`
- `ChatRequest` — `tlf_id`, `shell_id`, `prompt`, `target`, `target_id`

---

### `backend/database.py` — Async DB Layer

- **URL normalization** (`_normalise_url()`): converts `postgres://` / `postgresql://` → `postgresql+asyncpg://`; strips `sslmode` query param (asyncpg doesn't support it); passes SSL via `connect_args={"ssl": True}`.
- **Default URL**: `sqlite+aiosqlite:///./tlf_shell.db` (dev). Override with `DATABASE_URL` env var for Postgres.
- **Session config**: `expire_on_commit=False`, `autoflush=False`, `autocommit=False`.
- **`get_db()`**: FastAPI dependency; commits on success, rolls back on exception, always closes session.
- **`init_db()`**: `create_all` — idempotent table creation. Production should use Alembic migrations instead.

---

### `backend/services/tlf_extraction_service.py` — TLF Extraction

Regex-based; no ML. Works on already-parsed SAP text.

| Function | Purpose |
|---|---|
| `extract_tlf_candidates_from_sap(parsed_content)` | Main entry point; returns `List[Dict]` with `number, raw_title, output_type, section, extraction_evidence` |
| `_extract_number_and_type(line)` | Regex match for "Table 14.x.x" patterns |
| `_extract_raw_title(line, number, output_type)` | Strips number/type prefix from line |
| `_infer_section(number, raw_title, context)` | Maps `14.1.x`→demographics, `14.2.x`→efficacy, `14.3.x`→safety, `14.4.x`→PK; falls back to keyword matching |
| `_find_grouping_context(nearby, global_context)` | Finds subtitle context ("by ARM", "stratified by", etc.) |
| `_find_analysis_set_context(nearby, global_context, section)` | Finds population designation ("Safety Population", "ITT", etc.) |
| `_extract_global_context(content)` | Extracts study-level defaults from SAP |

Does **not** do final normalization — that's `tlf_title_normalizer`'s job.

---

### `backend/services/tlf_title_normalizer.py` — Title Normalization

| Function | Purpose |
|---|---|
| `normalize_tlf_title(raw_title, extraction_evidence, user_title, ...)` | Core function; applies priority: `user_edit > uploaded > parsed > inferred`; returns `{title, subtitle, analysis_set, composed_title, *_source, parsing_confidence}` |
| `_parse_complete_title(raw)` | Step 1: extract analysis set from final parens; Step 2: split on subtitle trigger (longest match first) |
| `_build_composed_title(title, subtitle, analysis_set)` | Builds `"Title. Subtitle (Analysis Set)"` display string |
| `_calculate_confidence(title, subtitle, analysis_set, sources)` | `high` = all user/explicit; `medium` = one inferred; `low` = multiple inferred or missing |
| `normalize_uploaded_row(row)` | Normalizes a CSV/Excel row; overrides sources to `uploaded_tlf_list` |

Source attribution values: `explicit_sap | uploaded_tlf_list | parsed_from_raw_title | inferred_from_sap_context | user_edit`

---

### `frontend/src/StudyPage.jsx` — Master Container

Five-tab application shell. Each tab is a self-contained component defined in this file (except `TLFListTab`).

| Component | Tab | Responsibility |
|---|---|---|
| `DocumentsTab` | Documents | Upload (multipart), list, status badges, delete |
| `TLFTab` | TLF | Legacy TLF model editor — uses deprecated `TLF` model, not `TLFListItem` |
| `GlobalRequirementsTab` | Global Requirements | Per-section number/title templates + column headers; renders sample table preview |
| `AIShellsTab` | All Shells | Shell list sidebar + per-shell editor with rendered preview, AI chat panel, variable review, row/column editing |
| `AuditEventPanel` (inline) | Audit / History | Paginated audit event list; compact mode for sidebar |

Other components: `Badge`, `StatusIcon`, `ShellDocumentPreview` (Word/Excel-style table renderer).

**API calls** use `fetch()` against `${API_BASE}/studies/{studyId}/...`. `API_BASE` defaults to `http://localhost:8000`; override with `VITE_API_BASE` env var. In Replit, Vite proxies `/api` → `:8000` (see `vite.config.js`).

`main.jsx` hardcodes `studyId="XYZ-101"` — no study selection/routing UI exists yet.

---

### `frontend/src/TLFListTab.jsx` — TLF List Management

Dedicated component for the new `TLFListItem` model. Key sub-components:

| Component | Purpose |
|---|---|
| `InlineEdit` | Click-to-edit cell; Enter saves, Escape cancels |
| `AddItemModal` | Form modal for manual item creation |
| `BulkAnalysisSetModal` | Single-field modal to bulk-set `analysis_set` on selected items |
| `TLFListRow` | Single table row; highlights missing `analysis_set` with amber background |

State: `items`, `total`, `approvedCount`, `loading`, `extracting`, `error`, `search`, `filterSection`, `filterStatus`, `selected` (Set), modal toggles.

---

## 3. API Routes

All routes are prefixed with `/studies/{study_id}` for isolation.

### Health
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/` | `root()` | Health check |
| GET | `/health` | `health()` | Detailed status |

### Studies
| Method | Path | Handler | Notes |
|---|---|---|---|
| POST | `/studies` | `create_study()` | Creates study |
| GET | `/studies` | `list_studies()` | Paginated; returns `{studies, total}` |
| GET | `/studies/{study_id}` | `get_study()` | Single study |

### Documents
| Method | Path | Handler | Notes |
|---|---|---|---|
| POST | `/studies/{id}/documents` | `upload_document()` | Multipart: `file`, `type`, `label`; enqueues parse background task |
| GET | `/studies/{id}/documents` | `list_documents()` | |
| GET | `/studies/{id}/documents/{doc_id}` | `get_document()` | |
| PUT | `/studies/{id}/documents/{doc_id}` | `update_document()` | Logs audit action |

### TLF List (deprecated — legacy TLF model)
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/studies/{id}/tlf-list` | `get_tlf_list()` | Returns old `TLF` objects |
| POST | `/studies/{id}/tlf-list` | `add_tlf()` | |
| PUT | `/studies/{id}/tlf-list` | `bulk_replace_tlf_list()` | Replace all |
| PUT | `/studies/{id}/tlf-list/{tlf_id}` | `update_tlf()` | |
| DELETE | `/studies/{id}/tlf-list/{tlf_id}` | `delete_tlf()` | |
| POST | `/studies/{id}/tlf-list/extract` | `extract_tlf_list()` | Calls `_get_stub_extraction_candidates()` — **hardcoded stub** |
| POST | `/studies/{id}/tlf-list/approve` | `approve_tlf_list()` | Bulk approve |

### TLF List Items (current — TLFListItem model)
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/studies/{id}/tlf-list/items` | `get_tlf_list_items()` | Paginated; returns `{items, total, approved_count}` |
| POST | `/studies/{id}/tlf-list/items` | `create_tlf_list_item()` | Single item with normalization |
| PUT | `/studies/{id}/tlf-list/items/{item_id}` | `update_tlf_list_item()` | Logs action |
| POST | `/studies/{id}/tlf-list/items/{item_id}/approve` | `approve_tlf_list_item()` | |
| POST | `/studies/{id}/tlf-list/approve-all-items` | `approve_all_tlf_list_items()` | Bulk |
| DELETE | `/studies/{id}/tlf-list/items/{item_id}` | `delete_tlf_list_item()` | |
| POST | `/studies/{id}/tlf-list/extract-items` | `extract_tlf_list_items()` | Uses `tlf_extraction_service` + `tlf_title_normalizer` |
| POST | `/studies/{id}/tlf-list/upload-items` | `upload_tlf_list_items()` | CSV/Excel multipart; calls `normalize_uploaded_row()` |
| POST | `/studies/{id}/tlf-list/bulk-update-analysis-set` | `bulk_update_analysis_set()` | Batch update `analysis_set` |

### Global Requirements
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/studies/{id}/global-requirements` | `get_global_requirements()` | |
| POST | `/studies/{id}/global-requirements` | `create_global_requirement()` | |
| PUT | `/studies/{id}/global-requirements/{req_id}` | `update_global_requirement()` | |
| DELETE | `/studies/{id}/global-requirements/{req_id}` | `delete_global_requirement()` | |
| PUT | `/studies/{id}/global-requirements` | `bulk_replace_global_requirements()` | Replace all |

### Shells
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/studies/{id}/shells` | `list_shells()` | |
| POST | `/studies/{id}/shells` | `create_shell()` | Logs `shell_created` action; optionally links to TLF |
| GET | `/studies/{id}/shells/{shell_id}` | `get_shell()` | |
| PUT | `/studies/{id}/shells/{shell_id}` | `update_shell()` | Partial update; logs before/after |
| DELETE | `/studies/{id}/shells/{shell_id}` | `delete_shell()` | |

### Chat & Messages
| Method | Path | Handler | Notes |
|---|---|---|---|
| POST | `/studies/{id}/chat` | `post_chat()` | Stores user + AI messages; AI response is **stub** ("Understood") |
| GET | `/studies/{id}/chat` | `get_chat_history()` | Paginated |
| GET | `/studies/{id}/shells/{shell_id}/messages` | `get_shell_messages()` | Shell-scoped |

### Audit Trail
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/studies/{id}/audit` | `get_audit_events()` | Paginated AuditEventRead |
| GET | `/studies/{id}/shells/{shell_id}/audit` | `get_shell_audit_events()` | Shell-scoped |
| GET | `/studies/{id}/audit-trail` | `get_audit_trail()` | Alias for `get_audit_events()` |
| POST | `/studies/{id}/audit` | `log_audit_action()` | Manual log endpoint |

### Export
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET | `/studies/{id}/export/json` | `export_study_json()` | Full study as JSON |
| GET | `/studies/{id}/export/tlf-list/csv` | `export_tlf_list_csv()` | TLF list as CSV |
| GET | `/studies/{id}/export/shells/json` | `export_shells_json()` | All shells as JSON |
| GET | `/studies/{id}/export/audit/csv` | `export_audit_csv()` | Audit log as CSV |
| GET | `/studies/{id}/export/shell/{shell_id}/docx` | `export_shell_docx()` | **STUB** — Word export not implemented |
| GET | `/studies/{id}/export/package/zip` | `export_study_package_zip()` | **STUB** — ZIP bundle not implemented |

---

## 4. Data Models / Pydantic Schemas

### ORM ↔ Schema Mapping

| ORM Model | Create Schema | Read Schema | Update Schema | List Schema |
|---|---|---|---|---|
| `Study` | `StudyCreate` | `StudyRead` | — | `StudyList` |
| `Document` | (multipart form) | `DocumentRead` | `DocumentUpdate` | `DocumentList` |
| `TLF` | `TLFCreate` | `TLFRead` | `TLFUpdate` | `TLFList` |
| `TLFListItem` | `TLFListItemCreate` | `TLFListItemRead` | `TLFListItemUpdate` | `TLFListResponse` |
| `Shell` | `ShellCreate` | `ShellRead` | `ShellUpdate` | `ShellList` |
| `GlobalRequirement` | `GlobalRequirementCreate` | `GlobalRequirementRead` | `GlobalRequirementUpdate` | `GlobalRequirementList` |
| `Message` | (internal) | `MessageRead` | — | `MessageList` |
| `Action` | `ActionCreate` | `ActionRead` | — | `ActionList` |
| (enriched) | — | `AuditEventRead` | — | `AuditEventList` |

### Shell JSON Structure

```json
// columns
[{"key": "arm_a", "label": "Arm A (n=X)", "width": 120, "align": "center"}]

// rows
[{
  "id": "row_1",
  "label": "Age (years)",
  "type": "continuous",
  "stat": "mean_sd",
  "indent": 0,
  "is_header": false,
  "confirmed": false,
  "ai_suggested": true,
  "section_ref": "SAP Section 5.1"
}]

// footnotes
["a. ITT = Intent-to-Treat Population"]
```

### TLFListItem Provenance Fields

```
title_source / subtitle_source / analysis_set_source:
  "user_edit"               highest priority
  "uploaded_tlf_list"       from CSV/Excel upload
  "explicit_sap"            found directly in SAP
  "parsed_from_raw_title"   parsed from combined raw title
  "inferred_from_sap_context"  inferred from surrounding context

parsing_confidence: "high" | "medium" | "low"
```

---

## 5. Test Coverage

**There are zero test files in the codebase.** No test directory, no pytest fixtures, no test runners configured.

Testing dependencies are present but commented out in `requirements.txt`:
```
# pytest>=8.2.0
# pytest-asyncio>=0.23.6
# httpx>=0.27.0  (for async FastAPI test client)
```

### What is completely untested:
- All API routes in `app.py`
- All ORM models and relationships in `models.py`
- All Pydantic schema validation in `schemas.py`
- Database session management and rollback behavior in `database.py`
- TLF extraction regex logic in `tlf_extraction_service.py`
- Title parsing and confidence calculation in `tlf_title_normalizer.py`
- Audit logging correctness (`_log_action`)
- Stub background tasks (`_parse_document_stub`)
- All frontend components

### Highest-priority areas to test first:
1. `tlf_title_normalizer.normalize_tlf_title()` — complex priority logic with many branches
2. `tlf_extraction_service.extract_tlf_candidates_from_sap()` — regex patterns against sample SAP text
3. API route integration tests (using httpx AsyncClient) for CRUD flows
4. `_log_action()` — audit trail correctness is a core product requirement
5. `database._normalise_url()` — handles several URL transformation edge cases

---

## 6. Established Patterns

### Naming

| Scope | Convention | Examples |
|---|---|---|
| ORM models | PascalCase | `Study`, `TLFListItem`, `GlobalRequirement` |
| Pydantic schemas | PascalCase + suffix | `StudyRead`, `ShellCreate`, `TLFListItemUpdate` |
| Route handlers | `snake_case` verb + noun | `create_study`, `get_tlf_list_items`, `bulk_update_analysis_set` |
| Private helpers | `_snake_case` | `_log_action`, `_get_study`, `_parse_document_stub` |
| Enum values | `snake_case` | `uploading`, `in_review`, `tlf_library` |
| API paths | `kebab-case` | `/tlf-list`, `/global-requirements`, `/extract-items` |
| React components | PascalCase | `StudyPage`, `TLFListTab`, `InlineEdit` |
| React state | camelCase | `items`, `approvedCount`, `showBulkModal` |
| Frontend constants | `SCREAMING_SNAKE_CASE` | `API_BASE`, `SECTION_COLORS`, `SOURCE_LABELS` |

### Imports

**Backend** — grouped and ordered:
1. FastAPI (`fastapi`, `starlette`)
2. SQLAlchemy (`sqlalchemy`, `sqlalchemy.ext.asyncio`)
3. Pydantic (`pydantic`)
4. Local (`database`, `models`, `schemas`, `services.*`)
5. Standard library (`csv`, `io`, `json`, `os`, `uuid`, `datetime`)

**Frontend** — grouped:
1. React core (`react`)
2. Third-party (`lucide-react`)
3. Local components (relative imports)

### Error Handling

**Backend**:
- 404s via `_not_found()` helper returning `HTTPException(status_code=404)`
- 422 from Pydantic validation automatically
- Route handlers use `try/except` for DB errors; session rolls back in `get_db()`
- Background tasks (stub) log errors to `Document.error_message` and set `status = "error"`

**Frontend**:
- `try/catch` around every `fetch()` call
- Local `error` state displayed inline near the triggering UI element
- Loading/spinner states per async operation
- Refresh/retry buttons on failed fetches

### Audit Logging Pattern

Every state-mutating route calls `_log_action()` before returning. The function:
1. Creates an `Action` record with `before_state` / `after_state` JSON snapshots
2. Derives `entity_type` from whichever of `tlf_id` / `shell_id` is non-null
3. Computes a human-readable `summary` string
4. Sets `actor` to `"user"` (or `"ai"` for AI-generated actions)
5. Adds to the session (commit happens in `get_db()` dependency)

### Session Management

```python
# FastAPI dependency — used as: db: AsyncSession = Depends(get_db)
async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except:
            await session.rollback()
            raise
        finally:
            await session.close()
```

### JSON Columns

`Shell.columns`, `Shell.rows`, `Shell.footnotes`, `Shell.ai_generation_log`, `Document.chunks_meta`, `GlobalRequirement.columns`, `Message.extra_metadata` are all stored as `JSON` columns in SQLAlchemy. Pydantic schemas use `Optional[List[...]]` / `Optional[Dict]` with `None` defaults.

### study_id Isolation

Every ORM model has `study_id = Column(String, ForeignKey("studies.id", ondelete="CASCADE"))`. Every route handler filters by `study_id` in all queries (`.where(Model.study_id == study_id)`).

---

## 7. Known Gaps and TODOs

### Critical stubs (blocking MVP)

| Location | What's missing |
|---|---|
| `app.py: _parse_document_stub()` | Actual PDF/Word/Excel text extraction + chunking + embedding. Dependencies (`pdfplumber`, `pytesseract`) are commented out in `requirements.txt` |
| `app.py: post_chat()` | AI call to Claude/OpenAI. Currently returns hardcoded `"Understood"`. API keys are commented out in `.env.example` |
| `app.py: _get_stub_extraction_candidates()` | The `/tlf-list/extract` (legacy) endpoint calls this hardcoded stub instead of the real `tlf_extraction_service.extract_tlf_candidates_from_sap()` |
| `app.py: export_shell_docx()` | Word export via `python-docx`. Dependency is installed but not used |
| `app.py: export_study_package_zip()` | ZIP bundle of all export formats |

### Architecture gaps

| Gap | Detail |
|---|---|
| No study selection UI | `main.jsx` hardcodes `studyId="XYZ-101"`. No routing, no study list page, no login |
| No vector search | `pgvector` is in `requirements.txt` and docker image, but no embedding generation or similarity search is wired |
| No database migrations | `init_db()` uses `create_all` which is fine for dev but unsuitable for prod schema evolution. Alembic not set up |
| Legacy TLF model vs TLFListItem | Two parallel models exist (`TLF` and `TLFListItem`). The `TLFTab` in `StudyPage.jsx` still uses the deprecated `TLF` model. The `TLFListTab.jsx` uses the new model. Migration path not defined |
| AI generation log unused | `Shell.ai_generation_log` column exists but nothing writes to it |
| Per-shell variable review UI | `AIShellsTab` has a placeholder; the variable review round (confirm/flag/add/remove) is not implemented |
| No authentication | No user identity, no JWT, no session. All audit records use `actor="user"` unconditionally |
| Frontend API_BASE duplication | `API_BASE` constant is defined separately in both `StudyPage.jsx` and `TLFListTab.jsx` — will diverge if changed |
| No error boundary | Frontend has no React error boundary; a render error in one tab crashes the whole app |

### Minor TODOs found in code

| Location | Note |
|---|---|
| `requirements.txt` | Comments throughout indicate which packages to uncomment as each Phase 1 feature is implemented |
| `database.py` | Comment notes that `create_all` should be replaced with Alembic for production |
| `docker-compose.yml` | `db/init/` volume mount referenced but directory doesn't exist — SQL init scripts not yet created |
| `replit.md` | Notes that `Message.extra_metadata` naming was a deliberate workaround for SQLAlchemy's reserved `metadata` attribute |
