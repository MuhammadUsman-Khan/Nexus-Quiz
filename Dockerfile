# Start from the official Python image
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Copy requirements first (for caching)
COPY requirements.txt .

# Install dependencies
RUN pip install --upgrade pip
RUN pip install -r requirements.txt

# Copy backend code
COPY backend/ ./backend
COPY quiz_engine/ ./quiz_engine

# Copy any firebase credentials (ensure .env or secret volume)
# (Optional) ENV variables example
ENV FIREBASE_CREDENTIALS="/app/backend/db/serviceAccountKey.json"

# Expose FastAPI port
EXPOSE 8000

# Start server
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
