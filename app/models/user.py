"""
User model - unified authentication for Telegram + Web users.
Replaces both 'users' and 'web_accounts' tables from SQLite.
"""
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Enum as SQLEnum
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class UserRole(str, enum.Enum):
    """User role enum for authorization"""
    CLIENT = "client"       # Regular user (can buy)
    EXCHANGER = "exchanger" # Verified seller/exchanger
    ADMIN = "admin"         # Administrator


class User(Base):
    """
    Core user table - unified for both Telegram and Web authentication.
    
    Design decisions:
    - telegram_id is nullable to support web-only registration
    - nickname is required and unique for login
    - Ratings and deals_count are denormalized for performance
    - balance is for internal monetization (boost/VIP)
    """
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    
    # === Authentication ===
    telegram_id = Column(Integer, unique=True, nullable=True, index=True)
    nickname = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    
    # === Profile ===
    name = Column(String(100))
    phone = Column(String(20))
    avatar_url = Column(String(500))
    original_avatar_url = Column(String(500))  # For re-cropping
    
    # === Role & Status ===
    role = Column(SQLEnum(UserRole), default=UserRole.CLIENT, index=True)
    is_seller_verified = Column(Boolean, default=False)
    is_active = Column(Boolean, default=True)
    is_banned = Column(Boolean, default=False)
    
    # === Ratings & Stats ===
    # Denormalized for performance - updated via triggers or service
    rating = Column(Float, default=5.0)
    rating_count = Column(Integer, default=0)  # Number of ratings received
    deals_count = Column(Integer, default=0)
    
    # === Monetization ===
    balance = Column(Float, default=0.0)  # Internal currency for paid features
    is_vip = Column(Boolean, default=False)
    vip_until = Column(DateTime, nullable=True)
    
    # === Localization ===
    language = Column(String(5), default="ru")  # 'ru', 'uz', 'en'
    
    # === Timestamps ===
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    last_active_at = Column(DateTime, server_default=func.now())

    # === Relationships ===
    listings = relationship("Listing", back_populates="owner", lazy="dynamic")
    sent_messages = relationship(
        "Message",
        foreign_keys="Message.sender_id",
        back_populates="sender",
        lazy="dynamic"
    )
    transactions = relationship("Transaction", back_populates="user", lazy="dynamic")

    def __repr__(self):
        return f"<User {self.nickname} (id={self.id})>"
