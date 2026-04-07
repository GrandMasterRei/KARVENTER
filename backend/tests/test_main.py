import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_read_root():
    """API ana sayfasının çalışıp çalışmadığını test eder"""
    response = client.get("/")
    assert response.status_code == 200
    assert response.json() == {"message": "KARVENTER Backend API Sorunsuz Çalışıyor!"}

def test_get_products():
    """Ürün listeleme endpoint'ini test eder"""
    response = client.get("/api/products")
    assert response.status_code == 200
    assert isinstance(response.json(), list)

def test_create_product_error():
    """Hatalı veri gönderildiğinde sistemin reddettiğini test eder"""
    response = client.post("/api/products", json={"yanlis_alan": "hata"})
    assert response.status_code == 422 # Validation Error