"""
Listing and ListingImage models - replaces flat market_posts table.

Key improvements over old structure:
- Separate ListingImage table (no more base64 in TEXT columns)
- JSON attributes column for EAV values
- Boost/monetization fields
- Full-text search ready (title, description indexed)
"""
from sqlalchemy import Column, Integer, String, Float, Text, ForeignKey, DateTime, Boolean, JSON, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base
import enum


class ListingType(str, enum.Enum):
    """Type of listing"""
    SELL = "sell"       # Selling goods
    BUY = "buy"         # Want to buy
    SERVICE = "service" # Offering a service
    EXCHANGE = "exchange"  # Legacy P2P currency exchange


class ListingStatus(str, enum.Enum):
    """Listing status for moderation and lifecycle"""
    ACTIVE = "active"       # Visible to all
    SOLD = "sold"           # Marked as sold
    ARCHIVED = "archived"   # Hidden by owner
    MODERATION = "moderation"  # Pending review
    REJECTED = "rejected"   # Rejected by moderator


class Listing(Base):
    """
    Universal listing table for all marketplace content.
    
    Supports:
    - Goods (sell/buy)
    - Services
    - P2P Currency Exchange (legacy feature)
    
    Design decisions:
    - JSON 'attributes' column stores EAV values per category
    - Separate images table for proper file handling
    - bumped_at for "boost to top" feature
    - Denormalized counters for performance
    """
    __tablename__ = "listings"

    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # === Core Fields ===
    title = Column(String(200), nullable=False)
    description = Column(Text)
    type = Column(SQLEnum(ListingType), default=ListingType.SELL, index=True)
    status = Column(SQLEnum(ListingStatus), default=ListingStatus.ACTIVE, index=True)
    
    # === Pricing ===
    price = Column(Float)  # Main price
    currency = Column(String(10), default="UZS")  # UZS, USD, RUB
    is_negotiable = Column(Boolean, default=True)
    
    # === Legacy P2P Exchange Fields ===
    # Kept for backward compatibility with existing P2P feature
    amount = Column(Float)  # Amount to exchange
    rate = Column(Float)    # Exchange rate offered
    
    # === Location ===
    location = Column(String(200))  # Text location
    city = Column(String(100), index=True)  # For filtering
    latitude = Column(Float)
    longitude = Column(Float)
    
    # === Dynamic Attributes (EAV) ===
    # Stores category-specific values as JSON
    # Example: {"size": "XL", "expiry_date": "2025-01-15", "brand": "Nike"}
    attributes = Column(JSON, default=dict)
    
    # === Counters (denormalized for performance) ===
    views_count = Column(Integer, default=0)
    favorites_count = Column(Integer, default=0)
    messages_count = Column(Integer, default=0)  # Inquiries received
    
    # === Boost / Monetization ===
    is_boosted = Column(Boolean, default=False, index=True)
    boosted_until = Column(DateTime, nullable=True)
    boost_level = Column(Integer, default=0)  # 0=none, 1=basic, 2=premium, 3=vip
    
    # "Bump to top" - updated when user pays to bump
    bumped_at = Column(DateTime, server_default=func.now(), index=True)
    
    # === Timestamps ===
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())
    expires_at = Column(DateTime, nullable=True)  # Optional expiration

    # === Relationships ===
    owner = relationship("User", back_populates="listings")
    category = relationship("Category", back_populates="listings")
    images = relationship(
        "ListingImage",
        back_populates="listing",
        cascade="all, delete-orphan",
        lazy="selectin",  # Eager load images
        order_by="ListingImage.sort_order"
    )

    # === Indexes for common queries ===
    __table_args__ = (
        # Index for feed sorting (boosted first, then by bump time)
        Index("idx_listings_feed", "status", "is_boosted", "bumped_at"),
        # Index for category browsing
        Index("idx_listings_category", "category_id", "status", "created_at"),
        # Index for user's listings
        Index("idx_listings_owner", "owner_id", "status"),
    )

    def __repr__(self):
        return f"<Listing {self.title[:30]} (id={self.id})>"
    
    @property
    def primary_image_url(self) -> str | None:
        """Get the primary image URL or first image"""
        for img in self.images:
            if img.is_primary:
                return img.url
        return self.images[0].url if self.images else None
    
    @property
    def thumbnail_url(self) -> str | None:
        """Get thumbnail for feed display"""
        for img in self.images:
            if img.is_primary:
                return img.thumbnail_url or img.url
        if self.images:
            return self.images[0].thumbnail_url or self.images[0].url
        return None


class ListingImage(Base):
    """
    Separate table for listing images.
    
    Why separate table:
    - No more base64 strings in database (huge performance gain)
    - Multiple images per listing
    - Thumbnails for fast feed loading
    - Easy to add CDN URLs later
    """
    __tablename__ = "listing_images"

    id = Column(Integer, primary_key=True, index=True)
    listing_id = Column(
        Integer,
        ForeignKey("listings.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    
    # === URLs ===
    url = Column(String(500), nullable=False)  # Full image URL
    thumbnail_url = Column(String(500))        # Compressed thumbnail (300px)
    
    # === Ordering ===
    sort_order = Column(Integer, default=0)
    is_primary = Column(Boolean, default=False)  # Main image for listing
    
    # === Metadata ===
    original_filename = Column(String(200))
    file_size = Column(Integer)  # In bytes
    width = Column(Integer)
    height = Column(Integer)
    
    created_at = Column(DateTime, server_default=func.now())

    # === Relationship ===
    listing = relationship("Listing", back_populates="images")

    def __repr__(self):
        return f"<ListingImage {self.id} (listing_id={self.listing_id})>"
