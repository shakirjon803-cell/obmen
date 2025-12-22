"""
User Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from app.models.user import UserRole


class UserBase(BaseModel):
    """Base user fields"""
    nickname: str = Field(..., min_length=3, max_length=50)
    name: Optional[str] = None
    phone: Optional[str] = None
    language: str = "ru"


class UserCreate(UserBase):
    """Schema for user registration"""
    password: str = Field(..., min_length=4)
    telegram_id: Optional[int] = None
    
    @field_validator("nickname")
    @classmethod
    def validate_nickname(cls, v: str) -> str:
        # Allow only alphanumeric and underscores
        if not v.replace("_", "").isalnum():
            raise ValueError("Nickname can only contain letters, numbers, and underscores")
        return v.lower()


class UserLogin(BaseModel):
    """Schema for login"""
    nickname: str
    password: str


class TokenResponse(BaseModel):
    """JWT token response"""
    access_token: str
    token_type: str = "bearer"
    user: "UserResponse"


class UserResponse(BaseModel):
    """User response with public info"""
    id: int
    nickname: str
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole
    is_seller_verified: bool
    rating: float
    rating_count: int
    deals_count: int
    is_vip: bool
    language: str
    created_at: datetime
    
    class Config:
        from_attributes = True


class UserProfileUpdate(BaseModel):
    """Update user profile"""
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    language: Optional[str] = None


class UserPublicProfile(BaseModel):
    """Public profile - visible to other users"""
    id: int
    nickname: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    role: UserRole
    is_seller_verified: bool
    rating: float
    rating_count: int
    deals_count: int
    is_vip: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


# Needed for forward reference
TokenResponse.model_rebuild()
