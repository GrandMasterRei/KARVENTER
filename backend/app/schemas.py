from pydantic import BaseModel, ConfigDict
from typing import Optional, List
from datetime import datetime

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
    model_config = ConfigDict(from_attributes=True)

class StockBase(BaseModel):
    product_id: int
    market_id: int
    quantity: int

class StockCreate(StockBase):
    pass

class StockResponse(StockBase):
    stock_id: int
    last_updated: datetime
    model_config = ConfigDict(from_attributes=True)

class TransferBase(BaseModel):
    product_id: int
    source_market_id: int
    target_market_id: int
    quantity: int

class TransferResponse(TransferBase):
    transfer_id: int
    status: str
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class SaleBase(BaseModel):
    product_id: int
    market_id: int
    amount: int

class SaleResponse(SaleBase):
    sale_id: int
    sale_date: datetime
    model_config = ConfigDict(from_attributes=True)