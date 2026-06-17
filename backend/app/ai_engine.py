import requests
import json
import os

OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_ADI = os.getenv("OLLAMA_MODEL", "llama3.2:3b")

def talep_tahmini_uret(urun_adi: str, kategori: str, satis_gecmisi: list) -> dict:
    """Geçmiş satış verilerine göre 7 günlük talep tahmini üretir."""
    prompt = f"""Sen bir market zinciri stok analisti yapay zekasısın.
Ürün: {urun_adi}, Kategori: {kategori}
Son satışlar: {json.dumps(satis_gecmisi, ensure_ascii=False)}
Bir sonraki 7 gün için günlük talep tahminini SADECE JSON olarak ver:
{{"tahmin": [g1,g2,g3,g4,g5,g6,g7], "guven": "yuksek/orta/dusuk", "aciklama": "..."}}"""

    try:
        yanit = requests.post(OLLAMA_URL, json={
            "model": MODEL_ADI,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=120)
        sonuc = yanit.json()
        return json.loads(sonuc["response"])
    except Exception as hata:
        return {
            "hata": str(hata),
            "tahmin": [0]*7,
            "guven": "dusuk",
            "aciklama": "Ollama baglanti hatasi"
        }

def stok_onerisi_uret(kritik_stoklar: list) -> list:
    """Kritik stok seviyesindeki ürünler için yenileme önerisi üretir."""
    if not kritik_stoklar:
        return []

    prompt = f"""Asagidaki urunlerin stoku kritik seviyenin altinda.
Veriler: {json.dumps(kritik_stoklar, ensure_ascii=False)}
Her urun icin SADECE JSON listesi dondur:
[{{"urun": "...", "oneri": "...", "aciliyet": "yuksek/orta"}}]"""

    try:
        yanit = requests.post(OLLAMA_URL, json={
            "model": MODEL_ADI,
            "prompt": prompt,
            "stream": False,
            "format": "json"
        }, timeout=30)
        sonuc = yanit.json()
        parsed = json.loads(sonuc["response"])
        return parsed if isinstance(parsed, list) else [parsed]
    except Exception as hata:
        return [{"hata": str(hata), "aciliyet": "dusuk"}]