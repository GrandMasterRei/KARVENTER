from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas
from .database import get_db, engine
from app.ai_engine import talep_tahmini_uret, stok_onerisi_uret

models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="KARVENTER API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/", tags=["Health"])
def read_root():
    return {"message": "KARVENTER Backend API Sorunsuz Çalışıyor!"}

@app.post("/api/products", response_model=schemas.ProductResponse, status_code=201, tags=["Products"])
def create_product(product: schemas.ProductCreate, db: Session = Depends(get_db)):
    db_product = models.Product(**product.model_dump())
    db.add(db_product)
    db.commit()
    db.refresh(db_product)
    return db_product

@app.get("/api/products", tags=["Products"])
def get_products(db: Session = Depends(get_db)):
    return db.query(models.Product).all()

@app.post("/api/markets", status_code=201, tags=["Markets"])
def create_market(name: str, city: str, db: Session = Depends(get_db)):
    db_market = models.Market(name=name, city=city)
    db.add(db_market)
    db.commit()
    db.refresh(db_market)
    return db_market

@app.post("/api/stocks", response_model=schemas.StockResponse, status_code=201, tags=["Inventory Management"])
def create_stock(stock: schemas.StockCreate, db: Session = Depends(get_db)):
    product = db.query(models.Product).filter(models.Product.product_id == stock.product_id).first()
    market = db.query(models.Market).filter(models.Market.market_id == stock.market_id).first()

    if not product or not market:
        raise HTTPException(status_code=404, detail="Ürün veya şube bulunamadı")

    db_stock = models.Stock(**stock.model_dump())
    db.add(db_stock)
    db.commit()
    db.refresh(db_stock)
    return db_stock

@app.get("/api/stocks", tags=["Inventory Management"])
def get_all_stocks(db: Session = Depends(get_db)):
    stocks = db.query(models.Stock).all()
    result = []
    
    for stock in stocks:
        product = db.query(models.Product).filter(models.Product.product_id == stock.product_id).first()
        market = db.query(models.Market).filter(models.Market.market_id == stock.market_id).first()
        
        if product and market:
            min_level = getattr(product, 'min_stock_level', 10)
            product_name = getattr(product, 'product_name', getattr(product, 'name', 'Bilinmeyen Ürün'))
            
            if stock.quantity <= min_level:
                status = "Kritik"
            elif stock.quantity > min_level * 3:
                status = "Fazla Stok"
            else:
                status = "Normal"
                
            result.append({
                "stock_id": stock.stock_id,
                "product_name": product_name,
                "category": getattr(product, 'category', '-'),
                "market_name": getattr(market, 'name', '-'),
                "city": getattr(market, 'city', '-'),
                "quantity": stock.quantity,
                "min_stock_level": min_level,
                "status": status
            })
            
    return {"success": True, "data": result}

@app.get("/api/reports/z-report", tags=["Reports & Analytics"])
def get_z_report(db: Session = Depends(get_db)):
    try:
        stocks = db.query(models.Stock).all()
        base_profit = 0.0
        
        for stock in stocks:
            product = db.query(models.Product).filter(models.Product.product_id == stock.product_id).first()
            if product:
                unit_price = getattr(product, 'unit_price', 0.0)
                profit_margin = getattr(product, 'profit_margin', 0.0)
                base_profit += (stock.quantity * unit_price * profit_margin)
                
        return {
            "success": True,
            "financials": {
                "organik_kar": round(base_profit, 2),
                "optimize_kar": round(base_profit + (base_profit * 0.15), 2),
                "net_ai_kazanci": round(base_profit * 0.15, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/tahmin/{urun_id}/{sube_id}")
def ai_talep_tahmini(urun_id: int, sube_id: int, db: Session = Depends(get_db)):
    """Belirtilen ürün ve şube için 7 günlük AI talep tahmini döndürür."""
    from app.models import Sale, Product

    # Ürünü getir
    urun = db.query(Product).filter(Product.product_id == urun_id).first()
    if not urun:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    # Son 14 günlük satış geçmişini getir
    satislar = db.query(Sale).filter(
        Sale.product_id == urun_id,
        Sale.market_id == sube_id
    ).order_by(Sale.sale_date.desc()).limit(14).all()

    satis_gecmisi = [
        {"tarih": str(s.sale_date)[:10], "adet": s.quantity}
        for s in satislar
    ]

    return talep_tahmini_uret(urun.product_name, urun.category, satis_gecmisi)


@app.get("/api/ai/stok-onerileri")
def ai_stok_onerileri(db: Session = Depends(get_db)):
    """Kritik stok seviyesindeki ürünler için AI yenileme önerisi döndürür."""
    from app.models import Stock, Product

    # Minimum seviyenin altındaki stokları bul
    stoklar = db.query(Stock, Product).join(Product, Stock.product_id == Product.product_id).all()
    kritik_stoklar = [
        {
            "urun": product.product_name,
            "mevcut_stok": stock.quantity,
            "minimum_seviye": product.min_stock_level,
            "sube_id": stock.market_id
        }
        for stock, product in stoklar if stock.quantity < product.min_stock_level
    ]

    return stok_onerisi_uret(kritik_stoklar)
