import pandas as pd
from sqlalchemy.orm import Session
from sklearn.linear_model import LinearRegression
import numpy as np
from . import models

def predict_next_week_sales(product_id: int, market_id: int, db: Session):
    # 1. Veritabanından bu ürün ve market için satış verilerini çek
    sales = db.query(models.Sale).filter(
        models.Sale.product_id == product_id,
        models.Sale.market_id == market_id
    ).order_by(models.Sale.sale_date).all()

    if len(sales) < 10:  # Yeterli veri yoksa tahmin yapma
        return 0

    # 2. Verileri Pandas DataFrame'e çevir
    df = pd.DataFrame([{"date": s.sale_date, "amount": s.amount} for s in sales])
    
    # Günlük veriyi haftalık trende sokmak için index oluştur (0, 1, 2... gün)
    df['day_index'] = np.arange(len(df))
    
    # 3. Basit Lineer Regresyon Modeli
    X = df[['day_index']] # Girdi: Günler
    y = df['amount']      # Çıktı: Satış miktarı
    
    model = LinearRegression()
    model.fit(X, y)
    
    # 4. Gelecek haftanın (son günden sonraki 7 günün) tahminini yap
    next_days = np.array([[len(df) + i] for i in range(1, 8)])
    predictions = model.predict(next_days)
    
    # Toplam tahmini döndür (Negatif değer çıkarsa 0 yap)
    total_prediction = sum([max(0, p) for p in predictions])
    return int(total_prediction)
def get_optimization_suggestion(product_id: int, target_market_id: int, db: Session):
    # 1. Hedef market için AI tahmini al
    forecast = predict_next_week_sales(product_id, target_market_id, db)
    
    # 2. Hedef marketin mevcut stokuna bak
    current_stock = db.query(models.Stock).filter(
        models.Stock.product_id == product_id,
        models.Stock.market_id == target_market_id
    ).first()
    
    stock_qty = current_stock.quantity if current_stock else 0
    
    # 3. Eğer stok tahminden azsa optimizasyon çalışsın
    if stock_qty < forecast:
        needed = forecast - stock_qty
        # En çok stoku olan başka bir market bul
        source_stock = db.query(models.Stock).filter(
            models.Stock.product_id == product_id,
            models.Stock.market_id != target_market_id
        ).order_by(models.Stock.quantity.desc()).first()
        
        if source_stock and source_stock.quantity > needed:
            return {
                "decision": "TRANSFER_RECOMMENDED",
                "source_market_id": source_stock.market_id,
                "target_market_id": target_market_id,
                "recommended_quantity": needed,
                "reason": f"Gelecek hafta tahmini satış ({forecast}), mevcut stoktan ({stock_qty}) fazla."
            }
    
    return {"decision": "KEEP_LEVEL", "reason": "Stok seviyesi tahmini karşılamak için yeterli."}
def generate_system_wide_z_report(db: Session):
    """
    Tüm sistemi tarayarak AI müdahalesi olmayan (Organik) durum ile
    AI müdahalesi olan (Optimize) durumu finansal olarak karşılaştırır.
    """
    products = db.query(models.Product).all()
    markets = db.query(models.Market).all()

    report = {
        "financials": {
            "total_organic_profit": 0.0,
            "total_optimized_profit": 0.0,
            "net_ai_gain": 0.0,
            "currency": "TL"
        },
        "ai_transfer_recommendations": []
    }

    for product in products:
        shortages = [] # Yok satacak (Kâr kaybedecek) şubeler
        surpluses = [] # Ürünün rafta yattığı (Atıl stok) şubeler

        # Ürün başına net kâr hesabı (Örn: 100 TL %10 marj = 10 TL kâr)
        profit_per_unit = product.unit_price * (product.profit_margin / 100)

        for market in markets:
            # AI'dan gelecek haftanın tahminini al
            forecast = predict_next_week_sales(product.product_id, market.market_id, db)
            
            # Mevcut stoku kontrol et
            stock_record = db.query(models.Stock).filter(
                models.Stock.product_id == product.product_id,
                models.Stock.market_id == market.market_id
            ).first()
            stock = stock_record.quantity if stock_record else 0

            # 1. ORGANİK DURUM: AI olmazsa sadece elindeki stok kadar satabilirsin.
            organic_sales = min(stock, forecast)
            report["financials"]["total_organic_profit"] += organic_sales * profit_per_unit

            # 2. KRİZ TESPİTİ
            if forecast > stock:
                # Stok yetmiyor, müşteri dönecek!
                shortages.append({
                    "market_id": market.market_id,
                    "market_name": market.name,
                    "needed": forecast - stock,
                    "lost_profit_potential": (forecast - stock) * profit_per_unit
                })
            elif stock > forecast + 5: 
                # Stok tahminden fazla (5 adet de güvenlik tamponu bırakıyoruz)
                surpluses.append({
                    "market_id": market.market_id,
                    "market_name": market.name,
                    "available_to_transfer": stock - forecast - 5
                })

        # 3. AI ÇÖZÜMÜ: Fazla stokları, yok satan yerlere kaydır (Greedy Algorithm)
        # Kâr kaybı en yüksek olan şubeye öncelik ver
        shortages.sort(key=lambda x: x["lost_profit_potential"], reverse=True)

        for shortage in shortages:
            for surplus in surpluses:
                if surplus["available_to_transfer"] > 0 and shortage["needed"] > 0:
                    transfer_qty = min(surplus["available_to_transfer"], shortage["needed"])

                    surplus["available_to_transfer"] -= transfer_qty
                    shortage["needed"] -= transfer_qty

                    # Transfer sayesinde kurtarılan kâr
                    gained_profit = transfer_qty * profit_per_unit
                    report["financials"]["total_optimized_profit"] += gained_profit
                    report["financials"]["net_ai_gain"] += gained_profit

                    report["ai_transfer_recommendations"].append({
                        "product_name": product.product_name,
                        "from_market": surplus["market_name"],
                        "to_market": shortage["market_name"],
                        "transfer_quantity": transfer_qty,
                        "expected_profit_gain": gained_profit
                    })

    # Toplam optimize kâr = Organik Kâr + Kurtarılan Kâr
    report["financials"]["total_optimized_profit"] += report["financials"]["total_organic_profit"]

    return report