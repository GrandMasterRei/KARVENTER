from datetime import datetime, timedelta
import random
import sys
import os

sys.path.append(os.path.dirname(__file__))

from app.database import SessionLocal
from app.models import Sale


def seed():
    """Veritabanına 30 günlük örnek satış verisi ekler."""
    db = SessionLocal()
    try:
        # 3 ürün, 2 şube, 30 gün
        for urun_id in range(1, 4):
            for sube_id in range(1, 3):
                for gun in range(30):
                    db.add(Sale(
                        product_id=urun_id,
                        market_id=sube_id,
                        quantity=random.randint(10, 60),
                        sale_date=datetime.utcnow() - timedelta(days=gun)
                    ))
        db.commit()
        print("✅ Seed tamamlandı — 180 satış kaydı eklendi.")
    except Exception as hata:
        db.rollback()
        print(f"❌ Hata: {hata}")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
