from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ActiveStatusUpdate(BaseModel):
    is_active: bool


class ProductBase(BaseModel):
    product_name: str
    category: str
    barcode: Optional[str] = None
    unit_type: str = "adet"
    unit_price: float = Field(gt=0)
    profit_margin: float = Field(ge=0)
    min_stock_level: int = Field(default=10, ge=0)
    shelf_life_days: int = Field(default=180, ge=0)
    is_perishable: bool = True


class ProductCreate(ProductBase):
    pass


class ProductUpdate(BaseModel):
    product_name: Optional[str] = None
    category: Optional[str] = None
    unit_price: Optional[float] = Field(default=None, gt=0)
    profit_margin: Optional[float] = Field(default=None, ge=0)
    min_stock_level: Optional[int] = Field(default=None, ge=0)
    shelf_life_days: Optional[int] = Field(default=None, ge=0)
    is_perishable: Optional[bool] = None
    barcode: Optional[str] = None
    unit_type: Optional[str] = None
    is_active: Optional[bool] = None


class ProductResponse(ProductBase):
    product_id: int
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class MarketBase(BaseModel):
    name: str
    city: str
    is_depot: bool = False


class MarketCreate(MarketBase):
    pass


class MarketUpdate(BaseModel):
    name: Optional[str] = None
    city: Optional[str] = None
    is_depot: Optional[bool] = None
    is_active: Optional[bool] = None


class MarketResponse(MarketBase):
    market_id: int
    is_depot: bool = False
    is_active: bool = True
    model_config = ConfigDict(from_attributes=True)


class StockBase(BaseModel):
    product_id: int
    market_id: int
    quantity: int = Field(ge=0)


class StockCreate(StockBase):
    pass


class StockResponse(StockBase):
    stock_id: int
    last_updated: datetime
    model_config = ConfigDict(from_attributes=True)


class StockBatchCreate(BaseModel):
    product_id: int
    market_id: int
    lot_code: str
    initial_quantity: int = Field(gt=0)
    remaining_quantity: int = Field(ge=0)
    received_date: datetime
    expiry_date: Optional[datetime] = None
    unit_cost: float = Field(default=0.0, ge=0)
    status: str = "active"


class StockBatchResponse(StockBatchCreate):
    batch_id: int
    created_at: datetime
    updated_at: datetime
    model_config = ConfigDict(from_attributes=True)


class StockBatchListItem(BaseModel):
    batch_id: int
    product_id: int
    product_name: str
    market_id: int
    market_name: str
    lot_code: str
    initial_quantity: int
    remaining_quantity: int
    received_date: datetime
    expiry_date: Optional[datetime] = None
    days_to_expiry: Optional[int] = None
    status: str




class LiveSaleRequest(BaseModel):
    product_id: int
    market_id: int
    quantity: int = Field(gt=0)
    create_transfer_task: bool = False

class SaleBase(BaseModel):
    product_id: int
    market_id: int
    quantity: int = Field(gt=0)


class SaleCreate(SaleBase):
    pass


class SaleResponse(SaleBase):
    sale_id: int
    sale_date: datetime
    model_config = ConfigDict(from_attributes=True)


class TransferBase(BaseModel):
    product_id: int
    source_market_id: int
    target_market_id: int
    quantity: int = Field(gt=0)
    estimated_profit_gain: float = Field(default=0.0, ge=0)
    estimated_waste_prevented: int = Field(default=0, ge=0)
    ai_explanation: Optional[str] = None


class TransferCreate(TransferBase):
    pass


class TransferApplyRequest(BaseModel):
    kaynak_sube: str
    hedef_sube: str
    urun: str
    miktar: int = Field(gt=0)
    kurtarilan_kar_tahmini: float = Field(default=0.0, ge=0)
    onlenen_fire_adedi: int = Field(default=0, ge=0)
    aciklama: Optional[str] = None


class TransferDecisionRequest(BaseModel):
    status: str
    reason: Optional[str] = None
    user_id: Optional[int] = None


class TransferStatusUpdate(BaseModel):
    status: str


class TransferResponse(TransferBase):
    transfer_id: int
    status: str
    rejection_reason: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class TransferListItem(BaseModel):
    transfer_id: int
    product_id: int
    product_name: str
    source_market_id: int
    source_market_name: str
    target_market_id: int
    target_market_name: str
    quantity: int
    estimated_profit_gain: float
    estimated_waste_prevented: int
    status: str
    ai_explanation: Optional[str] = None
    rejection_reason: Optional[str] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None


class AlertCreate(BaseModel):
    market_id: Optional[int] = None
    product_id: Optional[int] = None
    created_by_user_id: Optional[int] = None
    alert_type: str
    severity: str = "medium"
    title: str
    message: Optional[str] = None


class AlertStatusUpdate(BaseModel):
    status: str


class AlertListItem(BaseModel):
    alert_id: int
    market_id: Optional[int] = None
    market_name: Optional[str] = None
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    alert_type: str
    severity: str
    title: str
    message: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None


class UserCreate(BaseModel):
    kullanici_adi: str
    sifre: str
    rol: str = "staff"
    market_id: Optional[int] = None
    is_active: bool = True


class UserUpdate(BaseModel):
    kullanici_adi: Optional[str] = None
    sifre: Optional[str] = None
    rol: Optional[str] = None
    market_id: Optional[int] = None
    is_active: Optional[bool] = None


class UserListItem(BaseModel):
    kullanici_id: int
    kullanici_adi: str
    rol: str
    market_id: Optional[int] = None
    market_name: Optional[str] = None
    is_active: bool = True



class AssistantChatRequest(BaseModel):
    message: str
    user_id: Optional[int] = None
    mode: str = "approval"


class AssistantActionCreate(BaseModel):
    group_id: Optional[str] = None
    action_type: str
    title: str
    description: Optional[str] = None
    payload_json: str
    risk_level: str = "medium"
    confidence: float = Field(default=0.80, ge=0, le=1)
    created_by_user_id: Optional[int] = None


class AssistantActionDecisionRequest(BaseModel):
    user_id: Optional[int] = None


class AssistantActionListItem(BaseModel):
    action_id: int
    group_id: Optional[str] = None
    action_type: str
    title: str
    description: Optional[str] = None
    payload: dict
    status: str
    risk_level: str
    confidence: float
    created_by_user_id: Optional[int] = None
    approved_by_user_id: Optional[int] = None
    created_at: datetime
    approved_at: Optional[datetime] = None
    executed_at: Optional[datetime] = None
    result_message: Optional[str] = None


class AssistantChatResponse(BaseModel):
    success: bool
    answer: str
    group_id: Optional[str] = None
    actions: list[AssistantActionListItem] = []
    llm_used: bool = False


class AlertBulkUpdateRequest(BaseModel):
    status: str
    alert_type: Optional[str] = None


class AssistantMessageListItem(BaseModel):
    message_id: int
    role: str
    content: str
    intent: Optional[str] = None
    group_id: Optional[str] = None
    llm_used: bool = False
    created_at: datetime


class OperationEventListItem(BaseModel):
    event_id: int
    event_type: str
    title: str
    description: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    user_id: Optional[int] = None
    created_at: datetime
