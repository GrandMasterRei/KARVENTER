import httpx

# Docker'da çalışan aktif API'mize dışarıdan bağlanıp test ediyoruz
API_URL = "http://localhost:8000"

def test_health_check():
    response = httpx.get(f"{API_URL}/")
    assert response.status_code == 200

def test_z_report_endpoint():
    response = httpx.get(f"{API_URL}/api/reports/z-report")
    assert response.status_code == 200
    assert "financials" in response.json()