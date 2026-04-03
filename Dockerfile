# ── Stage 1: Build React frontend ──────────────────────────────────────────────
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
RUN npm run build


# ── Stage 2: Python runtime ─────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Install Python dependencies
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./

# Copy built frontend into the static directory FastAPI will serve
COPY --from=frontend-builder /app/frontend/dist ./static/

# Data directory (SQLite volume mount point)
RUN mkdir -p /data

EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
