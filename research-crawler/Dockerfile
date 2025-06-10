# research-crawler/Dockerfile (최적화 버전)
FROM python:3.11-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ && \
    rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

FROM python:3.11-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache /wheels/*
COPY . .
RUN mkdir -p /data /cache && \
    useradd -m -u 1000 crawler && \
    chown -R crawler:crawler /app /data /cache
USER crawler
EXPOSE 5000
CMD ["python", "app.py"]