from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    Index
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from .database import Base


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("ix_products_active_category", "is_active", "category"),
        Index("ix_products_name", "product_name"),
        Index("ix_products_barcode", "barcode"),
    )

    product_id = Column(Integer, primary_key=True, index=True)
    product_name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    barcode = Column(String(50), nullable=True)
    unit_type = Column(String(20), default="adet", nullable=False)

    unit_price = Column(Float, nullable=False)
    profit_margin = Column(Float, nullable=False)
    min_stock_level = Column(Integer, default=10)

    shelf_life_days = Column(Integer, default=180)
    is_perishable = Column(Boolean, default=True)

    # Gerçek sistemde ürün silmek geçmiş satış/stok/transfer kayıtlarını bozar.
    # Bu yüzden silme yerine aktif/pasif mantığı kullanılır.
    is_active = Column(Boolean, default=True, nullable=False)

    stocks = relationship("Stock", back_populates="product")
    stock_batches = relationship("StockBatch", back_populates="product")
    sales = relationship("Sale", back_populates="product")
    transfers = relationship("Transfer", back_populates="product")
    alerts = relationship("Alert", back_populates="product")


class Market(Base):
    __tablename__ = "markets"
    __table_args__ = (
        Index("ix_markets_active_city", "is_active", "city"),
        Index("ix_markets_depot_city", "is_depot", "city"),
        Index("ix_markets_name", "name"),
    )

    market_id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    city = Column(String(50), nullable=False)

    # Her il için depo kaydı da Market tablosunda tutulur.
    # is_depot=True olan kayıtlar şube ekranında normal şube gibi gösterilmez;
    # transfer kaynağı olarak kullanılır.
    is_depot = Column(Boolean, default=False, nullable=False)

    # Şube/depo silmek yerine pasife alınır. Böylece geçmiş satış ve transfer kayıtları korunur.
    is_active = Column(Boolean, default=True, nullable=False)

    stocks = relationship("Stock", back_populates="market")
    stock_batches = relationship("StockBatch", back_populates="market")
    sales = relationship("Sale", back_populates="market")
    alerts = relationship("Alert", back_populates="market")
    users = relationship("Kullanici", back_populates="market")

    outgoing_transfers = relationship(
        "Transfer",
        foreign_keys="Transfer.source_market_id",
        back_populates="source_market"
    )

    incoming_transfers = relationship(
        "Transfer",
        foreign_keys="Transfer.target_market_id",
        back_populates="target_market"
    )


class Stock(Base):
    __tablename__ = "stocks"

    __table_args__ = (
        UniqueConstraint("product_id", "market_id", name="uq_stock_product_market"),
        Index("ix_stocks_market_product", "market_id", "product_id"),
        Index("ix_stocks_product_market", "product_id", "market_id"),
    )

    stock_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)

    quantity = Column(Integer, nullable=False, default=0)

    last_updated = Column(DateTime, default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="stocks")
    market = relationship("Market", back_populates="stocks")


class StockBatch(Base):
    __tablename__ = "stock_batches"
    __table_args__ = (
        Index("ix_stock_batches_expiry_status", "expiry_date", "status"),
        Index("ix_stock_batches_market_product", "market_id", "product_id"),
    )

    batch_id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)

    lot_code = Column(String(80), nullable=False, index=True)

    initial_quantity = Column(Integer, nullable=False)
    remaining_quantity = Column(Integer, nullable=False)

    received_date = Column(DateTime, nullable=False)
    expiry_date = Column(DateTime, nullable=True)

    unit_cost = Column(Float, default=0.0)

    # active, near_expiry, expired, returned, transferred, depleted
    status = Column(String(20), default="active")

    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())

    product = relationship("Product", back_populates="stock_batches")
    market = relationship("Market", back_populates="stock_batches")


class Sale(Base):
    __tablename__ = "sales"
    __table_args__ = (
        Index("ix_sales_date_market", "sale_date", "market_id"),
        Index("ix_sales_market_product_date", "market_id", "product_id", "sale_date"),
        Index("ix_sales_product_date", "product_id", "sale_date"),
    )

    sale_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)

    quantity = Column(Integer, nullable=False)
    sale_date = Column(DateTime, default=func.now())

    product = relationship("Product", back_populates="sales")
    market = relationship("Market", back_populates="sales")

class SalesImportBatch(Base):
    __tablename__ = "sales_import_batches"
    __table_args__ = (
        Index("ix_sales_import_batches_created_at", "created_at"),
        Index("ix_sales_import_batches_status", "status"),
    )

    import_id = Column(Integer, primary_key=True, index=True)
    file_name = Column(String(180), nullable=True)
    source = Column(String(60), default="csv")

    total_rows = Column(Integer, default=0)
    imported_rows = Column(Integer, default=0)
    rejected_rows = Column(Integer, default=0)

    status = Column(String(20), default="completed")
    error_summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=func.now())



class Transfer(Base):
    __tablename__ = "transfers"
    __table_args__ = (
        Index("ix_transfers_status_created", "status", "created_at"),
        Index("ix_transfers_source_status", "source_market_id", "status"),
        Index("ix_transfers_target_status", "target_market_id", "status"),
        Index("ix_transfers_product_status", "product_id", "status"),
    )

    transfer_id = Column(Integer, primary_key=True, index=True)

    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    source_market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)
    target_market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)

    quantity = Column(Integer, nullable=False)

    estimated_profit_gain = Column(Float, default=0.0)
    estimated_waste_prevented = Column(Integer, default=0)

    # suggested, approved, rejected, completed, cancelled
    status = Column(String(20), default="suggested")

    ai_explanation = Column(Text)
    rejection_reason = Column(Text)

    requested_by_user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)

    created_at = Column(DateTime, default=func.now())
    approved_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    product = relationship("Product", back_populates="transfers")

    source_market = relationship(
        "Market",
        foreign_keys=[source_market_id],
        back_populates="outgoing_transfers"
    )

    target_market = relationship(
        "Market",
        foreign_keys=[target_market_id],
        back_populates="incoming_transfers"
    )


class Alert(Base):
    __tablename__ = "alerts"
    __table_args__ = (
        Index("ix_alerts_status_created", "status", "created_at"),
        Index("ix_alerts_type_status", "alert_type", "status"),
        Index("ix_alerts_market_status", "market_id", "status"),
        Index("ix_alerts_product_status", "product_id", "status"),
    )

    alert_id = Column(Integer, primary_key=True, index=True)

    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=True)
    created_by_user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)

    # critical_stock, near_expiry, expired, staff_report, transfer_request
    alert_type = Column(String(40), nullable=False)

    # low, medium, high, critical
    severity = Column(String(20), default="medium")

    title = Column(String(150), nullable=False)
    message = Column(Text)

    # open, reviewed, resolved, dismissed
    status = Column(String(20), default="open")

    created_at = Column(DateTime, default=func.now())
    resolved_at = Column(DateTime, nullable=True)

    market = relationship("Market", back_populates="alerts")
    product = relationship("Product", back_populates="alerts")


class AssistantAction(Base):
    __tablename__ = "assistant_actions"
    __table_args__ = (
        Index("ix_assistant_actions_status_group", "status", "group_id"),
        Index("ix_assistant_actions_created_status", "created_at", "status"),
    )

    action_id = Column(Integer, primary_key=True, index=True)
    group_id = Column(String(80), index=True, nullable=True)

    # create_transfer, create_alert, create_stock_batch, update_alert_status
    action_type = Column(String(50), nullable=False)

    title = Column(String(160), nullable=False)
    description = Column(Text)
    payload_json = Column(Text, nullable=False)

    # pending, approved, rejected, executed, failed
    status = Column(String(20), default="pending")

    # low, medium, high
    risk_level = Column(String(20), default="medium")
    confidence = Column(Float, default=0.80)

    created_by_user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)
    approved_by_user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)

    created_at = Column(DateTime, default=func.now())
    approved_at = Column(DateTime, nullable=True)
    executed_at = Column(DateTime, nullable=True)

    result_message = Column(Text)


class AssistantMessage(Base):
    __tablename__ = "assistant_messages"
    __table_args__ = (
        Index("ix_assistant_messages_created_role", "created_at", "role"),
    )

    message_id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    intent = Column(String(50), nullable=True)
    group_id = Column(String(80), nullable=True, index=True)
    llm_used = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, default=func.now())


class OperationEvent(Base):
    __tablename__ = "operation_events"
    __table_args__ = (
        Index("ix_operation_events_type_created", "event_type", "created_at"),
        Index("ix_operation_events_entity", "entity_type", "entity_id"),
    )

    event_id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(60), nullable=False)
    title = Column(String(160), nullable=False)
    description = Column(Text, nullable=True)
    entity_type = Column(String(50), nullable=True)
    entity_id = Column(Integer, nullable=True)
    user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)
    created_at = Column(DateTime, default=func.now())


class StockMovement(Base):
    __tablename__ = "stock_movements"
    __table_args__ = (
        Index("ix_stock_movements_market_created", "market_id", "created_at"),
        Index("ix_stock_movements_product_created", "product_id", "created_at"),
        Index("ix_stock_movements_type_created", "movement_type", "created_at"),
    )

    movement_id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.product_id"), nullable=False)
    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=False)

    # sale_out, transfer_out, transfer_in, stock_entry, manual_adjustment
    movement_type = Column(String(40), nullable=False)

    quantity_change = Column(Integer, nullable=False)
    quantity_before = Column(Integer, nullable=False, default=0)
    quantity_after = Column(Integer, nullable=False, default=0)

    reference_type = Column(String(50), nullable=True)
    reference_id = Column(Integer, nullable=True)
    note = Column(Text, nullable=True)
    user_id = Column(Integer, ForeignKey("kullanicilar.kullanici_id"), nullable=True)

    created_at = Column(DateTime, default=func.now())

    product = relationship("Product")
    market = relationship("Market")


class Kullanici(Base):
    __tablename__ = "kullanicilar"
    __table_args__ = (
        Index("ix_kullanicilar_role_active", "rol", "is_active"),
        Index("ix_kullanicilar_market_active", "market_id", "is_active"),
    )

    kullanici_id = Column(Integer, primary_key=True, index=True)

    kullanici_adi = Column(String(50), unique=True, nullable=False)
    sifre_hash = Column(String(255), nullable=False)

    # admin, staff
    rol = Column(String(20), default="staff")

    market_id = Column(Integer, ForeignKey("markets.market_id"), nullable=True)

    # Personel kaydı silinmez; pasife alınır. Pasif kullanıcı giriş yapamaz.
    is_active = Column(Boolean, default=True, nullable=False)

    market = relationship("Market", back_populates="users")
