FROM python:3.11-slim

WORKDIR /app

# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy proxy code
COPY proxy.py .

# Expose default stratum port
EXPOSE 3333

# Run proxy
CMD ["python", "proxy.py"]
