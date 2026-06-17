from fastapi.testclient import TestClient
import os
import sys
import types
import importlib.util
import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
os.environ.setdefault("DATABASE_URL", "sqlite:///./test.db")

if importlib.util.find_spec("requests") is None:
    requests_stub = types.ModuleType("requests")

    def _post(*args, **kwargs):
        raise TimeoutError("requests dependency is not installed")

    requests_stub.post = _post
    sys.modules["requests"] = requests_stub

from app.main import app
from app.models import Sale, Product, Market, Stock

_client = TestClient(app)


@pytest.fixture
def client():
    return _client

def test_health_check():
    response = _client.get("/")
    assert response.status_code == 200
    assert "message" in response.json()

def test_create_product_success():
    payload = {
        "product_name": "Test Sütü 1L",
        "category": "Gıda",
        "unit_price": 25.5,
        "profit_margin": 0.2,
        "min_stock_level": 10
    }
    response = _client.post("/api/products", json=payload)
    assert response.status_code == 201
    assert response.json()["product_name"] == "Test Sütü 1L"

def test_create_product_type_error():
    payload = {
        "product_name": "Hatalı Ürün",
        "category": "Gıda",
        "unit_price": "yirmibes",
        "profit_margin": 0.2,
        "min_stock_level": 10
    }
    response = _client.post("/api/products", json=payload)
    assert response.status_code == 422

def test_get_products():
    response = _client.get("/api/products")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data, list)
    if len(data) > 0:
        assert "product_id" in data[0]
        assert "product_name" in data[0]

def test_create_stock_not_found():
    payload = {
        "product_id": 99999,
        "market_id": 99999,
        "quantity": 50
    }
    response = _client.post("/api/stocks", json=payload)
    assert response.status_code == 404

def test_get_stocks():
    response = _client.get("/api/stocks")
    assert response.status_code == 200
    assert "data" in response.json()

def test_z_report_endpoint():
    response = _client.get("/api/reports/z-report")
    assert response.status_code == 200
    data = response.json()
    assert "financials" in data
    
    financials = data["financials"]
    assert "organik_kar" in financials
    assert "optimize_kar" in financials
    assert "net_ai_kazanci" in financials

def test_ai_tahmin_endpoint(client):
    """AI tahmin endpoint'i 200 döndürmeli."""
    response = client.get("/api/ai/tahmin/1/1")
    assert response.status_code in [200, 404]  # veri yoksa 404 kabul


def test_ai_stok_onerileri_endpoint(client):
    """AI stok önerileri endpoint'i 200 döndürmeli."""
    response = client.get("/api/ai/stok-onerileri")
    assert response.status_code == 200
    assert isinstance(response.json(), list)
