FROM python:3.10-slim

# Install system dependencies including network-manager (for nmcli), dbus, and kmod (for wireguard)
RUN apt-get update && apt-get install -y \
    gcc \
    python3-dev \
    network-manager \
    dbus \
    kmod \
    iproute2 \
    procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Expose port 8000 (though we run in net=host mode, it's good documentation)
EXPOSE 8000

# Run uvicorn server
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
