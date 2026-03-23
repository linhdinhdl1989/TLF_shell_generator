## Backend — TLF Shell Generator

- Framework: FastAPI + SQLAlchemy + Pydantic v2.
- Parsing logic lives in services/ (e.g. tlf_extraction_service.py); do not put parsing in app.py.
- Database access goes through database.py; no ad‑hoc engine creation.
- Endpoints must use schemas from schemas.py.
- Run dev: `uvicorn app:app --reload`
- Run tests: `pytest` (when tests folder exists).

When adding/changing parser logic:
1) Write or update tests first.
2) Keep SAP/Protocol rules consistent with tlf-shell-generator-prd.md.
3) Preserve GxP auditability: never mutate existing Action rows.
