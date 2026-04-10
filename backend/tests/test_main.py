from fastapi.testclient import TestClient
import sys
import os

# Backend klasörünü Python'a tanıtıyoruz (Import hatası almamak için)
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.main import app

# Gerçek server'ı açmadan uygulamanın içine sızan test istemcisi
client = TestClient(app)

def test_health_check():
    # Artık http://localhost:8000 yazmamıza gerek yok, client direkt app'e bağlı
    response = client.get("/")
    assert response.status_code == 200

def test_z_report_endpoint():
    response = client.get("/api/reports/z-report")
    assert response.status_code == 200
    assert "financials" in response.json()