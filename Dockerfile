# Motor de calculo (API FastAPI) para la version web.
# Construir desde la raiz del repositorio:  docker build -t ruido-engine .
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    MPLBACKEND=Agg \
    PORT=8000

WORKDIR /app
COPY engine/requirements.txt engine/requirements.txt
RUN pip install --no-cache-dir -r engine/requirements.txt

COPY core core
COPY templates templates
COPY engine engine

RUN useradd --create-home motor && chown -R motor /app
USER motor

EXPOSE 8000
CMD ["sh", "-c", "uvicorn engine.app:app --host 0.0.0.0 --port ${PORT} --workers ${WEB_CONCURRENCY:-2}"]
