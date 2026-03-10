# TLF Shell Generator

## Overview
AI-powered TLF (Tables, Listings, Figures) mock shell generator for clinical trial programming. Full-stack application with a React frontend and FastAPI backend.

## Architecture

### Frontend (`/frontend`)
- **Framework**: React 18 + Vite 5
- **Styling**: Tailwind CSS + PostCSS
- **Icons**: lucide-react
- **Dev server**: port 5000 (bound to 0.0.0.0, proxy-trusted)
- API calls to backend proxied via `/api` → `http://localhost:8000`

### Backend (`/backend`)
- **Framework**: FastAPI + Uvicorn
- **ORM**: SQLAlchemy 2.x (async)
- **Database**: PostgreSQL via asyncpg (uses `DATABASE_URL` env var; falls back to SQLite + aiosqlite for dev)
- **Validation**: Pydantic v2
- **Port**: 8000 (localhost)

## Key Files
- `frontend/vite.config.js` — Vite config (port 5000, host 0.0.0.0, allowedHosts: true)
- `backend/app.py` — FastAPI app with all API routes
- `backend/models.py` — SQLAlchemy ORM models
- `backend/schemas.py` — Pydantic request/response schemas
- `backend/database.py` — Async DB engine setup (handles asyncpg sslmode stripping)

## Workflows
- **Start application**: `cd frontend && npm run dev` → port 5000 (webview)
- **Backend API**: `cd backend && uvicorn app:app --host localhost --port 8000 --reload` → port 8000 (console)

## Database Notes
- Uses `DATABASE_URL` env var if set (Replit Postgres)
- The `database.py` strips `sslmode` query param from the URL (not supported by asyncpg) and handles SSL via `connect_args` instead
- `models.py`: The `Message` model uses `extra_metadata` (not `metadata`, which is reserved by SQLAlchemy)

## API Endpoints
All routes are scoped to a `study_id`. Main resources:
- `POST/GET /studies` — Create/list studies
- `POST/GET /studies/{id}/documents` — Upload/list documents
- `GET/POST/PUT /studies/{id}/tlf-list` — Manage TLF list
- `GET/POST/PUT /studies/{id}/shells` — Manage shells
- `GET/POST /studies/{id}/global-requirements` — Global requirements
- `POST/GET /studies/{id}/chat` — Chat/AI messages
- `GET /studies/{id}/actions` — Audit trail
