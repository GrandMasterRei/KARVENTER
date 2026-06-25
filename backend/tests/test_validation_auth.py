import pytest
from pydantic import ValidationError
from jose import jwt
from fastapi import HTTPException

from app import schemas
from app.auth import (
    SECRET_KEY,
    ALGORITHM,
    sifrele,
    sifre_dogrula,
    token_olustur,
    admin_gerektir,
)


class DummyUser:
    def __init__(self, rol):
        self.rol = rol


def test_product_create_valid_data():
    product = schemas.ProductCreate(
        product_name="Laktosuz Süt 1L",
        category="Süt Ürünleri",
        barcode="869000000001",
        unit_price=42.5,
        profit_margin=0.18,
        min_stock_level=20,
        shelf_life_days=30,
        is_perishable=True,
    )

    assert product.product_name == "Laktosuz Süt 1L"
    assert product.unit_type == "adet"
    assert product.is_perishable is True


def test_product_create_rejects_negative_price():
    with pytest.raises(ValidationError):
        schemas.ProductCreate(
            product_name="Elma 1kg",
            category="Meyve",
            unit_price=-10,
            profit_margin=0.2,
        )


def test_market_create_default_values():
    market = schemas.MarketCreate(name="KARVENTER Kadıköy", city="İstanbul")

    assert market.name == "KARVENTER Kadıköy"
    assert market.city == "İstanbul"
    assert market.is_depot is False


def test_stock_create_rejects_negative_quantity():
    with pytest.raises(ValidationError):
        schemas.StockCreate(product_id=1, market_id=1, quantity=-1)


def test_live_sale_request_requires_positive_quantity():
    request = schemas.LiveSaleRequest(product_id=1, market_id=1, quantity=3)

    assert request.quantity == 3
    assert request.create_transfer_task is False

    with pytest.raises(ValidationError):
        schemas.LiveSaleRequest(product_id=1, market_id=1, quantity=0)


def test_sale_create_requires_positive_quantity():
    sale = schemas.SaleCreate(product_id=1, market_id=1, quantity=5)

    assert sale.product_id == 1
    assert sale.market_id == 1
    assert sale.quantity == 5

    with pytest.raises(ValidationError):
        schemas.SaleCreate(product_id=1, market_id=1, quantity=0)


def test_transfer_create_defaults_and_validation():
    transfer = schemas.TransferCreate(
        product_id=1,
        source_market_id=1,
        target_market_id=2,
        quantity=10,
    )

    assert transfer.quantity == 10
    assert transfer.estimated_profit_gain == 0.0
    assert transfer.estimated_waste_prevented == 0

    with pytest.raises(ValidationError):
        schemas.TransferCreate(
            product_id=1,
            source_market_id=1,
            target_market_id=2,
            quantity=0,
        )


def test_transfer_apply_request_validation():
    request = schemas.TransferApplyRequest(
        kaynak_sube="KARVENTER Kadıköy",
        hedef_sube="KARVENTER Ümraniye",
        urun="Laktosuz Süt 1L",
        miktar=12,
        kurtarilan_kar_tahmini=250.75,
        onlenen_fire_adedi=3,
    )

    assert request.miktar == 12
    assert request.kurtarilan_kar_tahmini == 250.75

    with pytest.raises(ValidationError):
        schemas.TransferApplyRequest(
            kaynak_sube="KARVENTER Kadıköy",
            hedef_sube="KARVENTER Ümraniye",
            urun="Laktosuz Süt 1L",
            miktar=0,
        )


def test_alert_create_default_severity():
    alert = schemas.AlertCreate(
        market_id=1,
        product_id=1,
        alert_type="stock",
        title="Kritik stok uyarısı",
        message="Kadıköy şubesinde stok kritik seviyeye düştü.",
    )

    assert alert.severity == "medium"
    assert alert.title == "Kritik stok uyarısı"


def test_active_status_update():
    status = schemas.ActiveStatusUpdate(is_active=False)

    assert status.is_active is False


def test_password_hash_and_verify():
    hashed = sifrele("admin123")

    assert hashed != "admin123"
    assert sifre_dogrula("admin123", hashed) is True
    assert sifre_dogrula("wrong-password", hashed) is False


def test_token_create_contains_subject():
    token = token_olustur({"sub": "admin", "rol": "admin"})
    payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])

    assert payload["sub"] == "admin"
    assert payload["rol"] == "admin"
    assert "exp" in payload


def test_admin_required_accepts_admin_user():
    user = DummyUser("admin")

    assert admin_gerektir(user) is user


def test_admin_required_rejects_staff_user():
    user = DummyUser("staff")

    with pytest.raises(HTTPException) as exc:
        admin_gerektir(user)

    assert exc.value.status_code == 403
    assert exc.value.detail == "Admin yetkisi gerekli"
