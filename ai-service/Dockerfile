FROM python:3.12-slim

# Create non-root user for security
RUN useradd --create-home appuser

WORKDIR /app

# Install dependencies before copying source (layer cache)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Switch to non-root user
USER appuser

EXPOSE 5001

# gunicorn: 2 workers for a lightweight service; tune for prod
CMD ["gunicorn", "--bind", "0.0.0.0:5001", "--workers", "2", "--timeout", "60", "app:app"]
