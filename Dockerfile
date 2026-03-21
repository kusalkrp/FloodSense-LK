FROM python:3.11-slim

# Non-root user — never run as root in production
RUN groupadd -r floodsense && useradd -r -g floodsense floodsense

WORKDIR /app

# Install deps first (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source and tests
COPY src/ ./src/
COPY tests/ ./tests/
COPY pytest.ini .

# Switch to non-root
USER floodsense

ENV PYTHONPATH=/app/src
ENV PYTHONUNBUFFERED=1

EXPOSE 8002

CMD ["python", "-m", "floodsense_lk.main"]
