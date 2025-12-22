"""
Monetization models for paid features.

Supports:
- Boost packages (promote listings to top)
- VIP subscriptions
- Transaction history
- Wallet/balance management
"""
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime, Boolean, Enum as SQLEnum, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class TransactionType(str, enum.Enum):
    """Types of financial transactions"""
    DEPOSIT = "deposit"       # User adds money to balance
    BOOST = "boost"           # Paid listing boost
    BUMP = "bump"             # Paid bump to top
    VIP = "vip"               # VIP subscription purchase
    PAID_POST = "paid_post"   # Fee for posting in paid category
    WITHDRAWAL = "withdrawal" # User withdraws money
    REFUND = "refund"         # Refund for failed service


class TransactionStatus(str, enum.Enum):
    """Transaction status"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


class Transaction(Base):
    """
    Financial transaction log for all monetization activities.
    
    Used for:
    - Tracking user spending
    - Audit trail
    - Refund processing
    """
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # === Transaction Details ===
    type = Column(SQLEnum(TransactionType), nullable=False, index=True)
    amount = Column(Float, nullable=False)  # Positive = credit, Negative = debit
    currency = Column(String(10), default="UZS")
    
    # === Status ===
    status = Column(SQLEnum(TransactionStatus), default=TransactionStatus.COMPLETED, index=True)
    
    # === Optional References ===
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True)
    boost_package_id = Column(Integer, ForeignKey("boost_packages.id"), nullable=True)
    
    # === Payment Details ===
    payment_method = Column(String(50))  # 'balance', 'card', 'payme', 'click'
    payment_reference = Column(String(200))  # External payment ID
    
    # === Description ===
    description = Column(String(200))
    notes = Column(Text)  # Admin notes
    
    # === Timestamps ===
    created_at = Column(DateTime, server_default=func.now(), index=True)
    completed_at = Column(DateTime, nullable=True)

    # === Relationships ===
    user = relationship("User", back_populates="transactions")
    listing = relationship("Listing")
    boost_package = relationship("BoostPackage")

    def __repr__(self):
        return f"<Transaction {self.id}: {self.type.value} {self.amount}>"


class BoostPackage(Base):
    """
    Available boost packages for purchase.
    
    Examples:
    - "Basic Boost" - 24 hours, 5000 UZS
    - "Premium Boost" - 7 days, 25000 UZS
    - "VIP Boost" - 30 days + priority, 80000 UZS
    """
    __tablename__ = "boost_packages"

    id = Column(Integer, primary_key=True, index=True)
    
    # === Names (multi-language) ===
    name_ru = Column(String(100), nullable=False)
    name_uz = Column(String(100))
    name_en = Column(String(100))
    
    # === Description ===
    description_ru = Column(Text)
    description_uz = Column(Text)
    description_en = Column(Text)
    
    # === Package Details ===
    duration_hours = Column(Integer, nullable=False)  # How long the boost lasts
    boost_level = Column(Integer, default=1)  # 1=basic, 2=premium, 3=vip
    
    # === Pricing ===
    price = Column(Float, nullable=False)
    currency = Column(String(10), default="UZS")
    original_price = Column(Float)  # For showing discounts
    
    # === Features ===
    includes_bump = Column(Boolean, default=True)  # Bump to top on activation
    priority_in_search = Column(Boolean, default=False)  # Higher in search results
    highlight_color = Column(String(20))  # Border/badge color
    badge_text = Column(String(50))  # e.g., "TOP", "VIP"
    
    # === Status ===
    is_active = Column(Boolean, default=True)
    sort_order = Column(Integer, default=0)
    
    created_at = Column(DateTime, server_default=func.now())

    def __repr__(self):
        return f"<BoostPackage {self.name_ru} ({self.duration_hours}h, {self.price})>"
    
    def get_name(self, lang: str = "ru") -> str:
        """Get localized name"""
        if lang == "uz" and self.name_uz:
            return self.name_uz
        if lang == "en" and self.name_en:
            return self.name_en
        return self.name_ru


class VIPSubscription(Base):
    """
    VIP user subscriptions.
    
    VIP benefits:
    - All posts are boosted automatically
    - Special badge on profile
    - Priority in search
    - More listing slots
    """
    __tablename__ = "vip_subscriptions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # === Subscription Details ===
    plan_name = Column(String(50), nullable=False)  # 'monthly', 'quarterly', 'yearly'
    price_paid = Column(Float, nullable=False)
    
    # === Duration ===
    started_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=False, index=True)
    
    # === Status ===
    is_active = Column(Boolean, default=True, index=True)
    cancelled_at = Column(DateTime, nullable=True)
    cancellation_reason = Column(String(200))
    
    # === Payment ===
    transaction_id = Column(Integer, ForeignKey("transactions.id"), nullable=True)
    auto_renew = Column(Boolean, default=False)
    
    created_at = Column(DateTime, server_default=func.now())

    # === Relationships ===
    user = relationship("User")
    transaction = relationship("Transaction")

    def __repr__(self):
        return f"<VIPSubscription user={self.user_id} until={self.expires_at}>"
