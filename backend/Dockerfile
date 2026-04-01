FROM python:3.11-slim

WORKDIR /app

# Ensure standard output is not buffered
ENV PYTHONUNBUFFERED=1

# Install system dependencies
# gcc is typically required for asyncpg
RUN apt-get update && apt-get install -y gcc && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the actual app
COPY backend/ .

# Start server using the environment port for Railway compatibility
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
