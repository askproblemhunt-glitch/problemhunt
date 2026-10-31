# Works on any free container host (Hugging Face Spaces, Koyeb, Fly.io, Railway trial…)
FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PH_DATA_DIR=/app/data
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend backend
COPY frontend/out frontend/out
RUN useradd -m ph && mkdir -p /app/data && chown -R ph /app
USER ph
EXPOSE 7860
CMD ["sh", "-c", "uvicorn backend.app.main:app --host 0.0.0.0 --port ${PORT:-7860} --proxy-headers --forwarded-allow-ips='*'"]
