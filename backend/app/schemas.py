from pydantic import BaseModel
from datetime import datetime

# --- Ürün (Product) Şemaları ---
class ProductBase(BaseModel):
    product_name: str
    category: str
    unit_price: float
    profit_margin: float
    min_stock_level: int = 10

class ProductCreate(ProductBase):
    pass

class ProductResponse(ProductBase):
    product_id: int

    class Config:
        from_attributes = True

# --- Stok (Stock) Şemaları ---
class StockBase(BaseModel):
    product_id: int
    market_id: int
    quantity: int

class StockCreate(StockBase):
    pass

class StockResponse(StockBase):
    stock_id: int
    last_updated: datetime | None = None

    class Config:
        from_attributes = True

# --- Transfer Şemaları ---
class TransferBase(BaseModel):
    product_id: int
    source_market_id: int
    target_market_id: int
    quantity: int

class TransferCreate(TransferBase):
    pass

class TransferResponse(TransferBase):
    transfer_id: int
    status: str
    created_at: datetime | None = None

    class Config:
        from_attributes = True
# --- Satış (Sale) Şemaları ---
class SaleBase(BaseModel):
    product_id: int
    market_id: int
    amount: int
    sale_date: datetime

class SaleCreate(SaleBase):
    pass

class SaleResponse(SaleBase):
    sale_id: int

    class Config:
        from_attributes = True