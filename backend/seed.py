import random
from datetime import datetime, timedelta
from app.database import SessionLocal
from app import models

def generate_enterprise_data():
    db = SessionLocal()
    
    # 1. Çeşitli Ölçeklerde Dağıtım Noktaları (Şubeler)
    markets = [
        models.Market(name="Merkez Hipermarket", city="İstanbul", district="Şişli", scale="Large"),
        models.Market(name="Kuzey Dağıtım", city="İstanbul", district="Sarıyer", scale="Medium"),
        models.Market(name="Güney Ekspres", city="Antalya", district="Muratpaşa", scale="Small"),
        models.Market(name="Doğu Depo", city="Ankara", district="Yenimahalle", scale="Large"),
        models.Market(name="Batı Mini", city="İzmir", district="Bornova", scale="Small")
    ]
    db.add_all(markets)
    db.commit()

    # 2. Farklı Kâr Marjlarına Sahip Ürün Kataloğu
    products = [
        models.Product(product_name="Temel Gıda Paketi", category="Gıda", unit_price=100.0, profit_margin=10.0, min_stock_level=50),
        models.Product(product_name="Premium Kahve Çekirdeği", category="İçecek", unit_price=450.0, profit_margin=35.0, min_stock_level=10),
        models.Product(product_name="Elektronik Aksesuar", category="Teknoloji", unit_price=800.0, profit_margin=45.0, min_stock_level=5),
        models.Product(product_name="Temizlik Seti", category="Kimya", unit_price=150.0, profit_margin=15.0, min_stock_level=30),
        models.Product(product_name="Kişisel Bakım Seti", category="Kozmetik", unit_price=300.0, profit_margin=25.0, min_stock_level=20)
    ]
    db.add_all(products)
    db.commit()

    # 3. Organik Satış ve Stok Dağılımı
    all_products = db.query(models.Product).all()
    all_markets = db.query(models.Market).all()
    
    print("Kurumsal veri seti ve AI eğitim geçmişi oluşturuluyor...")
    
    for product in all_products:
        for market in all_markets:
            # Yapay zekanın tespit etmesi için rastgele "Trend" çarpanı
            # Bazı marketlerde ürün çok popüler (1.5x), bazılarında satmıyor (0.2x)
            trend_multiplier = random.uniform(0.2, 1.5)
            
            # Son 90 günün satış geçmişi
            for i in range(90):
                sale_date = datetime.now() - timedelta(days=i)
                base_sales = random.randint(1, 15)
                amount = int(base_sales * trend_multiplier)
                
                db.add(models.Sale(
                    product_id=product.product_id, 
                    market_id=market.market_id, 
                    amount=amount, 
                    sale_date=sale_date
                ))
            
            # Stokları da dengesiz dağıtalım ki AI transfer önerebilsin
            # Kasıtlı olarak bazı yerlerde stok az, bazılarında çok
            stock_qty = random.choice([random.randint(0, 10), random.randint(100, 300)])
            db.add(models.Stock(
                product_id=product.product_id, 
                market_id=market.market_id, 
                quantity=stock_qty
            ))
            
    db.commit()
    print("Veritabanı organik krizler ve fırsatlarla başarıyla dolduruldu!")
    db.close()

if __name__ == "__main__":
    generate_enterprise_data()