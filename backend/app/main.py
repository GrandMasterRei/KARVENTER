from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas, ai_module
from .database import get_db

app = FastAPI(title="KARVENTER API", version="1.0.0")

# Dışarıdan gelecek Frontend isteklerine izin ver (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Gerçek projede buraya Frontend'in IP'si yazılır
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "KARVENTER Backend API Sorunsuz Çalışıyor!"}
# --- ÜRÜN (PRODUCT) ENDPOINT'LERİ ---

@app.post("/api/products", response_model=schemas.ProductResponse, tags=["Products"])
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    """Sisteme yeni bir ürün ekler (Create)"""
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.get("/api/products", response_model=list[schemas.ProductResponse], tags=["Products"])
def get_products(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Sistemdeki tüm ürünleri listeler (Read)"""
    products = db.query(models.Product).offset(skip).limit(limit).all()
    return products

# --- STOK (STOCK) ENDPOINT'LERİ ---

@app.post("/api/stocks", response_model=schemas.StockResponse, tags=["Stocks"])
def create_stock(stock: schemas.StockCreate, db: Session = Depends(get_db)):
    """Sisteme yeni bir stok kaydı ekler"""
    db_stock = models.Stock(**stock.model_dump())
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

@app.get("/api/stocks", response_model=list[schemas.StockResponse], tags=["Stocks"])
def get_stocks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Sistemdeki tüm stok durumlarını listeler"""
    stocks = db.query(models.Stock).offset(skip).limit(limit).all()
    return stocks

# --- TRANSFER ENDPOINT'LERİ ---

@app.post("/api/transfers", response_model=schemas.TransferResponse, tags=["Transfers"])
def create_transfer(transfer: schemas.TransferCreate, db: Session = Depends(get_db)):
    """Yeni bir stok transfer emri oluşturur"""
    db_transfer = models.Transfer(**transfer.model_dump())
    db.add(db_transfer)
    db.commit()
    db.refresh(db_transfer)
    return db_transfer
# --- SATIŞ (SALE) ENDPOINT'LERİ ---

@app.post("/api/sales", response_model=schemas.SaleResponse, tags=["Sales"])
def create_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db)):
    """Sisteme yeni bir satış kaydı ekler"""
    db_sale = models.Sale(**sale.model_dump())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.get("/api/sales", response_model=list[schemas.SaleResponse], tags=["Sales"])
def get_sales(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Sistemdeki tüm satış geçmişini listeler"""
    sales = db.query(models.Sale).offset(skip).limit(limit).all()
    return sales
from . import ai_module # En üstteki importlara ekle veya burada bırak

@app.get("/api/forecast/{product_id}/{market_id}", tags=["AI Forecast"])
def get_sales_forecast(product_id: int, market_id: int, db: Session = Depends(get_db)):
    """Seçilen ürün ve market için gelecek haftalık satış tahminini üretir"""
    prediction = ai_module.predict_next_week_sales(product_id, market_id, db)
    
    return {
        "product_id": product_id,
        "market_id": market_id,
        "forecasted_sales_next_week": prediction,
        "status": "success"
    }
@app.get("/api/optimize/{product_id}/{market_id}", tags=["AI Optimization"])
def get_optimization(product_id: int, market_id: int, db: Session = Depends(get_db)):
    """AI tahmini ve stok durumuna göre transfer önerisi sunar"""
    return ai_module.get_optimization_suggestion(product_id, market_id, db)
@app.get("/api/reports/z-report", tags=["Reports & Analytics"])
def get_ai_z_report(db: Session = Depends(get_db)):
    """Sistem genelindeki tüm marketleri tarayarak AI destekli finansal Z-Raporu sunar."""
    return ai_module.generate_system_wide_z_report(db)
@app.get("/api/stocks", tags=["Inventory Management"])
def get_all_stocks(db: Session = Depends(get_db)):
    """Tüm marketlerdeki stok durumlarını, ürün ve şube detaylarıyla birlikte getirir."""
    stocks = db.query(models.Stock).all()
    result = []
    
    for stock in stocks:
        product = db.query(models.Product).filter(models.Product.product_id == stock.product_id).first()
        market = db.query(models.Market).filter(models.Market.market_id == stock.market_id).first()
        
        if product and market:
            # Yapay zeka öncesi basit durum analizi (Kritik, Fazla, Normal)
            if stock.quantity <= product.min_stock_level:
                status = "Kritik"
            elif stock.quantity > product.min_stock_level * 3:
                status = "Fazla Stok"
            else:
                status = "Normal"
                
            result.append({
                "stock_id": stock.stock_id,
                "product_name": product.product_name,
                "category": product.category,
                "market_name": market.name,
                "city": market.city,
                "quantity": stock.quantity,
                "min_stock_level": product.min_stock_level,
                "status": status
            })
            
    return {"success": True, "data": result}
@app.get("/api/forecast", tags=["AI & Analytics"])
def get_ai_forecasts(db: Session = Depends(get_db)):
    """AI modülünden gelen talep tahmin sonuçlarını listeler."""
    # Gerçek senaryoda burada ai_module.predict() çağrılır[cite: 317].
    # Raporundaki 2.13.3 tasarımı için örnek veriler dönüyoruz[cite: 356].
    forecasts = [
        {"product_name": "Süt 1L", "market_name": "Kadıköy Merkez", "predicted_sales": 145, "confidence_score": "%94"},
        {"product_name": "Ekmek 250g", "market_name": "Beşiktaş Şube", "predicted_sales": 850, "confidence_score": "%98"},
        {"product_name": "Yumurta 30lu", "market_name": "Batı Mini", "predicted_sales": 62, "confidence_score": "%89"},
    ]
    return {"success": True, "data": forecasts}