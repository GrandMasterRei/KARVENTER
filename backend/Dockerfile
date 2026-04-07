# Final Raporu 5.9 uyarınca belirlenen base image 
FROM python:3.11-slim

WORKDIR /app

# Gereksinimleri kopyala ve yükle
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Tüm backend kodlarını kopyala
COPY . .

# Portu aç
EXPOSE 8000

# Sunucuyu başlat
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]