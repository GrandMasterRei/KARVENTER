from .auth import sifrele, token_olustur, mevcut_kullanici, admin_gerektir
from fastapi.security import OAuth2PasswordRequestForm
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from . import models, schemas
from .database import get_db, engine
from .ai_engine import talep_tahmini_uret, stok_onerisi_uret

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

@app.post("/api/sales", status_code=201, tags=["Sales"])
def create_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db)):
    """Satış kaydı oluşturur."""
    db_sale = models.Sale(**sale.model_dump())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.get("/api/sales", tags=["Sales"])
def get_sales(db: Session = Depends(get_db)):
    """Tüm satış kayıtlarını listeler."""
    return db.query(models.Sale).all()

@app.get("/api/ai/tahmin/{urun_id}/{sube_id}", tags=["AI"])
def ai_talep_tahmini(urun_id: int, sube_id: int, db: Session = Depends(get_db)):
    """Belirtilen ürün ve şube için 7 günlük AI talep tahmini döndürür."""
    urun = db.query(models.Product).filter(models.Product.product_id == urun_id).first()
    if not urun:
        raise HTTPException(status_code=404, detail="Ürün bulunamadı")

    satislar = db.query(models.Sale).filter(
        models.Sale.product_id == urun_id,
        models.Sale.market_id == sube_id
    ).order_by(models.Sale.sale_date.desc()).limit(14).all()

    satis_gecmisi = [
        {"tarih": str(s.sale_date)[:10], "adet": s.quantity}
        for s in satislar
    ]

    return talep_tahmini_uret(urun.product_name, urun.category, satis_gecmisi)

@app.get("/api/ai/stok-onerileri", tags=["AI"])
def ai_stok_onerileri(db: Session = Depends(get_db)):
    """Kritik stok seviyesindeki ürünler için AI yenileme önerisi döndürür."""
    stoklar = db.query(models.Stock).join(models.Product).all()
    kritik_stoklar = [
        {
            "urun": s.product.product_name,
            "mevcut_stok": s.quantity,
            "minimum_seviye": s.product.min_stock_level,
            "sube_id": s.market_id
        }
        for s in stoklar if s.quantity < s.product.min_stock_level
    ]
    return stok_onerisi_uret(kritik_stoklar)

@app.post("/api/auth/kayit", status_code=201, tags=["Auth"])
def kayit(kullanici_adi: str, sifre: str, rol: str = "staff", db: Session = Depends(get_db)):
    """Yeni kullanıcı kaydı oluşturur."""
    mevcut = db.query(models.Kullanici).filter(
        models.Kullanici.kullanici_adi == kullanici_adi
    ).first()
    if mevcut:
        raise HTTPException(status_code=400, detail="Kullanıcı adı zaten var")
    yeni = models.Kullanici(
        kullanici_adi=kullanici_adi,
        sifre_hash=sifrele(sifre),
        rol=rol
    )
    db.add(yeni)
    db.commit()
    return {"mesaj": "Kullanıcı oluşturuldu"}

@app.post("/api/auth/giris", tags=["Auth"])
def giris(form: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    """Kullanıcı girişi, JWT token döndürür."""
    kullanici = db.query(models.Kullanici).filter(
        models.Kullanici.kullanici_adi == form.username
    ).first()
    from .auth import sifre_dogrula
    if not kullanici or not sifre_dogrula(form.password, kullanici.sifre_hash):
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre yanlış")
    token = token_olustur({"sub": kullanici.kullanici_adi, "rol": kullanici.rol})
    return {"access_token": token, "token_type": "bearer"}

@app.get("/api/transfers/suggestions", tags=["Transfers"])
def transfer_onerileri(db: Session = Depends(get_db)):
    """Stok dengesizliklerini analiz ederek şubeler arası transfer önerisi üretir."""
    stoklar = db.query(models.Stock).join(models.Product).join(models.Market).all()
    
    # Ürün bazında şube stoklarını grupla
    urun_sube_map = {}
    for stok in stoklar:
        urun_id = stok.product_id
        if urun_id not in urun_sube_map:
            urun_sube_map[urun_id] = []
        urun_sube_map[urun_id].append({
            "sube_id": stok.market_id,
            "sube_adi": stok.market.name,
            "urun_adi": stok.product.product_name,
            "miktar": stok.quantity,
            "minimum": stok.product.min_stock_level
        })
    
    oneriler = []
    for urun_id, subeler in urun_sube_map.items():
        kritik = [s for s in subeler if s["miktar"] < s["minimum"]]
        fazla = [s for s in subeler if s["miktar"] > s["minimum"] * 2]
        
        for k in kritik:
            for f in fazla:
                if f["sube_id"] != k["sube_id"]:
                    transfer_miktari = min(
                        f["miktar"] - f["minimum"],
                        k["minimum"] - k["miktar"]
                    )
                    if transfer_miktari > 0:
                        oneriler.append({
                            "urun": k["urun_adi"],
                            "kaynak_sube": f["sube_adi"],
                            "hedef_sube": k["sube_adi"],
                            "oneri_miktar": transfer_miktari,
                            "aciklama": f"{f['sube_adi']} fazla stoktan {k['sube_adi']} kritik stoğa transfer"
                        })
    
    return {"oneriler": oneriler, "toplam": len(oneriler)}