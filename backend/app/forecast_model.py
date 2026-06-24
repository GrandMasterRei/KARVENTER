"""KARVENTER gerçek veri ile eğitilmiş talep tahmin modeli entegrasyonu.

Bu modül canlı stok/satış verisini, Colab'da eğitilen scikit-learn modeliyle
birleştirir. LLM burada sayı üretmez; model sayısal tahmin yapar, backend sonucu
KARVAI ve arayüz için standart formata çevirir.
"""

from __future__ import annotations

import json
import math
import zipfile
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import text
from sqlalchemy.orm import Session


APP_DIR = Path(__file__).resolve().parent
MODEL_DIR = APP_DIR / "ml_models"
MODEL_PATH = MODEL_DIR / "karventer_demand_forecast_model.joblib"
METADATA_PATH = MODEL_DIR / "karventer_demand_forecast_metadata.json"
MODEL_ZIP_PATH = MODEL_DIR / "karventer_model.zip"

_MODEL_CACHE = None
_MODEL_LOAD_ERROR: str | None = None
_METADATA_CACHE: dict[str, Any] | None = None


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        if value is None:
            return default
        value = float(value)
        if not math.isfinite(value):
            return default
        return value
    except Exception:
        return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(round(_safe_float(value, default)))
    except Exception:
        return default


def _model_dosyalarini_hazirla() -> None:
    """Model klasöründe zip varsa ilk kullanımda açar.

    Kullanıcıya 1 GB'lık joblib dosyasını Docker image içine gömmemek için
    model klasörü volume olarak bağlanır. Bu fonksiyon hem .joblib doğrudan
    varsa hem de karventer_model.zip varsa çalışır.
    """
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    if MODEL_PATH.exists() and METADATA_PATH.exists():
        return
    if not MODEL_ZIP_PATH.exists():
        return
    with zipfile.ZipFile(MODEL_ZIP_PATH, "r") as archive:
        names = set(archive.namelist())
        needed = {
            "karventer_demand_forecast_model.joblib",
            "karventer_demand_forecast_metadata.json",
        }
        if not needed.issubset(names):
            return
        archive.extract("karventer_demand_forecast_model.joblib", MODEL_DIR)
        archive.extract("karventer_demand_forecast_metadata.json", MODEL_DIR)


def forecast_metadata() -> dict[str, Any]:
    global _METADATA_CACHE
    if _METADATA_CACHE is not None:
        return _METADATA_CACHE
    _model_dosyalarini_hazirla()
    if not METADATA_PATH.exists():
        _METADATA_CACHE = {}
        return _METADATA_CACHE
    try:
        with METADATA_PATH.open("r", encoding="utf-8") as handle:
            _METADATA_CACHE = json.load(handle)
    except Exception:
        _METADATA_CACHE = {}
    return _METADATA_CACHE


def forecast_model_load():
    global _MODEL_CACHE, _MODEL_LOAD_ERROR
    if _MODEL_CACHE is not None:
        return _MODEL_CACHE
    _model_dosyalarini_hazirla()
    if not MODEL_PATH.exists():
        _MODEL_LOAD_ERROR = (
            "Model dosyası bulunamadı. backend/app/ml_models içine "
            "karventer_model.zip veya karventer_demand_forecast_model.joblib koyun."
        )
        return None
    try:
        import joblib

        _MODEL_CACHE = joblib.load(MODEL_PATH)
        _MODEL_LOAD_ERROR = None
        return _MODEL_CACHE
    except Exception as exc:
        _MODEL_LOAD_ERROR = str(exc)
        _MODEL_CACHE = None
        return None


def forecast_model_status() -> dict[str, Any]:
    _model_dosyalarini_hazirla()
    metadata = forecast_metadata()
    loaded = forecast_model_load() is not None
    return {
        "available": MODEL_PATH.exists(),
        "loaded": loaded,
        "model_path": str(MODEL_PATH),
        "metadata_path": str(METADATA_PATH),
        "zip_path": str(MODEL_ZIP_PATH),
        "error": _MODEL_LOAD_ERROR,
        "metadata": metadata,
    }


def _season_from_month(month: int) -> str:
    if month in {12, 1, 2}:
        return "Winter"
    if month in {3, 4, 5}:
        return "Spring"
    if month in {6, 7, 8}:
        return "Summer"
    return "Autumn"


def _forecast_history(db: Session, product_id: int, market_id: int) -> list[dict[str, Any]]:
    rows = db.execute(text("""
        SELECT date, product_id, location_id, units_sold, inventory_level,
               units_ordered, price, discount, competitor_price, promotion,
               weather_condition, seasonality, epidemic, day_of_week, month,
               year, is_weekend, demand
        FROM forecast_training_data
        WHERE product_id = :product_id AND location_id = :market_id
        ORDER BY date DESC
        LIMIT 90
    """), {"product_id": product_id, "market_id": market_id}).mappings().all()
    return list(reversed([dict(row) for row in rows]))


def _current_stock_quantity(db: Session, product_id: int, market_id: int) -> float:
    row = db.execute(text("""
        SELECT quantity FROM stocks
        WHERE product_id = :product_id AND market_id = :market_id
        LIMIT 1
    """), {"product_id": product_id, "market_id": market_id}).mappings().first()
    return _safe_float(row["quantity"], 0.0) if row else 0.0


def _ortalama(series: list[float], default: float = 0.0) -> float:
    values = [_safe_float(x, 0.0) for x in series if x is not None]
    if not values:
        return default
    return sum(values) / len(values)


def _build_future_feature_rows(history: list[dict[str, Any]], current_stock: float, horizon: int = 7) -> list[dict[str, Any]]:
    if not history:
        return []

    metadata = forecast_metadata()
    feature_cols = metadata.get("feature_cols") or []
    latest = history[-1]
    last_date = latest.get("date")
    if isinstance(last_date, str):
        last_date = datetime.fromisoformat(last_date)
    if hasattr(last_date, "date") and not isinstance(last_date, datetime):
        last_date = datetime.combine(last_date, datetime.min.time())
    if not isinstance(last_date, datetime):
        last_date = datetime.utcnow()

    product_id = int(latest["product_id"])
    location_id = int(latest["location_id"])

    units_series = [_safe_float(r.get("units_sold"), 0.0) for r in history]
    demand_series = [_safe_float(r.get("demand"), 0.0) for r in history]

    base_units_ordered = max(0.0, _ortalama([r.get("units_ordered") for r in history[-14:]], _safe_float(latest.get("units_ordered"), 0.0)))
    price = _safe_float(latest.get("price"), 0.0)
    discount = _safe_float(latest.get("discount"), 0.0)
    competitor_price = _safe_float(latest.get("competitor_price"), price)
    promotion = bool(latest.get("promotion"))
    weather_condition = latest.get("weather_condition") or "Normal"
    epidemic = bool(latest.get("epidemic"))

    rows: list[dict[str, Any]] = []
    running_stock = float(current_stock)

    for day_index in range(1, horizon + 1):
        forecast_date = last_date + timedelta(days=day_index)
        month = forecast_date.month
        day_of_week = forecast_date.weekday()
        is_weekend = day_of_week in {5, 6}

        units_lag_1 = units_series[-1] if units_series else 0.0
        demand_lag_1 = demand_series[-1] if demand_series else 0.0
        units_lag_7 = units_series[-7] if len(units_series) >= 7 else units_lag_1
        demand_lag_7 = demand_series[-7] if len(demand_series) >= 7 else demand_lag_1

        row = {
            "inventory_level": max(0.0, running_stock),
            "units_ordered": base_units_ordered,
            "price": price,
            "discount": discount,
            "competitor_price": competitor_price,
            "price_gap": price - competitor_price,
            "day_of_week": day_of_week,
            "month": month,
            "year": forecast_date.year,
            "units_sold_lag_1": units_lag_1,
            "units_sold_lag_7": units_lag_7,
            "units_sold_rolling_7": _ortalama(units_series[-7:], units_lag_1),
            "units_sold_rolling_14": _ortalama(units_series[-14:], units_lag_1),
            "units_sold_rolling_30": _ortalama(units_series[-30:], units_lag_1),
            "demand_lag_1": demand_lag_1,
            "demand_lag_7": demand_lag_7,
            "demand_rolling_7": _ortalama(demand_series[-7:], demand_lag_1),
            "demand_rolling_14": _ortalama(demand_series[-14:], demand_lag_1),
            "demand_rolling_30": _ortalama(demand_series[-30:], demand_lag_1),
            "product_id": product_id,
            "location_id": location_id,
            "promotion": promotion,
            "weather_condition": weather_condition,
            "seasonality": _season_from_month(month),
            "epidemic": epidemic,
            "is_weekend": is_weekend,
            "has_discount": discount > 0,
        }

        # Metadata dışında kalan veya eksik kalan feature durumunu güvenli kapat.
        if feature_cols:
            row = {col: row.get(col) for col in feature_cols}
        rows.append(row)

        # Sonraki gün lag değerleri için model tahmini, fonksiyon sonunda güncellenecek.
        # Burada geçici olarak son bilinen değer tutulur; tahmin sonrası döngü dışından güncellenecek yapı yoktur.
        # Gerçek tahminler sequential üretildiği için aşağıdaki fonksiyonda her gün tek tek predict yapılır.

    return rows


def _fallback_tahmin(history: list[dict[str, Any]]) -> list[int]:
    if not history:
        return [0, 0, 0, 0, 0, 0, 0]
    last_7 = [_safe_float(r.get("demand"), 0.0) for r in history[-7:]]
    last_30 = [_safe_float(r.get("demand"), 0.0) for r in history[-30:]]
    base = _ortalama(last_7, _ortalama(last_30, 0.0))
    return [max(0, int(round(base))) for _ in range(7)]


def model_talep_tahmini_uret(db: Session, product_id: int, market_id: int, product_name: str, category: str) -> dict[str, Any]:
    """Eğitilmiş ExtraTrees modelinden 7 günlük demand tahmini üretir."""
    history = _forecast_history(db, product_id, market_id)
    fallback = _fallback_tahmin(history)
    if len(history) < 14:
        return {
            "tahmin": fallback,
            "guven": "dusuk",
            "model_used": False,
            "aciklama": "Bu ürün/lokasyon için yeterli forecast geçmişi olmadığı için istatistiksel ortalama kullanıldı.",
        }

    model = forecast_model_load()
    metadata = forecast_metadata()
    if model is None:
        return {
            "tahmin": fallback,
            "guven": "dusuk",
            "model_used": False,
            "model_error": _MODEL_LOAD_ERROR,
            "aciklama": "Eğitilmiş model dosyası yüklenemediği için son dönem talep ortalamasıyla güvenli tahmin üretildi.",
        }

    try:
        import pandas as pd

        latest = history[-1]
        current_stock = _current_stock_quantity(db, product_id, market_id)
        future_rows = _build_future_feature_rows(history, current_stock, horizon=7)

        # Sequential üretim: her günün tahmini sonraki günün lag/rolling değerlerine eklenir.
        demand_series = [_safe_float(r.get("demand"), 0.0) for r in history]
        units_series = [_safe_float(r.get("units_sold"), 0.0) for r in history]
        predictions: list[int] = []
        running_stock = float(current_stock)

        for day_index, row in enumerate(future_rows, start=1):
            row = dict(row)
            row["inventory_level"] = max(0.0, running_stock)
            row["units_sold_lag_1"] = units_series[-1] if units_series else 0.0
            row["units_sold_lag_7"] = units_series[-7] if len(units_series) >= 7 else row["units_sold_lag_1"]
            row["units_sold_rolling_7"] = _ortalama(units_series[-7:], row["units_sold_lag_1"])
            row["units_sold_rolling_14"] = _ortalama(units_series[-14:], row["units_sold_lag_1"])
            row["units_sold_rolling_30"] = _ortalama(units_series[-30:], row["units_sold_lag_1"])
            row["demand_lag_1"] = demand_series[-1] if demand_series else 0.0
            row["demand_lag_7"] = demand_series[-7] if len(demand_series) >= 7 else row["demand_lag_1"]
            row["demand_rolling_7"] = _ortalama(demand_series[-7:], row["demand_lag_1"])
            row["demand_rolling_14"] = _ortalama(demand_series[-14:], row["demand_lag_1"])
            row["demand_rolling_30"] = _ortalama(demand_series[-30:], row["demand_lag_1"])

            feature_cols = metadata.get("feature_cols") or list(row.keys())
            frame = pd.DataFrame([{col: row.get(col) for col in feature_cols}])
            raw_pred = _safe_float(model.predict(frame)[0], 0.0)
            pred = max(0, min(999, int(round(raw_pred))))
            predictions.append(pred)

            demand_series.append(float(pred))
            units_series.append(float(pred))
            running_stock = max(0.0, running_stock - pred)

        r2 = _safe_float((metadata.get("metrics") or {}).get("r2"), 0.0)
        mae = _safe_float((metadata.get("metrics") or {}).get("mae"), 0.0)
        guven = "yuksek" if r2 >= 0.70 and len(history) >= 60 else "orta"
        avg_pred = _ortalama(predictions, 0.0)
        avg_recent = _ortalama([r.get("demand") for r in history[-30:]], avg_pred)
        trend = "artış" if avg_pred > avg_recent * 1.08 else "düşüş" if avg_pred < avg_recent * 0.92 else "dengeli seyir"

        return {
            "tahmin": predictions,
            "guven": guven,
            "model_used": True,
            "model_type": metadata.get("model_type", "ExtraTreesRegressor"),
            "metrics": metadata.get("metrics", {}),
            "aciklama": (
                f"{product_name} için eğitilmiş talep tahmin modeli kullanıldı. "
                f"Son 30 gün ortalaması {avg_recent:.1f}, 7 günlük model ortalaması {avg_pred:.1f} adet/gün; trend {trend}. "
                f"Test MAE {mae:.2f}, R² {r2:.4f}."
            ),
        }
    except Exception as exc:
        return {
            "tahmin": fallback,
            "guven": "dusuk",
            "model_used": False,
            "model_error": str(exc),
            "aciklama": "Model tahmini sırasında hata oluştu; güvenli istatistiksel fallback kullanıldı.",
        }
