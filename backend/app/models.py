from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.sql import func
from .database import Base

class Product(Base):
    __tablename__ = "products"
    product_id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    unit_price = Column(Float, nullable=False)
    profit_margin = Column(Float, nullable=False)
    min_stock_level = Column(Integer, default=10)

class Stock(Base):
    __tablename__ = "stocks"
    stock_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)
    quantity = Column(Integer, nullable=False, default=0)
    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())

class Transfer(Base):
    __tablename__ = "transfers"
    transfer_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    source_market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)
    target_market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)
    quantity = Column(Integer, nullable=False)
    status = Column(String(20), default="pending")
    created_at = Column(DateTime, default=func.now())
class Sale(Base):
    __tablename__ = "sales"
    sale_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)
    sale_date = Column(DateTime, default=func.now())
    amount = Column(Integer, nullable=False)
class Market(Base):
    __tablename__ = "markets"
    market_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)   # Örn: Çankaya Şubesi
    city = Column(String(50))                    # Örn: Ankara
    district = Column(String(50))                # Örn: Çankaya
    scale = Column(String(20))                   # Large, Medium, Small