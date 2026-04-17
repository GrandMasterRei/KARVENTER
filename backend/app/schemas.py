from pydantic import BaseModel, ConfigDict
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

class MarketBase(BaseModel):
    name: str
    city: str

class MarketCreate(MarketBase):
    pass

class MarketResponse(MarketBase):
    market_id: int
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