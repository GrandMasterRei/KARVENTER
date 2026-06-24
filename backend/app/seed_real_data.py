import csv
import random
from datetime import datetime, timedelta, time
from pathlib import Path

from sqlalchemy import text

from .database import SessionLocal, engine, Base
from . import models
from .auth import sifrele


RANDOM_SEED = 42
DATA_DIR = Path(__file__).resolve().parent / "real_data"
TODAY = datetime.utcnow().date()


MARKET_CATEGORY_MAP = {
    "Tam Yağlı Süt 1L": "Süt Ürünleri",
    "Laktosuz Süt 1L": "Süt Ürünleri",
    "Yoğurt 1kg": "Süt Ürünleri",
    "Beyaz Peynir 500g": "Süt Ürünleri",
    "Yumurta 15li": "Kahvaltılık",
    "Elma 1kg": "Meyve Sebze",
    "Patates 2kg": "Meyve Sebze",
    "Salatalık 1kg": "Meyve Sebze",
    "Domates 1kg": "Meyve Sebze",
    "Portakal Suyu 1L": "İçecek",
    "Çay 500g": "İçecek",
    "Kahve 250g": "İçecek",
    "Pirinç 1kg": "Temel Gıda",
    "Makarna 500g": "Temel Gıda",
    "Zeytinyağı 1L": "Temel Gıda",
    "Ayçiçek Yağı 1L": "Temel Gıda",
    "Toz Şeker 1kg": "Temel Gıda",
    "Un 1kg": "Temel Gıda",
    "Tavuk Göğüs 1kg": "Et Ürünleri",
    "Dana Kıyma 500g": "Et Ürünleri",
}


SPECIAL_BARCODES = {
    "Tam Yağlı Süt 1L": "8690000000012",
    "Elma 1kg": "8690000000609",
}

# Dataset içinde 5 Store ID var ve bu 5 noktanın tamamında satış geçmişi bulunuyor.
# Bu yüzden S001-S005 artık şube olarak tutulur; depolar satış geçmişine karışmaması için ayrıca eklenir.
DATASET_MARKET_OVERRIDES = {
    1: {"name": "KARVENTER Kadıköy", "city": "İstanbul"},
    2: {"name": "KARVENTER Ümraniye", "city": "İstanbul"},
    3: {"name": "KARVENTER Beşiktaş", "city": "İstanbul"},
    4: {"name": "KARVENTER Maltepe", "city": "İstanbul"},
    5: {"name": "KARVENTER Çankaya", "city": "Ankara"},
}

EXTRA_DEPOTS = [
    {"market_id": 6, "name": "KARVENTER İstanbul Ana Depo", "city": "İstanbul"},
    {"market_id": 7, "name": "KARVENTER Ankara Ana Depo", "city": "Ankara"},
]


def read_csv(name: str) -> list[dict]:
    path = DATA_DIR / name
    if not path.exists():
        raise FileNotFoundError(f"Gerçek veri dosyası bulunamadı: {path}")
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def parse_bool(value) -> bool:
    return str(value).strip().lower() in {"1", "true", "evet", "yes"}


def parse_date(value: str):
    return datetime.fromisoformat(str(value).strip()).date()


def shifted_datetime(value: str, shift_days: int, row_id: int = 0) -> datetime:
    original = parse_date(value)
    shifted = original + timedelta(days=shift_days)
    # CSV günlük olduğu için saat bilgisini deterministik dağıtıyoruz.
    return datetime.combine(
        shifted,
        time(hour=9 + (row_id % 13), minute=(row_id * 7) % 60, second=(row_id * 13) % 60)
    )


def reset_public_schema():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))


def create_extra_tables():
    with engine.begin() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS product_aliases (
                alias_id INTEGER PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
                alias VARCHAR(120) NOT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                UNIQUE(product_id, alias)
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_product_aliases_alias ON product_aliases(alias)"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS forecast_training_data (
                forecast_row_id INTEGER PRIMARY KEY,
                date TIMESTAMP NOT NULL,
                product_id INTEGER NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
                location_id INTEGER NOT NULL REFERENCES markets(market_id) ON DELETE CASCADE,
                units_sold FLOAT NOT NULL,
                inventory_level FLOAT NOT NULL,
                units_ordered FLOAT NOT NULL,
                price FLOAT NOT NULL,
                discount FLOAT NOT NULL,
                competitor_price FLOAT NOT NULL,
                promotion BOOLEAN NOT NULL,
                weather_condition VARCHAR(50),
                seasonality VARCHAR(50),
                epidemic BOOLEAN NOT NULL,
                day_of_week INTEGER NOT NULL,
                month INTEGER NOT NULL,
                year INTEGER NOT NULL,
                is_weekend BOOLEAN NOT NULL,
                demand FLOAT NOT NULL
            )
        """))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_forecast_product_location_date ON forecast_training_data(product_id, location_id, date)"))
        conn.execute(text("CREATE INDEX IF NOT EXISTS ix_forecast_date ON forecast_training_data(date)"))


def compute_date_shift(sales_rows: list[dict]) -> int:
    latest = max(parse_date(row["sale_date"]) for row in sales_rows)
    return (TODAY - latest).days


def compute_dynamic_min_stock(sales_rows: list[dict]) -> dict[int, int]:
    totals: dict[int, float] = {}
    counts: dict[int, int] = {}
    for row in sales_rows:
        pid = int(row["product_id"])
        totals[pid] = totals.get(pid, 0.0) + float(row["quantity"])
        counts[pid] = counts.get(pid, 0) + 1
    result = {}
    for pid, total in totals.items():
        avg = total / max(1, counts.get(pid, 1))
        # Günlük satış hızına dayalı minimum stok: dashboardda kritik/fazla stok ayrımı gerçekçi çalışır.
        result[pid] = max(40, int(round(avg * 1.10)))
    return result


def create_markets(db, locations_rows: list[dict]):
    """Dataset mağazalarını şube olarak, depoları ise ayrı kaynak lokasyon olarak oluşturur.

    Önceki sürümde S004/S005 depo yapılmıştı. Ancak satış geçmişi bu iki Store ID için de
    bulunduğundan satış yönetiminde 'Şube #4/#5' ve depoda satış varmış gibi görünen hatalar
    oluşuyordu. Bu fonksiyon 5 veri seti noktasını şube, 2 ek noktayı depo yapar.
    """
    markets = []
    seen_ids = set()

    for row in sorted(locations_rows, key=lambda x: int(x["location_id"])):
        market_id = int(row["location_id"])
        override = DATASET_MARKET_OVERRIDES.get(market_id, {})
        market = models.Market(
            market_id=market_id,
            name=override.get("name") or row["location_name"],
            city=override.get("city") or row["city"],
            is_depot=False,
            is_active=parse_bool(row.get("is_active", True)),
        )
        db.add(market)
        markets.append(market)
        seen_ids.add(market_id)

    for depot in EXTRA_DEPOTS:
        if depot["market_id"] in seen_ids:
            continue
        market = models.Market(
            market_id=depot["market_id"],
            name=depot["name"],
            city=depot["city"],
            is_depot=True,
            is_active=True,
        )
        db.add(market)
        markets.append(market)

    db.commit()
    return markets

def create_products(db, product_rows: list[dict], min_stock_by_product: dict[int, int]):
    products = []
    used_barcodes: set[str] = set()
    for row in sorted(product_rows, key=lambda x: int(x["product_id"])):
        product_id = int(row["product_id"])
        name = row["product_name"]
        barcode = SPECIAL_BARCODES.get(name, str(row.get("barcode") or "").strip())
        if barcode in used_barcodes:
            barcode = f"869000100{product_id:04d}"
        used_barcodes.add(barcode)

        product = models.Product(
            product_id=product_id,
            product_name=name,
            category=MARKET_CATEGORY_MAP.get(name, row.get("category") or "Market"),
            barcode=barcode,
            unit_type=row.get("unit_type") or "adet",
            unit_price=float(row["unit_price"]),
            profit_margin=float(row.get("profit_margin") or 0.22),
            min_stock_level=min_stock_by_product.get(product_id, int(float(row.get("min_stock_level") or 40))),
            shelf_life_days=int(float(row.get("shelf_life_days") or 180)),
            is_perishable=parse_bool(row.get("is_perishable", False)),
            is_active=parse_bool(row.get("is_active", True)),
        )
        db.add(product)
        products.append(product)
    db.commit()
    return products


def create_users(db, markets):
    db.add(models.Kullanici(
        kullanici_adi="admin",
        sifre_hash=sifrele("admin123"),
        rol="admin",
        market_id=None,
        is_active=True,
    ))
    for market in markets:
        if market.is_depot:
            continue
        short_name = (
            market.name.replace("KARVENTER", "")
            .strip()
            .lower()
            .replace("ı", "i")
            .replace("ğ", "g")
            .replace("ü", "u")
            .replace("ş", "s")
            .replace("ö", "o")
            .replace("ç", "c")
            .replace(" ", "")
        )
        db.add(models.Kullanici(
            kullanici_adi=f"personel_{short_name}",
            sifre_hash=sifrele("personel123"),
            rol="staff",
            market_id=market.market_id,
            is_active=True,
        ))
    db.commit()


def create_stocks(db, stock_rows: list[dict], shift_days: int, products_by_id: dict[int, models.Product] | None = None):
    objects = []
    branch_stock_by_product: dict[int, list[int]] = {}
    max_stock_id = 0

    for row in sorted(stock_rows, key=lambda x: int(x["stock_id"])):
        stock_id = int(row["stock_id"])
        product_id = int(row["product_id"])
        market_id = int(row["location_id"])
        quantity = max(0, int(round(float(row["current_quantity"]))))
        max_stock_id = max(max_stock_id, stock_id)
        branch_stock_by_product.setdefault(product_id, []).append(quantity)
        objects.append(models.Stock(
            stock_id=stock_id,
            product_id=product_id,
            market_id=market_id,
            quantity=quantity,
            last_updated=shifted_datetime(row["last_updated"], shift_days, stock_id),
        ))

    # Depolar veri setinde satış noktası olarak yoktur; bu yüzden depo stokları şube stoklarından
    # türetilmiş operasyonel kaynak stoklarıdır. Satış geçmişine yazılmazlar.
    if products_by_id:
        for depot in EXTRA_DEPOTS:
            depot_id = depot["market_id"]
            for product_id, product in sorted(products_by_id.items()):
                quantities = branch_stock_by_product.get(product_id, [product.min_stock_level * 4])
                avg_qty = sum(quantities) / max(1, len(quantities))
                city_factor = 1.65 if depot["city"] == "İstanbul" else 1.35
                depot_qty = max(product.min_stock_level * 4, int(round(avg_qty * city_factor)))
                max_stock_id += 1
                objects.append(models.Stock(
                    stock_id=max_stock_id,
                    product_id=product_id,
                    market_id=depot_id,
                    quantity=depot_qty,
                    last_updated=datetime.utcnow(),
                ))

    db.bulk_save_objects(objects)
    db.commit()
    return len(objects)

def create_stock_batches(db, batch_rows: list[dict], products_by_id: dict[int, models.Product], shift_days: int):
    objects = []
    max_batch_id = 0

    for row in sorted(batch_rows, key=lambda x: int(x["batch_id"])):
        batch_id = int(row["batch_id"])
        max_batch_id = max(max_batch_id, batch_id)
        product_id = int(row["product_id"])
        product = products_by_id.get(product_id)
        quantity = max(1, int(round(float(row["quantity"]))))
        received_date = shifted_datetime(row["production_date"], shift_days, batch_id)
        expiry_date = shifted_datetime(row["expiry_date"], shift_days, batch_id)
        days_left = (expiry_date.date() - TODAY).days
        if days_left < 0:
            status = "expired"
        elif days_left <= 14:
            status = "near_expiry"
        else:
            status = "active"
        unit_cost = round((product.unit_price if product else 50.0) * random.uniform(0.70, 0.88), 2)
        objects.append(models.StockBatch(
            batch_id=batch_id,
            product_id=product_id,
            market_id=int(row["location_id"]),
            lot_code=row.get("batch_code") or f"B{batch_id:06d}",
            initial_quantity=quantity,
            remaining_quantity=quantity,
            received_date=received_date,
            expiry_date=expiry_date,
            unit_cost=unit_cost,
            status=status,
        ))

    # Depolara da parti kaydı oluşturulur; böylece SKT/fire ve transfer kaynakları daha tutarlı çalışır.
    for depot in EXTRA_DEPOTS:
        for product_id, product in sorted(products_by_id.items()):
            if not product.is_perishable:
                continue
            max_batch_id += 1
            shelf_life = max(3, int(product.shelf_life_days or 30))
            qty = max(product.min_stock_level * 2, int(product.min_stock_level * random.uniform(2.2, 4.0)))
            near_expiry = random.random() < 0.35
            offset = max(1, int(shelf_life * (0.25 if near_expiry else 0.75)))
            expiry_date = datetime.combine(TODAY + timedelta(days=offset), time(hour=10, minute=0))
            received_date = expiry_date - timedelta(days=max(1, shelf_life - offset))
            status = "near_expiry" if offset <= 14 else "active"
            objects.append(models.StockBatch(
                batch_id=max_batch_id,
                product_id=product_id,
                market_id=depot["market_id"],
                lot_code=f"D{max_batch_id:06d}",
                initial_quantity=qty,
                remaining_quantity=qty,
                received_date=received_date,
                expiry_date=expiry_date,
                unit_cost=round(product.unit_price * random.uniform(0.70, 0.88), 2),
                status=status,
            ))

    db.bulk_save_objects(objects)
    db.commit()
    return len(objects)

def create_sales(db, sales_rows: list[dict], shift_days: int):
    batch = []
    total = 0
    for row in sorted(sales_rows, key=lambda x: int(x["sale_id"])):
        sale_id = int(row["sale_id"])
        batch.append(models.Sale(
            sale_id=sale_id,
            product_id=int(row["product_id"]),
            market_id=int(row["location_id"]),
            quantity=max(1, int(round(float(row["quantity"])))),
            sale_date=shifted_datetime(row["sale_date"], shift_days, sale_id),
        ))
        total += 1
        if len(batch) >= 5000:
            db.bulk_save_objects(batch)
            db.commit()
            batch.clear()
    if batch:
        db.bulk_save_objects(batch)
        db.commit()
    return total


def insert_product_aliases(alias_rows: list[dict]):
    payload = [
        {
            "alias_id": int(row["alias_id"]),
            "product_id": int(row["product_id"]),
            "alias": row["alias"].strip().lower(),
            "is_active": parse_bool(row.get("is_active", True)),
        }
        for row in alias_rows
    ]
    if not payload:
        return 0
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO product_aliases(alias_id, product_id, alias, is_active)
            VALUES (:alias_id, :product_id, :alias, :is_active)
        """), payload)
    return len(payload)


def insert_forecast_training(rows: list[dict], shift_days: int):
    total = 0
    batch = []
    for row in sorted(rows, key=lambda x: int(x["forecast_row_id"])):
        rid = int(row["forecast_row_id"])
        shifted = shifted_datetime(row["date"], shift_days, rid)
        batch.append({
            "forecast_row_id": rid,
            "date": shifted,
            "product_id": int(row["product_id"]),
            "location_id": int(row["location_id"]),
            "units_sold": float(row["units_sold"]),
            "inventory_level": float(row["inventory_level"]),
            "units_ordered": float(row["units_ordered"]),
            "price": float(row["price"]),
            "discount": float(row["discount"]),
            "competitor_price": float(row["competitor_price"]),
            "promotion": parse_bool(row["promotion"]),
            "weather_condition": row["weather_condition"],
            "seasonality": row["seasonality"],
            "epidemic": parse_bool(row["epidemic"]),
            "day_of_week": shifted.weekday(),
            "month": shifted.month,
            "year": shifted.year,
            "is_weekend": shifted.weekday() in {5, 6},
            "demand": float(row["demand"]),
        })
        total += 1
        if len(batch) >= 5000:
            _insert_forecast_batch(batch)
            batch.clear()
    if batch:
        _insert_forecast_batch(batch)
    return total


def _insert_forecast_batch(batch: list[dict]):
    with engine.begin() as conn:
        conn.execute(text("""
            INSERT INTO forecast_training_data(
                forecast_row_id, date, product_id, location_id, units_sold, inventory_level,
                units_ordered, price, discount, competitor_price, promotion, weather_condition,
                seasonality, epidemic, day_of_week, month, year, is_weekend, demand
            ) VALUES (
                :forecast_row_id, :date, :product_id, :location_id, :units_sold, :inventory_level,
                :units_ordered, :price, :discount, :competitor_price, :promotion, :weather_condition,
                :seasonality, :epidemic, :day_of_week, :month, :year, :is_weekend, :demand
            )
        """), batch)


def clear_seeded_operation_tables(db):
    """Başlangıç seed aşamasında mock operasyon geçmişi oluşturulmaz.

    Veri setinde gerçek transfer, bildirim, onay ve görev geçmişi bulunmadığı için bu
    tablolar boş bırakılır. Canlı kullanımda transfer/onay/bildirim kayıtları web,
    mobil veya KARVAI aksiyonlarıyla gerçek zamanlı oluşur.
    """
    db.query(models.Transfer).delete(synchronize_session=False)
    db.query(models.Alert).delete(synchronize_session=False)
    if hasattr(models, "AssistantAction"):
        db.query(models.AssistantAction).delete(synchronize_session=False)
    if hasattr(models, "OperationEvent"):
        db.query(models.OperationEvent).delete(synchronize_session=False)
    db.commit()
    return {"transfers": 0, "alerts": 0, "assistant_actions": 0}


def create_import_batch_record(db, total_sales: int):
    db.add(models.SalesImportBatch(
        file_name="KARVENTER Satış-Stok Veri Seti",
        source="karventer_sales_stock_dataset",
        total_rows=total_sales,
        imported_rows=total_sales,
        rejected_rows=0,
        status="completed",
        error_summary="5 şube + 2 ana depo yapısına normalize edilmiş satış, stok ve talep veri seti.",
    ))
    db.commit()


def print_summary(db, counts: dict):
    print("\nKARVENTER gerçek veri seti içe aktarıldı.")
    print("--------------------------------------")
    print(f"Şube sayısı              : {db.query(models.Market).filter(models.Market.is_depot == False).count()}")
    print(f"Depo sayısı              : {db.query(models.Market).filter(models.Market.is_depot == True).count()}")
    print(f"Ürün sayısı              : {db.query(models.Product).count()}")
    print(f"Güncel stok kaydı        : {db.query(models.Stock).count()}")
    print(f"Stok parti/SKT kaydı     : {db.query(models.StockBatch).count()}")
    print(f"Satış geçmişi kaydı      : {db.query(models.Sale).count()}")
    print(f"Forecast eğitim satırı   : {counts.get('forecast', 0)}")
    print(f"Ürün alias satırı        : {counts.get('aliases', 0)}")
    print(f"Transfer görev kaydı     : {db.query(models.Transfer).count()} (canlı aksiyonlarla oluşur)")
    print(f"Uyarı/Bildirim kaydı     : {db.query(models.Alert).count()} (canlı aksiyonlarla oluşur)")
    print("--------------------------------------")
    print("Admin: admin / admin123")
    print("Personel örnekleri: personel_kadikoy / personel123, personel_maltepe / personel123, personel_cankaya / personel123")
    print("Test barkodları: Tam Yağlı Süt 1L = 8690000000012, Elma 1kg = 8690000000609")
    print("--------------------------------------\n")


def run_seed_real_data():
    random.seed(RANDOM_SEED)

    locations_rows = read_csv("locations.csv")
    products_rows = read_csv("products.csv")
    stocks_rows = read_csv("stocks.csv")
    batches_rows = read_csv("stock_batches.csv")
    sales_rows = read_csv("sales.csv")
    forecast_rows = read_csv("forecast_training_data.csv")
    alias_rows = read_csv("product_aliases.csv")

    shift_days = compute_date_shift(sales_rows)
    min_stock_by_product = compute_dynamic_min_stock(sales_rows)

    reset_public_schema()
    Base.metadata.create_all(bind=engine)
    create_extra_tables()

    db = SessionLocal()
    try:
        print("Lokasyonlar içe aktarılıyor...")
        markets = create_markets(db, locations_rows)

        print("Ürünler, barkodlar ve minimum stok seviyeleri içe aktarılıyor...")
        products = create_products(db, products_rows, min_stock_by_product)
        products_by_id = {product.product_id: product for product in products}

        print("Kullanıcılar oluşturuluyor...")
        create_users(db, markets)

        print("Güncel stoklar içe aktarılıyor...")
        stock_count = create_stocks(db, stocks_rows, shift_days, products_by_id)

        print("SKT/parti kayıtları içe aktarılıyor...")
        batch_count = create_stock_batches(db, batches_rows, products_by_id, shift_days)

        print("76.000 satırlık satış geçmişi içe aktarılıyor...")
        sale_count = create_sales(db, sales_rows, shift_days)

        print("Ürün alias kayıtları içe aktarılıyor...")
        alias_count = insert_product_aliases(alias_rows)

        print("Forecast eğitim tablosu içe aktarılıyor...")
        forecast_count = insert_forecast_training(forecast_rows, shift_days)

        print("Mock transfer, bildirim, onay ve geçmiş işlem tabloları temizleniyor...")
        operation_counts = clear_seeded_operation_tables(db)

        create_import_batch_record(db, sale_count)

        print_summary(db, {
            "stocks": stock_count,
            "batches": batch_count,
            "sales": sale_count,
            "aliases": alias_count,
            "forecast": forecast_count,
            "transfers": operation_counts.get("transfers", 0),
            "alerts": operation_counts.get("alerts", 0),
        })
    finally:
        db.close()


if __name__ == "__main__":
    run_seed_real_data()
