##############################################################################
# TLF Shell Generator — backend Dockerfile
# Multi-stage: builder installs deps, runtime is lean.
##############################################################################

# ── Stage 1: dependency installer ──────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /build

# System deps for asyncpg compilation and potential OCR (future)
RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
        libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# ── Stage 2: runtime image ─────────────────────────────────────────────────
FROM python:3.12-slim AS runtime

WORKDIR /app

# Copy installed packages from builder
COPY --from=builder /install /usr/local

# Copy application source
COPY . .

# Non-root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser
USER appuser

EXPOSE 8000

# Production entrypoint (no --reload).
# Override in docker-compose.yml for development hot-reload.
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
