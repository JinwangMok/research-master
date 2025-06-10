# doc-generator/Dockerfile
FROM python:3.11

WORKDIR /app

# Install system dependencies for LaTeX and LibreOffice
RUN apt-get update && apt-get install -y \
    texlive-full \
    texlive-xetex \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    pandoc \
    wkhtmltopdf \
    libreoffice \
    fonts-liberation \
    fonts-dejavu \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Create necessary directories
RUN mkdir -p /output /templates /workspace

EXPOSE 5001

CMD ["python", "app.py"]