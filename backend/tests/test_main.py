from fastapi.testclient import TestClient
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200

def test_z_report_endpoint():
    response = client.get("/api/reports/z-report")
    assert response.status_code == 200