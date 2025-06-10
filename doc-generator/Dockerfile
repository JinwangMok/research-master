# doc-generator/Dockerfile (최적화 버전 - 레이어 캐싱 활용)
FROM python:3.11 AS texlive
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    texlive-base \
    texlive-latex-recommended \
    texlive-fonts-recommended \
    texlive-latex-extra && \
    rm -rf /var/lib/apt/lists/*

FROM texlive AS builder
WORKDIR /app
COPY requirements.txt .
RUN pip wheel --no-cache-dir --no-deps --wheel-dir /app/wheels -r requirements.txt

FROM texlive
WORKDIR /app
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    pandoc wkhtmltopdf fonts-liberation && \
    rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/wheels /wheels
COPY requirements.txt .
RUN pip install --no-cache /wheels/*
COPY . .
RUN mkdir -p /output /templates /workspace && \
    useradd -m -u 1000 docgen && \
    chown -R docgen:docgen /app /output /templates /workspace
USER docgen
EXPOSE 5001
CMD ["python", "app.py"]