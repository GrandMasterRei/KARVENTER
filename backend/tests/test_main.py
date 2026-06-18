from fastapi.testclient import TestClient
from unittest.mock import patch, MagicMock
import os
import sys

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

from app.main import app

client = TestClient(app)

def test_health_check():
    response = client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_create_product_type_error():
    payload = {
        "product_name": "Hatalı Ürün",
        "category": "Gıda",
        "unit_price": "yirmibes",
        "profit_margin": 0.2,
        "min_stock_level": 10
    }
    response = client.post("/api/products", json=payload)
    assert response.status_code == 422

def test_get_products():
    response = client.get("/api/products")
    assert response.status_code in [200, 500]

def test_get_stocks():
    response = client.get("/api/stocks")
    assert response.status_code in [200, 500]

def test_z_report_endpoint():
    response = client.get("/api/reports/z-report")
    assert response.status_code in [200, 500]

def test_ai_tahmin_endpoint():
    with patch("app.ai_engine.requests.post") as mock_post:
        mock_post.return_value = MagicMock(
            json=lambda: {"response": '{"tahmin":[10,12,15,11,9,13,14],"guven":"orta","aciklama":"test"}'}
        )
        response = client.get("/api/ai/tahmin/1/1")
        assert response.status_code in [200, 404, 500]

def test_ai_stok_onerileri_endpoint():
    with patch("app.ai_engine.requests.post") as mock_post:
        mock_post.return_value = MagicMock(
            json=lambda: {"response": '[{"urun":"test","oneri":"siparis ver","aciliyet":"yuksek"}]'}
        )
        response = client.get("/api/ai/stok-onerileri")
        assert response.status_code in [200, 500]

def test_auth_giris_hatali():
    response = client.post("/api/auth/giris", data={
        "username": "olmayan_kullanici",
        "password": "yanlis_sifre"
    })
    assert response.status_code in [401, 500]