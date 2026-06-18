from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc
from . import models, schemas
from .database import get_db, engine
from .auth import sifrele, token_olustur, mevcut_kullanici, admin_gerektir
from .ai_engine import talep_tahmini_uret, stok_onerisi_uret, transfer_onerisi_uret

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
    return {"message": "KARVENTER Backend API Çalışıyor!"}

@app.post("/api/auth/kayit", status_code=201, tags=["Auth"])
def kayit(kullanici_adi: str, sifre: str, rol: str = "staff", db: Session = Depends(get_db)):
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
    from .auth import sifre_dogrula
    kullanici = db.query(models.Kullanici).filter(
        models.Kullanici.kullanici_adi == form.username
    ).first()
    if not kullanici or not sifre_dogrula(form.password, kullanici.sifre_hash):
        raise HTTPException(status_code=401, detail="Kullanıcı adı veya şifre yanlış")
    token = token_olustur({"sub": kullanici.kullanici_adi, "rol": kullanici.rol})
    return {"access_token": token, "token_type": "bearer"}

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

@app.get("/api/markets", tags=["Markets"])
def get_markets(db: Session = Depends(get_db)):
    return db.query(models.Market).all()

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
            min_level = product.min_stock_level
            if stock.quantity <= min_level:
                status = "Kritik"
            elif stock.quantity > min_level * 3:
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
                "min_stock_level": min_level,
                "status": status
            })
    return {"success": True, "data": result}

@app.post("/api/sales", status_code=201, tags=["Sales"])
def create_sale(sale: schemas.SaleCreate, db: Session = Depends(get_db)):
    db_sale = models.Sale(**sale.model_dump())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.get("/api/sales", tags=["Sales"])
def get_sales(db: Session = Depends(get_db)):
    return db.query(models.Sale).all()

@app.get("/api/reports/z-report", tags=["Reports & Analytics"])
def get_z_report(db: Session = Depends(get_db)):
    try:
        stocks = db.query(models.Stock).all()
        base_profit = 0.0
        for stock in stocks:
            product = db.query(models.Product).filter(
                models.Product.product_id == stock.product_id
            ).first()
            if product:
                base_profit += stock.quantity * product.unit_price * product.profit_margin
        return {
            "success": True,
            "financials": {
                "organik_kar": round(base_profit, 2),
                "optimize_kar": round(base_profit * 1.15, 2),
                "net_ai_kazanci": round(base_profit * 0.15, 2)
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/ai/tahmin/{urun_id}/{sube_id}", tags=["AI"])
def ai_talep_tahmini(urun_id: int, sube_id: int, db: Session = Depends(get_db)):
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
    stoklar = db.query(models.Stock).all()
    kritik_stoklar = []
    for s in stoklar:
        product = db.query(models.Product).filter(
            models.Product.product_id == s.product_id
        ).first()
        if product and s.quantity < product.min_stock_level:
            kritik_stoklar.append({
                "urun": product.product_name,
                "mevcut_stok": s.quantity,
                "minimum_seviye": product.min_stock_level,
                "sube_id": s.market_id
            })
    return stok_onerisi_uret(kritik_stoklar)

@app.get("/api/transfers/suggestions", tags=["Transfers"])
def transfer_onerileri(db: Session = Depends(get_db)):
    """Satış geçmişini ve LLM analizini kullanarak transfer önerisi üretir."""
    stoklar = db.query(models.Stock).all()
    urun_ids = list(set(s.product_id for s in stoklar))
    ai_oneriler = []

    for urun_id in urun_ids:
        urun = db.query(models.Product).filter(
            models.Product.product_id == urun_id
        ).first()
        if not urun:
            continue

        urun_stoklari = [s for s in stoklar if s.product_id == urun_id]
        sube_verileri = []

        for stok in urun_stoklari:
            market = db.query(models.Market).filter(
                models.Market.market_id == stok.market_id
            ).first()
            satislar = db.query(models.Sale).filter(
                models.Sale.product_id == urun_id,
                models.Sale.market_id == stok.market_id
            ).all()
            sube_verileri.append({
                "sube": market.name if market else str(stok.market_id),
                "mevcut_stok": stok.quantity,
                "toplam_satis": sum(s.quantity for s in satislar),
                "satis_kayit_sayisi": len(satislar),
                "birim_fiyat": urun.unit_price,
                "kar_marji": urun.profit_margin
            })

        if len(sube_verileri) > 1:
            ai_sonuc = transfer_onerisi_uret(urun.product_name, sube_verileri)
            if ai_sonuc.get("transfer_et"):
                ai_oneriler.append(ai_sonuc)

    toplam_kar = sum(o.get("kurtarilan_kar_tahmini", 0) for o in ai_oneriler)
    return {
        "ai_oneriler": ai_oneriler,
        "toplam": len(ai_oneriler),
        "toplam_kurtarilan_kar": toplam_kar
    }