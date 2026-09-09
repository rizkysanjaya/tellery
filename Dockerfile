# =============================================================================
# Dockerfile: Tellery Multi-Stage Production Image
# =============================================================================

# Stage 1: Build React Frontend
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Python Backend Runtime
FROM python:3.12-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source and assets
COPY src/ ./src/
COPY run.py .
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Persistent data directories
VOLUME ["/app/data", "/app/.thumbnails"]

EXPOSE 8000

CMD ["python", "-m", "src.main", "--host", "0.0.0.0", "--port", "8000", "--no-reload"]
