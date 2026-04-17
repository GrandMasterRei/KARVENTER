import random
from app.database import SessionLocal
from app import models

def generate_enterprise_data():
    db = SessionLocal()
    
    markets = [
        models.Market(name="Merkez Hipermarket", city="İstanbul"),
        models.Market(name="Kuzey Dağıtım", city="İstanbul"),
        models.Market(name="Güney Ekspres", city="Antalya"),
        models.Market(name="Doğu Depo", city="Ankara"),
        models.Market(name="Batı Mini", city="İzmir")
    ]
    db.add_all(markets)
    db.commit()

    products = [
        models.Product(product_name="Temel Gıda Paketi", category="Gıda", unit_price=100.0, profit_margin=10.0, min_stock_level=50),
        models.Product(product_name="Premium Kahve Çekirdeği", category="İçecek", unit_price=450.0, profit_margin=35.0, min_stock_level=10),
        models.Product(product_name="Elektronik Aksesuar", category="Teknoloji", unit_price=800.0, profit_margin=45.0, min_stock_level=5),
        models.Product(product_name="Temizlik Seti", category="Kimya", unit_price=150.0, profit_margin=15.0, min_stock_level=30),
        models.Product(product_name="Kişisel Bakım Seti", category="Kozmetik", unit_price=300.0, profit_margin=25.0, min_stock_level=20)
    ]
    db.add_all(products)
    db.commit()

    all_products = db.query(models.Product).all()
    all_markets = db.query(models.Market).all()
    
    for product in all_products:
        for market in all_markets:
            stock_qty = random.choice([random.randint(0, 10), random.randint(100, 300)])
            db.add(models.Stock(
                product_id=product.product_id, 
                market_id=market.market_id, 
                quantity=stock_qty
            ))
            
    db.commit()
    db.close()

if __name__ == "__main__":
    generate_enterprise_data()