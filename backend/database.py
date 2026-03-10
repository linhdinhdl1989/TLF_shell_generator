"""
Async database engine and session factory for TLF Shell Generator.

Dev  (default): SQLite via aiosqlite — no external service needed.
Prod           : Postgres via asyncpg — set DATABASE_URL env var.

Environment variables
─────────────────────
DATABASE_URL   Connection string.
               SQLite  : sqlite+aiosqlite:///./tlf_shell.db  (default)
               Postgres: postgresql+asyncpg://user:pass@host:5432/dbname
               If a bare postgres:// or postgresql:// URL is provided the
               driver prefix is normalised automatically.
DB_ECHO        Set to "true" to log every SQL statement (default: false).

Usage
─────
from database import get_db, init_db

# In FastAPI lifespan:
await init_db()

# In route dependency:
async def my_route(db: AsyncSession = Depends(get_db)):
    ...
"""

import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from models import Base  # noqa: F401 – triggers model registration on import

# ---------------------------------------------------------------------------
# Resolve DATABASE_URL
# ---------------------------------------------------------------------------

_RAW_URL: str = os.getenv(
    "DATABASE_URL",
    "sqlite+aiosqlite:///./tlf_shell.db",
)

def _normalise_url(url: str) -> str:
    """Ensure the correct async driver prefix is present."""
    # Heroku-style postgres:// → postgresql+asyncpg://
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+asyncpg://", 1)
    # Plain postgresql:// → postgresql+asyncpg://
    elif url.startswith("postgresql://") and "+asyncpg" not in url:
        url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url

DATABASE_URL: str = _normalise_url(_RAW_URL)

# ---------------------------------------------------------------------------
# Engine
# ---------------------------------------------------------------------------

# SQLite requires connect_args for async usage; Postgres does not.
_connect_args: dict = (
    {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

engine = create_async_engine(
    DATABASE_URL,
    echo=os.getenv("DB_ECHO", "false").lower() == "true",
    future=True,
    connect_args=_connect_args,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
    autocommit=False,
)

# ---------------------------------------------------------------------------
# FastAPI dependency
# ---------------------------------------------------------------------------

async def get_db():
    """
    Yields an AsyncSession per request.  Commits on success, rolls back on
    exception, and always closes the session.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()

# ---------------------------------------------------------------------------
# DB initialisation (called once at startup)
# ---------------------------------------------------------------------------

async def init_db() -> None:
    """
    Create all tables defined in models.py if they don't exist yet.
    Safe to call on every startup (CREATE TABLE IF NOT EXISTS semantics).
    For production, prefer Alembic migrations instead.
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
