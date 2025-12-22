"""
Listing Pydantic schemas for marketplace posts.
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.listing import ListingType, ListingStatus


class ListingImageResponse(BaseModel):
    """Image in listing response"""
    id: int
    url: str
    thumbnail_url: Optional[str] = None
    is_primary: bool = False
    
    class Config:
        from_attributes = True


class ListingBase(BaseModel):
    """Base listing fields"""
    title: str = Field(..., min_length=3, max_length=200)
    description: Optional[str] = None
    type: ListingType = ListingType.SELL
    category_id: Optional[int] = None
    
    # Pricing
    price: Optional[float] = None
    currency: str = "UZS"
    is_negotiable: bool = True
    
    # Legacy P2P fields
    amount: Optional[float] = None
    rate: Optional[float] = None
    
    # Location
    location: Optional[str] = None
    city: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    
    # Dynamic attributes (category-specific)
    attributes: Dict[str, Any] = Field(default_factory=dict)


class ListingCreate(ListingBase):
    """Create new listing"""
    pass


class ListingUpdate(BaseModel):
    """Update existing listing - all fields optional"""
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = None
    type: Optional[ListingType] = None
    category_id: Optional[int] = None
    status: Optional[ListingStatus] = None
    
    price: Optional[float] = None
    currency: Optional[str] = None
    is_negotiable: Optional[bool] = None
    
    amount: Optional[float] = None
    rate: Optional[float] = None
    
    location: Optional[str] = None
    city: Optional[str] = None
    
    attributes: Optional[Dict[str, Any]] = None


class OwnerInfo(BaseModel):
    """Listing owner info - minimal for cards"""
    id: int
    nickname: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    rating: float
    deals_count: int
    is_vip: bool
    
    class Config:
        from_attributes = True


class ListingResponse(BaseModel):
    """Full listing response"""
    id: int
    title: str
    description: Optional[str] = None
    type: ListingType
    status: ListingStatus
    category_id: Optional[int] = None
    
    price: Optional[float] = None
    currency: str
    is_negotiable: bool
    
    amount: Optional[float] = None
    rate: Optional[float] = None
    
    location: Optional[str] = None
    city: Optional[str] = None
    
    attributes: Dict[str, Any]
    
    views_count: int
    favorites_count: int
    
    is_boosted: bool
    
    images: List[ListingImageResponse] = []
    owner: OwnerInfo
    
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True


class ListingCardResponse(BaseModel):
    """Minimal listing for feed/list views"""
    id: int
    title: str
    type: ListingType
    price: Optional[float] = None
    currency: str
    location: Optional[str] = None
    thumbnail_url: Optional[str] = None
    is_boosted: bool
    owner_name: Optional[str] = None
    owner_avatar: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True


class ListingListResponse(BaseModel):
    """Paginated listing list"""
    items: List[ListingCardResponse]
    total: int
    page: int
    per_page: int
    pages: int


class BoostListingRequest(BaseModel):
    """Request to boost a listing"""
    package_id: int
    payment_method: str = "balance"  # 'balance', 'card', 'payme'
