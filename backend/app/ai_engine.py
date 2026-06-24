import json
import os
from typing import Any

import requests


OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")
MODEL_ADI = os.getenv("OLLAMA_MODEL", "qwen3:8b")


def _guven_normalize(guven: Any) -> str:
    """LLM çıktısındaki güven değerini standart hale getirir."""
    metin = str(guven or "").lower()

    if "yüksek" in metin or "yuksek" in metin or "high" in metin:
        return "yuksek"

    if "orta" in metin or "medium" in metin:
        return "orta"

    return "dusuk"


def _guvenli_sayi(deger: Any, varsayilan: float = 0.0) -> float:
    """Bozuk sayısal değerleri güvenli float değere dönüştürür."""
    try:
        sayi = float(deger)
        if sayi < 0:
            return varsayilan
        return sayi
    except (TypeError, ValueError):
        return varsayilan


def _guvenli_int(deger: Any, varsayilan: int = 0) -> int:
    """Bozuk sayısal değerleri güvenli int değere dönüştürür."""
    try:
        sayi = int(float(deger))
        if sayi < 0:
            return varsayilan
        return sayi
    except (TypeError, ValueError):
        return varsayilan


def _json_ayikla(raw_text: str) -> Any:
    """
    Model bazen JSON etrafına açıklama ekleyebilir.
    Bu fonksiyon önce doğrudan parse eder, olmazsa ilk JSON bloğunu ayıklar.
    """
    if not raw_text:
        raise ValueError("Boş model çıktısı")

    try:
        return json.loads(raw_text)
    except json.JSONDecodeError:
        pass

    ilk_obje = raw_text.find("{")
    son_obje = raw_text.rfind("}")

    ilk_liste = raw_text.find("[")
    son_liste = raw_text.rfind("]")

    obje_var = ilk_obje != -1 and son_obje != -1 and son_obje > ilk_obje
    liste_var = ilk_liste != -1 and son_liste != -1 and son_liste > ilk_liste

    if liste_var and (not obje_var or ilk_liste < ilk_obje):
        return json.loads(raw_text[ilk_liste:son_liste + 1])

    if obje_var:
        return json.loads(raw_text[ilk_obje:son_obje + 1])

    raise ValueError("JSON formatı ayıklanamadı")


def _ollama_json_istegi(prompt: str, timeout: int = 120) -> Any:
    """Ollama local LLM servisine JSON modunda istek atar."""
    yanit = requests.post(
        OLLAMA_URL,
        json={
            "model": MODEL_ADI,
            "prompt": prompt,
            "stream": False,
            "format": "json",
            "options": {
                "temperature": 0.1
            }
        },
        timeout=timeout
    )

    yanit.raise_for_status()
    sonuc = yanit.json()
    return _json_ayikla(sonuc.get("response", ""))


def _satis_adetlerini_al(satis_gecmisi: list) -> list[int]:
    """Satış geçmişindeki adet değerlerini temizler."""
    adetler = []

    for kayit in satis_gecmisi or []:
      if isinstance(kayit, dict):
          adetler.append(_guvenli_int(kayit.get("adet") or kayit.get("quantity"), 0))
      else:
          adetler.append(_guvenli_int(kayit, 0))

    return [adet for adet in adetler if adet >= 0]


def _talep_fallback_uret(satis_gecmisi: list) -> dict:
    """
    LLM cevap vermese bile geçmiş satıştan basit ve açıklanabilir 7 günlük tahmin üretir.
    Bu, AI motorunu tamamen susturmak yerine sistemi çalışır tutar.
    """
    adetler = _satis_adetlerini_al(satis_gecmisi)

    if not adetler:
        return {
            "tahmin": [0, 0, 0, 0, 0, 0, 0],
            "guven": "dusuk",
            "aciklama": "Bu ürün ve şube için satış geçmişi bulunmadığı için anlamlı talep tahmini üretilemedi."
        }

    # En güncel kayıtlar genelde başta geldiği için ilk 7 ve ilk 14 kayıt kullanılır.
    son_7 = adetler[:7] if len(adetler) >= 7 else adetler
    son_14 = adetler[:14] if len(adetler) >= 14 else adetler

    ortalama_7 = sum(son_7) / len(son_7)
    ortalama_14 = sum(son_14) / len(son_14)

    trend = ortalama_7 - ortalama_14
    baz = max(0, ortalama_7)

    tahmin = []
    for gun in range(1, 8):
        deger = round(max(0, baz + (trend * 0.15 * gun)))
        tahmin.append(int(deger))

    guven = "orta" if len(adetler) >= 7 else "dusuk"

    return {
        "tahmin": tahmin,
        "guven": guven,
        "aciklama": (
            f"Tahmin, son satış ortalaması ve kısa dönem trendine göre üretildi. "
            f"Son 7 kayıt ortalaması {ortalama_7:.2f}, genel ortalama {ortalama_14:.2f}."
        )
    }


def _talep_sonucunu_temizle(model_sonucu: Any, fallback: dict) -> dict:
    """LLM talep tahmini çıktısını frontend için standart hale getirir."""
    if not isinstance(model_sonucu, dict):
        return fallback

    tahmin = model_sonucu.get("tahmin", fallback["tahmin"])
    if not isinstance(tahmin, list):
        tahmin = fallback["tahmin"]

    temiz_tahmin = [_guvenli_int(deger, 0) for deger in tahmin[:7]]

    while len(temiz_tahmin) < 7:
        temiz_tahmin.append(0)

    return {
        "tahmin": temiz_tahmin,
        "guven": _guven_normalize(model_sonucu.get("guven", fallback["guven"])),
        "aciklama": str(model_sonucu.get("aciklama") or fallback["aciklama"])
    }


def talep_tahmini_uret(urun_adi: str, kategori: str, satis_gecmisi: list) -> dict:
    """Geçmiş satış verilerine göre 7 günlük talep tahmini üretir."""
    fallback = _talep_fallback_uret(satis_gecmisi)

    prompt = f"""
Sen KARVENTER adlı market zinciri stok optimizasyon sisteminin yerel yapay zeka motorusun.
Dış API kullanmıyorsun. Görevin, veritabanından gelen satış geçmişine göre 7 günlük talep tahmini üretmektir.

Ürün: {urun_adi}
Kategori: {kategori}

Satış geçmişi:
{json.dumps(satis_gecmisi, ensure_ascii=False)}

Ön hesaplanmış istatistiksel baz tahmin:
{json.dumps(fallback, ensure_ascii=False)}

Kurallar:
- Mutlaka 7 elemanlı sayısal tahmin listesi üret.
- Tahminler negatif olamaz.
- Veri azsa güven değerini "dusuk" ver.
- Veri yeterliyse trendi yorumla.
- Sadece JSON döndür, başka metin yazma.

Dönüş formatı:
{{
  "tahmin": [0, 0, 0, 0, 0, 0, 0],
  "guven": "yuksek/orta/dusuk",
  "aciklama": "Kısa ve teknik açıklama"
}}
"""

    try:
        model_sonucu = _ollama_json_istegi(prompt, timeout=120)
        return _talep_sonucunu_temizle(model_sonucu, fallback)
    except Exception as hata:
        fallback["hata"] = str(hata)
        fallback["aciklama"] = (
            fallback["aciklama"]
            + " Local LLM bağlantısı kurulamadığı için istatistiksel fallback tahmin kullanıldı."
        )
        return fallback


def stok_onerisi_uret(kritik_stoklar: list) -> list:
    """Kritik stok seviyesindeki ürünler için yenileme önerisi üretir."""
    if not kritik_stoklar:
        return []

    fallback = []

    for stok in kritik_stoklar:
        urun = stok.get("urun", "Bilinmeyen ürün")
        mevcut = _guvenli_int(stok.get("mevcut_stok"), 0)
        minimum = _guvenli_int(stok.get("minimum_seviye"), 0)
        eksik = max(0, minimum - mevcut)

        fallback.append({
            "urun": urun,
            "oneri": f"{urun} için minimum seviyeye ulaşmak adına en az {eksik} adet stok girişi önerilir.",
            "aciliyet": "yuksek" if mevcut <= minimum * 0.5 else "orta"
        })

    prompt = f"""
Sen KARVENTER stok yenileme karar destek motorusun.
Aşağıdaki ürünler minimum stok seviyesinin altındadır.

Kritik stok verileri:
{json.dumps(kritik_stoklar, ensure_ascii=False)}

Kurallar:
- Her ürün için kısa yenileme önerisi üret.
- Aciliyet sadece "yuksek" veya "orta" olabilir.
- Sadece JSON listesi döndür.

Dönüş formatı:
[
  {{
    "urun": "Ürün adı",
    "oneri": "Kısa öneri",
    "aciliyet": "yuksek/orta"
  }}
]
"""

    try:
        model_sonucu = _ollama_json_istegi(prompt, timeout=60)
        if isinstance(model_sonucu, list):
            return model_sonucu
        if isinstance(model_sonucu, dict):
            return [model_sonucu]
        return fallback
    except Exception as hata:
        fallback.append({
            "urun": "AI bağlantısı",
            "oneri": f"Local LLM bağlantısı kurulamadı: {hata}",
            "aciliyet": "orta"
        })
        return fallback


def _transfer_fallback_uret(urun_adi: str, sube_verileri: list) -> dict:
    """
    LLM çalışmasa bile satış hızı ve stok seviyesine göre açıklanabilir transfer önerisi üretir.
    """
    if not sube_verileri or len(sube_verileri) < 2:
        return {
            "transfer_et": False,
            "urun": urun_adi,
            "kaynak_sube": "",
            "hedef_sube": "",
            "miktar": 0,
            "kurtarilan_kar_tahmini": 0.0,
            "aciklama": "Transfer önerisi için en az iki şubeye ait stok ve satış verisi gerekir."
        }

    zengin_veri = []

    for sube in sube_verileri:
        mevcut_stok = _guvenli_int(sube.get("mevcut_stok"), 0)
        toplam_satis = _guvenli_int(sube.get("toplam_satis"), 0)
        satis_kayit_sayisi = max(1, _guvenli_int(sube.get("satis_kayit_sayisi"), 1))
        birim_fiyat = _guvenli_sayi(sube.get("birim_fiyat"), 0.0)
        kar_marji = _guvenli_sayi(sube.get("kar_marji"), 0.0)

        gunluk_satis_hizi = toplam_satis / satis_kayit_sayisi
        stok_yeterlilik_gunu = mevcut_stok / gunluk_satis_hizi if gunluk_satis_hizi > 0 else 999

        zengin_veri.append({
            **sube,
            "mevcut_stok": mevcut_stok,
            "toplam_satis": toplam_satis,
            "satis_kayit_sayisi": satis_kayit_sayisi,
            "birim_fiyat": birim_fiyat,
            "kar_marji": kar_marji,
            "gunluk_satis_hizi": gunluk_satis_hizi,
            "stok_yeterlilik_gunu": stok_yeterlilik_gunu
        })

    hedef = max(zengin_veri, key=lambda x: x["gunluk_satis_hizi"])
    kaynak = max(
        [s for s in zengin_veri if s.get("sube") != hedef.get("sube")],
        key=lambda x: (x["stok_yeterlilik_gunu"], x["mevcut_stok"])
    )

    if hedef["gunluk_satis_hizi"] <= 0:
        return {
            "transfer_et": False,
            "urun": urun_adi,
            "kaynak_sube": kaynak.get("sube", ""),
            "hedef_sube": hedef.get("sube", ""),
            "miktar": 0,
            "kurtarilan_kar_tahmini": 0.0,
            "aciklama": "Satış hızı verisi yetersiz olduğu için transfer önerisi üretilmedi."
        }

    # Kaynak şubede yaklaşık 7 günlük satıştan fazla kalan stok transfer edilebilir kabul edilir.
    kaynak_korunacak_stok = max(5, round(kaynak["gunluk_satis_hizi"] * 7))
    kaynak_fazla_stok = max(0, kaynak["mevcut_stok"] - kaynak_korunacak_stok)

    # Hedef şube için 7 günlük talebi karşılayacak ek stok ihtiyacı.
    hedef_7_gun_ihtiyac = round(hedef["gunluk_satis_hizi"] * 7)
    hedef_ihtiyac = max(0, hedef_7_gun_ihtiyac - hedef["mevcut_stok"])

    miktar = min(kaynak_fazla_stok, hedef_ihtiyac)

    # Eğer hedef stok zaten yeterliyse ama kaynakta çok fazla stok varsa küçük dengeleme önerisi yapılabilir.
    if miktar <= 0 and kaynak_fazla_stok >= 10 and hedef["gunluk_satis_hizi"] > kaynak["gunluk_satis_hizi"]:
        miktar = min(kaynak_fazla_stok, max(1, round(hedef["gunluk_satis_hizi"] * 3)))

    if miktar <= 0:
        return {
            "transfer_et": False,
            "urun": urun_adi,
            "kaynak_sube": kaynak.get("sube", ""),
            "hedef_sube": hedef.get("sube", ""),
            "miktar": 0,
            "kurtarilan_kar_tahmini": 0.0,
            "aciklama": "Şubeler arasında anlamlı stok dengesizliği bulunmadığı için transfer önerilmedi."
        }

    kar_marji = hedef["kar_marji"] or kaynak["kar_marji"]
    birim_fiyat = hedef["birim_fiyat"] or kaynak["birim_fiyat"]
    kurtarilan_kar = round(miktar * birim_fiyat * kar_marji, 2)

    return {
        "transfer_et": True,
        "urun": urun_adi,
        "kaynak_sube": kaynak.get("sube", ""),
        "hedef_sube": hedef.get("sube", ""),
        "miktar": int(miktar),
        "kurtarilan_kar_tahmini": kurtarilan_kar,
        "aciklama": (
            f"{hedef.get('sube')} şubesinin günlük satış hızı "
            f"{hedef['gunluk_satis_hizi']:.2f}, {kaynak.get('sube')} şubesinin stok yeterliliği "
            f"{kaynak['stok_yeterlilik_gunu']:.1f} gün olduğu için {miktar} adet transfer önerildi."
        )
    }


def _transfer_sonucunu_temizle(model_sonucu: Any, fallback: dict, urun_adi: str) -> dict:
    """LLM transfer çıktısını standart hale getirir."""
    if not isinstance(model_sonucu, dict):
        return fallback

    transfer_et = model_sonucu.get("transfer_et", fallback.get("transfer_et", False))

    if isinstance(transfer_et, str):
        transfer_et = transfer_et.lower() in ["true", "evet", "yes", "1"]

    miktar = _guvenli_int(model_sonucu.get("miktar", fallback.get("miktar", 0)), 0)
    kar = _guvenli_sayi(
        model_sonucu.get(
            "kurtarilan_kar_tahmini",
            fallback.get("kurtarilan_kar_tahmini", 0.0)
        ),
        0.0
    )

    if miktar <= 0:
        transfer_et = False

    return {
        "transfer_et": bool(transfer_et),
        "urun": model_sonucu.get("urun") or fallback.get("urun") or urun_adi,
        "kaynak_sube": model_sonucu.get("kaynak_sube") or fallback.get("kaynak_sube", ""),
        "hedef_sube": model_sonucu.get("hedef_sube") or fallback.get("hedef_sube", ""),
        "miktar": miktar,
        "kurtarilan_kar_tahmini": round(kar, 2),
        "aciklama": str(model_sonucu.get("aciklama") or fallback.get("aciklama", ""))
    }


def transfer_onerisi_uret(urun_adi: str, sube_verileri: list) -> dict:
    """Şube satış verilerini analiz ederek akıllı transfer önerisi üretir."""
    fallback = _transfer_fallback_uret(urun_adi, sube_verileri)

    prompt = f"""
Sen KARVENTER adlı market zinciri stok ve kâr optimizasyon sisteminin yerel LLM motorusun.
Görevin, ürün bazında şube stoklarını ve satış hızlarını analiz ederek transfer önerisi üretmektir.

Ürün:
{urun_adi}

Şube verileri:
{json.dumps(sube_verileri, ensure_ascii=False)}

Backend tarafından hesaplanan açıklanabilir baz öneri:
{json.dumps(fallback, ensure_ascii=False)}

Karar kuralları:
- Satış hızı yüksek olan şube hedef şube olmaya daha yakındır.
- Stok yeterlilik günü çok yüksek olan şube kaynak şube olmaya daha yakındır.
- Transfer miktarı kaynak şubeyi tamamen boşaltmamalıdır.
- Kâr tahmini birim fiyat * kâr marjı * transfer miktarı ile uyumlu olmalıdır.
- Transfer mantıklı değilse transfer_et false dön.
- Ürün adını mutlaka "urun" alanında döndür.
- Sadece JSON döndür, açıklama dışında ek metin yazma.

Dönüş formatı:
{{
  "transfer_et": true,
  "urun": "{urun_adi}",
  "kaynak_sube": "Kaynak şube adı",
  "hedef_sube": "Hedef şube adı",
  "miktar": 0,
  "kurtarilan_kar_tahmini": 0.0,
  "aciklama": "Kısa teknik açıklama"
}}
"""

    try:
        model_sonucu = _ollama_json_istegi(prompt, timeout=120)
        return _transfer_sonucunu_temizle(model_sonucu, fallback, urun_adi)
    except Exception as hata:
        fallback["hata"] = str(hata)
        fallback["aciklama"] = (
            fallback.get("aciklama", "")
            + " Local LLM bağlantısı kurulamadığı için açıklanabilir fallback transfer analizi kullanıldı."
        )
        return fallback