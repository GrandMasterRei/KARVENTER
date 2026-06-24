import random
from datetime import datetime, timedelta, time

from sqlalchemy import text

from .database import SessionLocal, engine, Base
from . import models
from .auth import sifrele


def reset_public_schema_for_seed():
    """Seed komutu test/demo verisi içindir; yarım kalmış tablo/type kalıntılarını da temizler."""
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))



RANDOM_SEED = 42
DAYS = 180


MARKET_PROFILES = [
    {
        "name": "KARVENTER Kadıköy",
        "city": "İstanbul",
        "demand": 1.45,
        "stock_type": "high_demand",
        "bias": {
            "Süt Ürünleri": 1.30,
            "Fırın": 1.25,
            "İçecek": 1.20,
            "Kahvaltılık": 1.20,
            "Atıştırmalık": 1.15,
        },
    },
    {
        "name": "KARVENTER Ümraniye",
        "city": "İstanbul",
        "demand": 0.75,
        "stock_type": "overstock",
        "bias": {
            "Temel Gıda": 1.10,
            "Temizlik": 1.10,
            "Ev Bakım": 1.10,
        },
    },
    {
        "name": "KARVENTER Beşiktaş",
        "city": "İstanbul",
        "demand": 1.35,
        "stock_type": "premium",
        "bias": {
            "Kahvaltılık": 1.25,
            "İçecek": 1.20,
            "Kişisel Bakım": 1.20,
            "Atıştırmalık": 1.20,
        },
    },
    {
        "name": "KARVENTER Çankaya",
        "city": "Ankara",
        "demand": 1.30,
        "stock_type": "balanced",
        "bias": {
            "Temel Gıda": 1.25,
            "Süt Ürünleri": 1.15,
            "Kahvaltılık": 1.15,
        },
    },
    {
        "name": "KARVENTER Keçiören",
        "city": "Ankara",
        "demand": 1.00,
        "stock_type": "family",
        "bias": {
            "Temel Gıda": 1.30,
            "Bebek Ürünleri": 1.25,
            "Temizlik": 1.15,
        },
    },
    {
        "name": "KARVENTER Yenimahalle",
        "city": "Ankara",
        "demand": 0.85,
        "stock_type": "overstock",
        "bias": {
            "Temizlik": 1.20,
            "Ev Bakım": 1.20,
            "Temel Gıda": 1.10,
        },
    },
    {
        "name": "KARVENTER Karşıyaka",
        "city": "İzmir",
        "demand": 1.25,
        "stock_type": "balanced",
        "bias": {
            "İçecek": 1.30,
            "Kahvaltılık": 1.20,
            "Meyve Sebze": 1.15,
        },
    },
    {
        "name": "KARVENTER Bornova",
        "city": "İzmir",
        "demand": 1.40,
        "stock_type": "student",
        "bias": {
            "Atıştırmalık": 1.45,
            "İçecek": 1.35,
            "Fırın": 1.20,
            "Dondurulmuş Gıda": 1.15,
        },
    },
    {
        "name": "KARVENTER Konak",
        "city": "İzmir",
        "demand": 1.15,
        "stock_type": "center",
        "bias": {
            "Temel Gıda": 1.15,
            "İçecek": 1.15,
            "Kişisel Bakım": 1.10,
            "Meyve Sebze": 1.10,
        },
    },
    {
        "name": "KARVENTER İstanbul Depo",
        "city": "İstanbul",
        "demand": 0.0,
        "stock_type": "depot",
        "is_depot": True,
        "bias": {},
    },
    {
        "name": "KARVENTER Ankara Depo",
        "city": "Ankara",
        "demand": 0.0,
        "stock_type": "depot",
        "is_depot": True,
        "bias": {},
    },
    {
        "name": "KARVENTER İzmir Depo",
        "city": "İzmir",
        "demand": 0.0,
        "stock_type": "depot",
        "is_depot": True,
        "bias": {},
    },
]


# Ürün formatı:
# kategori: [(ad, satış_fiyatı_TL, net_katkı_marjı, min_stok, günlük_hareketlilik, raf_omru_gun, bozulabilir_mi)]
# Not: net_katkı_marjı; tedarik, taşıma, fire ve operasyon payı düşüldükten sonra
# dashboard/transfer kararında kullanılacak savunulabilir marjdır.
PRODUCT_CATALOG = {
    "Süt Ürünleri": [
        ("Tam Yağlı Süt 1L", 49.0, 0.09, 70, 2.30, 18, True),
        ("Laktozsuz Süt 1L", 62.0, 0.10, 40, 1.10, 25, True),
        ("Yoğurt 1.5kg", 105.0, 0.10, 45, 1.45, 22, True),
        ("Beyaz Peynir 500g", 175.0, 0.12, 28, 0.85, 60, True),
        ("Kaşar Peyniri 700g", 265.0, 0.13, 24, 0.70, 75, True),
        ("Tereyağı 250g", 165.0, 0.11, 22, 0.55, 90, True),
    ],
    "Fırın": [
        ("Tost Ekmeği", 55.0, 0.08, 60, 2.10, 6, True),
        ("Tam Buğday Ekmeği", 45.0, 0.07, 50, 1.75, 5, True),
        ("Çavdar Ekmeği", 48.0, 0.08, 40, 1.20, 5, True),
        ("Simit 4'lü Paket", 45.0, 0.09, 45, 1.60, 3, True),
        ("Sandviç Ekmeği 6'lı", 70.0, 0.09, 35, 1.25, 6, True),
        ("Lavaş 10'lu", 75.0, 0.08, 30, 1.05, 12, True),
    ],
    "İçecek": [
        ("Kola 1L", 65.0, 0.12, 65, 2.25, 270, False),
        ("Maden Suyu 6'lı", 78.0, 0.13, 55, 1.85, 365, False),
        ("Portakal Suyu 1L", 92.0, 0.11, 45, 1.25, 120, True),
        ("Soğuk Çay 1L", 72.0, 0.13, 50, 1.55, 240, False),
        ("Ayran 1L", 46.0, 0.10, 60, 2.00, 18, True),
        ("Su 1.5L 6'lı", 78.0, 0.08, 80, 2.40, 365, False),
    ],
    "Kahvaltılık": [
        ("Yumurta 30'lu", 195.0, 0.08, 38, 1.45, 28, True),
        ("Zeytin 500g", 185.0, 0.13, 30, 0.85, 180, True),
        ("Bal 850g", 330.0, 0.16, 18, 0.38, 720, False),
        ("Reçel 380g", 105.0, 0.14, 22, 0.65, 365, False),
        ("Fındık Kreması 400g", 155.0, 0.15, 25, 0.90, 365, False),
        ("Krem Peynir 300g", 98.0, 0.10, 30, 0.95, 45, True),
    ],
    "Atıştırmalık": [
        ("Patates Cipsi 150g", 68.0, 0.18, 55, 2.10, 180, False),
        ("Çikolata 80g", 52.0, 0.20, 65, 2.20, 300, False),
        ("Kraker 100g", 36.0, 0.16, 55, 1.85, 240, False),
        ("Protein Bar 55g", 78.0, 0.20, 25, 0.62, 180, False),
        ("Kuruyemiş Karışık 250g", 195.0, 0.16, 25, 0.70, 240, False),
        ("Bisküvi 3'lü Paket", 58.0, 0.15, 48, 1.45, 240, False),
    ],
    "Temel Gıda": [
        ("Ayçiçek Yağı 5L", 525.0, 0.055, 28, 0.70, 540, False),
        ("Pirinç 2.5kg", 235.0, 0.07, 34, 0.90, 720, False),
        ("Makarna 500g", 39.0, 0.10, 70, 1.95, 720, False),
        ("Un 5kg", 175.0, 0.06, 30, 0.85, 365, False),
        ("Toz Şeker 5kg", 235.0, 0.055, 30, 0.72, 720, False),
        ("Mercimek 1kg", 98.0, 0.08, 34, 1.00, 720, False),
    ],
    "Temizlik": [
        ("Çamaşır Deterjanı 4kg", 430.0, 0.14, 18, 0.42, 900, False),
        ("Bulaşık Deterjanı 1.5L", 145.0, 0.13, 24, 0.70, 900, False),
        ("Yüzey Temizleyici 2.5L", 125.0, 0.12, 24, 0.75, 900, False),
        ("Çamaşır Suyu 2L", 72.0, 0.09, 38, 1.05, 720, False),
        ("Kağıt Havlu 12'li", 245.0, 0.11, 22, 0.55, 900, False),
        ("Tuvalet Kağıdı 32'li", 340.0, 0.10, 22, 0.50, 900, False),
    ],
    "Kişisel Bakım": [
        ("Şampuan 500ml", 185.0, 0.17, 22, 0.58, 900, False),
        ("Duş Jeli 500ml", 150.0, 0.16, 22, 0.55, 900, False),
        ("Diş Macunu 100ml", 112.0, 0.15, 30, 0.82, 900, False),
        ("Sıvı Sabun 1L", 108.0, 0.13, 30, 0.90, 900, False),
        ("Deodorant 150ml", 165.0, 0.18, 22, 0.50, 900, False),
        ("Tıraş Köpüğü 200ml", 150.0, 0.17, 18, 0.40, 900, False),
    ],
    "Dondurulmuş Gıda": [
        ("Dondurulmuş Pizza", 195.0, 0.14, 22, 0.70, 180, True),
        ("Patates Kızartması 1kg", 128.0, 0.12, 30, 1.00, 180, True),
        ("Dondurulmuş Köfte 500g", 245.0, 0.13, 18, 0.55, 180, True),
        ("Dondurulmuş Sebze 1kg", 118.0, 0.11, 26, 0.80, 180, True),
        ("Mantı 500g", 172.0, 0.13, 22, 0.65, 150, True),
        ("Dondurma 1L", 138.0, 0.16, 30, 1.15, 120, True),
    ],
    "Meyve Sebze": [
        ("Domates 1kg", 66.0, 0.08, 45, 1.40, 9, True),
        ("Salatalık 1kg", 58.0, 0.08, 45, 1.30, 7, True),
        ("Patates 2kg", 92.0, 0.07, 50, 1.45, 30, True),
        ("Soğan 2kg", 82.0, 0.07, 50, 1.35, 45, True),
        ("Muz 1kg", 108.0, 0.10, 38, 1.05, 7, True),
        ("Elma 1kg", 82.0, 0.09, 42, 1.10, 21, True),
    ],
    "Ev Bakım": [
        ("Alüminyum Folyo", 95.0, 0.13, 22, 0.45, 900, False),
        ("Streç Film", 88.0, 0.14, 22, 0.50, 900, False),
        ("Buzdolabı Poşeti", 62.0, 0.15, 30, 0.72, 900, False),
        ("Çöp Poşeti Büyük Boy", 112.0, 0.14, 30, 0.78, 900, False),
        ("Saklama Kabı 3'lü", 185.0, 0.17, 12, 0.30, 900, False),
        ("Pişirme Kağıdı", 75.0, 0.13, 22, 0.45, 900, False),
    ],
    "Bebek Ürünleri": [
        ("Bebek Bezi 4 Numara", 485.0, 0.075, 22, 0.45, 900, False),
        ("Islak Mendil 12'li", 275.0, 0.09, 26, 0.60, 900, False),
        ("Bebek Şampuanı", 165.0, 0.13, 18, 0.35, 900, False),
        ("Bebek Maması 800g", 650.0, 0.055, 18, 0.30, 365, True),
        ("Bebek Losyonu", 195.0, 0.13, 14, 0.25, 900, False),
        ("Alıştırma Bardağı", 128.0, 0.15, 14, 0.20, 900, False),
    ],
}


TRANSFER_SCENARIO_PRODUCTS = [
    "Tam Yağlı Süt 1L",
    "Tost Ekmeği",
    "Kola 1L",
    "Patates Cipsi 150g",
    "Makarna 500g",
    "Ayran 1L",
    "Yumurta 30'lu",
    "Domates 1kg",
]


def reset_database(db):
    # Seed yeniden çalıştırıldığında kullanıcıya bağlı AI mesajları, işlem geçmişi
    # ve stok hareketleri gibi yeni tablolar FK hatası üretmemeli. Bu nedenle
    # silme işlemi model bağımlılık sırasına göre otomatik yapılır.
    db.flush()
    for table in reversed(models.Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()


def get_market_profile(market_name):
    for profile in MARKET_PROFILES:
        if profile["name"] == market_name:
            return profile

    return {
        "name": market_name,
        "city": "",
        "demand": 1.0,
        "stock_type": "balanced",
        "is_depot": False,
        "bias": {},
    }


def get_product_meta(product_name):
    for category, items in PRODUCT_CATALOG.items():
        for item in items:
            if item[0] == product_name:
                return {
                    "category": category,
                    "unit_price": item[1],
                    "profit_margin": item[2],
                    "min_stock_level": item[3],
                    "velocity": item[4],
                    "shelf_life_days": item[5],
                    "is_perishable": item[6],
                }

    return {
        "category": "Genel",
        "unit_price": 50.0,
        "profit_margin": 0.20,
        "min_stock_level": 30,
        "velocity": 2.0,
        "shelf_life_days": 180,
        "is_perishable": True,
    }


def seasonal_factor(category, current_date):
    month = current_date.month
    weekday = current_date.weekday()

    factor = 1.0

    if weekday in [5, 6]:
        if category in ["İçecek", "Atıştırmalık", "Fırın", "Dondurulmuş Gıda"]:
            factor *= 1.25
        elif category in ["Temel Gıda", "Meyve Sebze"]:
            factor *= 1.10

    if month in [6, 7, 8]:
        if category in ["İçecek", "Dondurulmuş Gıda", "Meyve Sebze"]:
            factor *= 1.35

    if month in [11, 12, 1, 2]:
        if category in ["Temizlik", "Temel Gıda", "Kişisel Bakım"]:
            factor *= 1.15

    return factor


def create_markets(db):
    markets = []

    for profile in MARKET_PROFILES:
        market = models.Market(
            name=profile["name"],
            city=profile["city"],
            is_depot=profile.get("is_depot", False),
            is_active=True
        )
        db.add(market)
        markets.append(market)

    db.commit()

    for market in markets:
        db.refresh(market)

    return markets


def create_products(db):
    products = []

    for category, items in PRODUCT_CATALOG.items():
        for (
            product_name,
            unit_price,
            profit_margin,
            min_stock_level,
            velocity,
            shelf_life_days,
            is_perishable
        ) in items:
            category_index = list(PRODUCT_CATALOG.keys()).index(category) + 1
            product_index = len(products) + 1
            special_barcodes = {
                "Tam Yağlı Süt 1L": "8690000000012",
                "Elma 1kg": "8690000000609",
            }
            barcode = special_barcodes.get(product_name, f"869{category_index:02d}{product_index:07d}")

            product = models.Product(
                product_name=product_name,
                category=category,
                barcode=barcode,
                unit_price=unit_price,
                profit_margin=profit_margin,
                min_stock_level=min_stock_level,
                shelf_life_days=shelf_life_days,
                is_perishable=is_perishable,
                is_active=True
            )

            db.add(product)
            products.append(product)

    db.commit()

    for product in products:
        db.refresh(product)

    return products


def create_users(db, markets):
    admin = models.Kullanici(
        kullanici_adi="admin",
        sifre_hash=sifrele("admin123"),
        rol="admin",
        market_id=None,
        is_active=True
    )
    db.add(admin)

    for market in markets:
        if getattr(market, "is_depot", False):
            continue

        short_name = (
            market.name
            .replace("KARVENTER ", "")
            .lower()
            .replace("ı", "i")
            .replace("ğ", "g")
            .replace("ü", "u")
            .replace("ş", "s")
            .replace("ö", "o")
            .replace("ç", "c")
            .replace(" ", "")
        )

        staff = models.Kullanici(
            kullanici_adi=f"personel_{short_name}",
            sifre_hash=sifrele("personel123"),
            rol="staff",
            market_id=market.market_id,
            is_active=True
        )
        db.add(staff)

    db.commit()


def calculate_current_quantity(market, product):
    profile = get_market_profile(market.name)
    meta = get_product_meta(product.product_name)

    base = product.min_stock_level
    velocity = meta["velocity"]
    category_bias = profile["bias"].get(product.category, 1.0)

    if profile.get("stock_type") == "depot" or getattr(market, "is_depot", False):
        quantity = int(base * random.uniform(9.0, 16.0))
        if product.product_name in TRANSFER_SCENARIO_PRODUCTS:
            quantity = int(base * random.uniform(13.0, 20.0))
        return max(0, quantity)

    if profile["stock_type"] == "overstock":
        quantity = int(base * random.uniform(4.5, 8.5))
    elif profile["stock_type"] == "high_demand":
        if velocity >= 4.0 or category_bias >= 1.20:
            quantity = int(base * random.uniform(0.25, 0.85))
        else:
            quantity = int(base * random.uniform(1.1, 2.3))
    elif profile["stock_type"] == "student":
        if product.category in ["Atıştırmalık", "İçecek", "Fırın"]:
            quantity = int(base * random.uniform(0.35, 0.95))
        else:
            quantity = int(base * random.uniform(1.1, 2.5))
    elif profile["stock_type"] == "premium":
        if product.category in ["Kahvaltılık", "Kişisel Bakım", "Atıştırmalık"]:
            quantity = int(base * random.uniform(0.45, 1.20))
        else:
            quantity = int(base * random.uniform(1.2, 2.6))
    else:
        quantity = int(base * random.uniform(1.2, 3.0))

    if market.name == "KARVENTER Ümraniye" and product.product_name in TRANSFER_SCENARIO_PRODUCTS:
        quantity = int(base * random.uniform(6.0, 9.5))

    if market.name == "KARVENTER Yenimahalle" and product.product_name in TRANSFER_SCENARIO_PRODUCTS:
        quantity = int(base * random.uniform(4.5, 7.0))

    if market.name == "KARVENTER Kadıköy" and product.product_name in TRANSFER_SCENARIO_PRODUCTS:
        quantity = int(base * random.uniform(0.20, 0.70))

    if market.name == "KARVENTER Bornova" and product.category in ["Atıştırmalık", "İçecek"]:
        quantity = int(base * random.uniform(0.30, 0.85))

    return max(0, quantity)


def split_quantity(total_quantity):
    if total_quantity <= 0:
        return []

    if total_quantity < 20:
        return [total_quantity]

    part_count = random.choice([2, 2, 3])
    remaining = total_quantity
    parts = []

    for index in range(part_count - 1):
        max_part = max(1, remaining - (part_count - index - 1))
        part = random.randint(max(1, total_quantity // 8), max(1, max_part // 2))
        parts.append(part)
        remaining -= part

    parts.append(remaining)
    return [part for part in parts if part > 0]


def batch_status(expiry_date, remaining_quantity):
    if remaining_quantity <= 0:
        return "depleted"

    if not expiry_date:
        return "active"

    days_left = (expiry_date.date() - datetime.utcnow().date()).days

    if days_left < 0:
        return "expired"

    if days_left <= 14:
        return "near_expiry"

    return "active"


def create_stock_batches_and_summary(db, markets, products):
    now = datetime.utcnow()
    batches = []
    stocks = []

    for market in markets:
        for product in products:
            total_quantity = calculate_current_quantity(market, product)
            parts = split_quantity(total_quantity)

            for part_index, quantity in enumerate(parts):
                meta = get_product_meta(product.product_name)

                if product.is_perishable:
                    received_days_ago = random.randint(1, max(2, min(90, product.shelf_life_days)))
                    received_date = now - timedelta(days=received_days_ago)
                    expiry_date = received_date + timedelta(
                        days=product.shelf_life_days + random.randint(-2, 4)
                    )

                    # SKT senaryolarını özellikle güçlendiriyoruz.
                    if (
                        market.name in ["KARVENTER Ümraniye", "KARVENTER Yenimahalle"]
                        and product.product_name in TRANSFER_SCENARIO_PRODUCTS
                        and part_index == 0
                    ):
                        expiry_date = now + timedelta(days=random.randint(4, 13))

                    if (
                        market.name == "KARVENTER Kadıköy"
                        and product.product_name in TRANSFER_SCENARIO_PRODUCTS
                        and part_index == 0
                    ):
                        expiry_date = now + timedelta(days=random.randint(10, 25))
                else:
                    received_days_ago = random.randint(1, 120)
                    received_date = now - timedelta(days=received_days_ago)
                    expiry_date = received_date + timedelta(days=product.shelf_life_days)

                lot_code = (
                    f"LOT-{product.product_id:03d}-{market.market_id:02d}-"
                    f"{received_date.strftime('%Y%m%d')}-{part_index + 1}"
                )

                batch = models.StockBatch(
                    product_id=product.product_id,
                    market_id=market.market_id,
                    lot_code=lot_code,
                    initial_quantity=quantity,
                    remaining_quantity=quantity,
                    received_date=received_date,
                    expiry_date=expiry_date,
                    # Ürün tedarik maliyeti yaklaşık değerdir.
                    # Raporlarda kullanılan profit_margin ise taşıma, fire ve operasyon payı düşülmüş net katkı marjıdır.
                    unit_cost=round(product.unit_price * random.uniform(0.72, 0.90), 2),
                    status=batch_status(expiry_date, quantity)
                )

                batches.append(batch)

            stocks.append(
                models.Stock(
                    product_id=product.product_id,
                    market_id=market.market_id,
                    quantity=total_quantity
                )
            )

    db.bulk_save_objects(batches)
    db.bulk_save_objects(stocks)
    db.commit()

    return len(batches), len(stocks)


def create_sales_history(db, markets, products):
    """
    180 günlük POS/ERP satış geçmişi üretir.
    Dönem filtreleri anlamlı çalışsın diye satışlar tek güne yığılmaz;
    son haftalar ile eski dönemler arasında doğal talep farkı oluşturulur.
    """
    today = datetime.now().date()
    start_date = today - timedelta(days=DAYS - 1)

    sales_batch = []
    total_sales = 0

    for day_index in range(DAYS):
        current_date = start_date + timedelta(days=day_index)
        progress = day_index / max(1, DAYS - 1)

        # Son dönemlerde az da olsa büyüyen talep: 7/30/90/180 gün filtreleri belirgin değişir.
        recency_factor = 0.72 + (progress * 0.48)
        month_start_factor = 1.18 if current_date.day in [1, 2, 3, 4, 5] else 1.0
        weekend_factor = 1.10 if current_date.weekday() in [5, 6] else 1.0

        # Belli günlerde zincir genelinde kampanya etkisi.
        campaign_factor = 1.0
        if day_index % 29 in [0, 1, 2]:
            campaign_factor = 1.22
        elif day_index % 43 == 0:
            campaign_factor = 0.86

        for market in markets:
            if getattr(market, "is_depot", False):
                continue

            profile = get_market_profile(market.name)

            for product in products:
                meta = get_product_meta(product.product_name)

                velocity = meta["velocity"]
                category_bias = profile["bias"].get(product.category, 1.0)
                season = seasonal_factor(product.category, current_date)

                demand_score = (
                    velocity
                    * profile["demand"]
                    * category_bias
                    * season
                    * month_start_factor
                    * weekend_factor
                    * campaign_factor
                    * recency_factor
                )

                # Hızlı ürünler daha sık, yavaş ürünler daha seyrek satış kaydı üretir.
                active_probability = min(0.92, 0.12 + (velocity * 0.14))

                if random.random() > active_probability:
                    continue

                quantity = int(round(demand_score * random.uniform(0.55, 1.65)))

                if quantity <= 0:
                    continue

                if market.name == "KARVENTER Kadıköy" and product.product_name in TRANSFER_SCENARIO_PRODUCTS:
                    quantity = int(quantity * random.uniform(1.35, 2.15))

                if market.name == "KARVENTER Ümraniye" and product.product_name in TRANSFER_SCENARIO_PRODUCTS:
                    quantity = max(1, int(quantity * random.uniform(0.25, 0.60)))

                if market.name == "KARVENTER Bornova" and product.category in ["Atıştırmalık", "İçecek"]:
                    quantity = int(quantity * random.uniform(1.25, 2.00))

                sale_time = time(
                    hour=random.randint(9, 22),
                    minute=random.randint(0, 59),
                    second=random.randint(0, 59)
                )

                sales_batch.append(
                    models.Sale(
                        product_id=product.product_id,
                        market_id=market.market_id,
                        quantity=max(1, quantity),
                        sale_date=datetime.combine(current_date, sale_time)
                    )
                )

                total_sales += 1

                if len(sales_batch) >= 5000:
                    db.bulk_save_objects(sales_batch)
                    db.commit()
                    sales_batch.clear()

    if sales_batch:
        db.bulk_save_objects(sales_batch)
        db.commit()

    return total_sales

def get_product(db, name):
    return db.query(models.Product).filter(models.Product.product_name == name).first()


def get_market(db, name):
    return db.query(models.Market).filter(models.Market.name == name).first()


def create_sample_transfers(db):
    scenarios = [
        ("Tam Yağlı Süt 1L", "KARVENTER Ümraniye", "KARVENTER Kadıköy", 90, "suggested"),
        ("Tost Ekmeği", "KARVENTER Ümraniye", "KARVENTER Kadıköy", 75, "suggested"),
        ("Patates Cipsi 150g", "KARVENTER Yenimahalle", "KARVENTER Bornova", 120, "approved"),
        ("Kola 1L", "KARVENTER Ümraniye", "KARVENTER Bornova", 110, "completed"),
        ("Makarna 500g", "KARVENTER Yenimahalle", "KARVENTER Çankaya", 130, "completed"),
        ("Ayran 1L", "KARVENTER Ümraniye", "KARVENTER Kadıköy", 80, "rejected"),
    ]

    created = 0

    for product_name, source_name, target_name, quantity, status in scenarios:
        product = get_product(db, product_name)
        source = get_market(db, source_name)
        target = get_market(db, target_name)

        if not product or not source or not target:
            continue

        estimated_profit_gain = round(quantity * product.unit_price * product.profit_margin, 2)

        transfer = models.Transfer(
            product_id=product.product_id,
            source_market_id=source.market_id,
            target_market_id=target.market_id,
            quantity=quantity,
            estimated_profit_gain=estimated_profit_gain,
            estimated_waste_prevented=random.randint(10, 60),
            status=status,
            ai_explanation=(
                f"{source.name} şubesinde stok fazlası, {target.name} şubesinde ise "
                f"son 30 günlük satış hızı daha yüksek olduğu için transfer önerildi."
            ),
            rejection_reason="Şube operasyon yoğunluğu nedeniyle ertelendi" if status == "rejected" else None,
            created_at=datetime.utcnow() - timedelta(days=random.randint(1, 20)),
            approved_at=datetime.utcnow() - timedelta(days=random.randint(1, 10)) if status in ["approved", "completed"] else None,
            completed_at=datetime.utcnow() - timedelta(days=random.randint(1, 5)) if status == "completed" else None,
        )

        db.add(transfer)
        created += 1

    db.commit()
    return created


def create_alerts(db):
    created = 0

    # Kritik stok uyarıları
    critical_stocks = db.query(models.Stock).all()

    for stock in critical_stocks:
        product = db.query(models.Product).filter(models.Product.product_id == stock.product_id).first()
        market = db.query(models.Market).filter(models.Market.market_id == stock.market_id).first()

        if not product or not market or getattr(market, "is_depot", False):
            continue

        if stock.quantity <= product.min_stock_level:
            alert = models.Alert(
                market_id=market.market_id,
                product_id=product.product_id,
                alert_type="critical_stock",
                severity="high",
                title="Kritik stok seviyesi",
                message=f"{market.name} şubesinde {product.product_name} minimum stok seviyesinin altında.",
                status="open"
            )
            db.add(alert)
            created += 1

    # SKT uyarıları
    near_expiry_batches = db.query(models.StockBatch).filter(
        models.StockBatch.status == "near_expiry",
        models.StockBatch.remaining_quantity > 0
    ).limit(40).all()

    for batch in near_expiry_batches:
        if batch.market and getattr(batch.market, "is_depot", False):
            continue

        alert = models.Alert(
            market_id=batch.market_id,
            product_id=batch.product_id,
            alert_type="near_expiry",
            severity="critical" if batch.remaining_quantity > 50 else "medium",
            title="SKT yaklaşan ürün",
            message=(
                f"{batch.lot_code} lot kodlu ürün partisinde "
                f"{batch.remaining_quantity} adet SKT riski bulunmaktadır."
            ),
            status="open"
        )
        db.add(alert)
        created += 1

    # Personel bildirimi örnekleri
    staff_reports = [
        ("KARVENTER Kadıköy", "Tam Yağlı Süt 1L", "transfer_request", "Kadıköy şubesinde süt talebi yüksek, ek stok talep ediliyor."),
        ("KARVENTER Bornova", "Kola 1L", "transfer_request", "Bornova şubesinde içecek rafı hızlı boşalıyor."),
        ("KARVENTER Ümraniye", "Tost Ekmeği", "near_expiry", "Ümraniye şubesinde ekmek partisinin SKT riski arttı."),
    ]

    for market_name, product_name, alert_type, message in staff_reports:
        market = get_market(db, market_name)
        product = get_product(db, product_name)

        if not market or not product:
            continue

        alert = models.Alert(
            market_id=market.market_id,
            product_id=product.product_id,
            alert_type=alert_type,
            severity="medium",
            title="Personel bildirimi",
            message=message,
            status="open"
        )
        db.add(alert)
        created += 1

    db.commit()
    return created


def print_summary(db, batch_count, stock_count, sale_count, transfer_count, alert_count):
    print("\nKARVENTER başlangıç veri seti oluşturuldu.")
    print("--------------------------------------")
    print(f"Kullanıcı sayısı       : {db.query(models.Kullanici).count()}")
    print(f"Şube sayısı            : {db.query(models.Market).filter(models.Market.is_depot == False).count()}")
    print(f"Depo sayısı            : {db.query(models.Market).filter(models.Market.is_depot == True).count()}")
    print(f"Ürün sayısı            : {db.query(models.Product).count()}")
    print(f"Stok özeti kaydı       : {stock_count}")
    print(f"Stok parti kaydı       : {batch_count}")
    print(f"Satış geçmişi kaydı    : {sale_count}")
    print(f"Transfer görev kaydı   : {transfer_count}")
    print(f"Uyarı/Bildirim kaydı   : {alert_count}")
    print("--------------------------------------")
    print("Admin kullanıcı:")
    print("  Kullanıcı adı: admin")
    print("  Şifre        : admin123")
    print("")
    print("Personel kullanıcı örneği:")
    print("  Kullanıcı adı: personel_kadikoy")
    print("  Şifre        : personel123")
    print("--------------------------------------\n")


def run_seed():
    random.seed(RANDOM_SEED)

    reset_public_schema_for_seed()
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        print("Eski veriler temizleniyor...")
        reset_database(db)

        print("Şubeler oluşturuluyor...")
        markets = create_markets(db)

        print("Ürün kataloğu oluşturuluyor...")
        products = create_products(db)

        print("Kullanıcılar oluşturuluyor...")
        create_users(db, markets)

        print("Güncel stok partileri ve stok özetleri oluşturuluyor...")
        batch_count, stock_count = create_stock_batches_and_summary(db, markets, products)

        print(f"{DAYS} günlük satış geçmişi oluşturuluyor...")
        sale_count = create_sales_history(db, markets, products)

        print("Başlangıç transfer görevleri oluşturuluyor...")
        transfer_count = create_sample_transfers(db)

        print("Uyarılar ve personel bildirimleri oluşturuluyor...")
        alert_count = create_alerts(db)

        print_summary(
            db=db,
            batch_count=batch_count,
            stock_count=stock_count,
            sale_count=sale_count,
            transfer_count=transfer_count,
            alert_count=alert_count
        )

    finally:
        db.close()


if __name__ == "__main__":
    run_seed()