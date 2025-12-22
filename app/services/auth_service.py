"""
Authentication service - handles registration, login, JWT tokens.
"""
from datetime import datetime, timedelta
from typing import Optional
import bcrypt
import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User, UserRole
from app.schemas.user import UserCreate, UserResponse, TokenResponse


class AuthService:
    """
    Authentication service for user management.
    
    Features:
    - Password hashing with bcrypt
    - JWT token generation and validation
    - User registration and login
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash password using bcrypt"""
        return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()
    
    @staticmethod
    def verify_password(password: str, hashed: str) -> bool:
        """Verify password against hash"""
        return bcrypt.checkpw(password.encode(), hashed.encode())
    
    @staticmethod
    def create_token(user_id: int, expires_minutes: int = None) -> str:
        """Create JWT access token"""
        if expires_minutes is None:
            expires_minutes = settings.JWT_EXPIRE_MINUTES
        
        payload = {
            "sub": str(user_id),
            "exp": datetime.utcnow() + timedelta(minutes=expires_minutes),
            "iat": datetime.utcnow(),
        }
        return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.JWT_ALGORITHM)
    
    @staticmethod
    def decode_token(token: str) -> Optional[int]:
        """Decode JWT token, return user_id or None if invalid"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
            return int(payload["sub"])
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError):
            return None
    
    async def get_user_by_nickname(self, nickname: str) -> Optional[User]:
        """Find user by nickname (case-insensitive)"""
        result = await self.db.execute(
            select(User).where(User.nickname == nickname.lower())
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_id(self, user_id: int) -> Optional[User]:
        """Find user by ID"""
        result = await self.db.execute(
            select(User).where(User.id == user_id)
        )
        return result.scalar_one_or_none()
    
    async def get_user_by_telegram_id(self, telegram_id: int) -> Optional[User]:
        """Find user by Telegram ID"""
        result = await self.db.execute(
            select(User).where(User.telegram_id == telegram_id)
        )
        return result.scalar_one_or_none()
    
    async def check_nickname_exists(self, nickname: str) -> bool:
        """Check if nickname is already taken"""
        user = await self.get_user_by_nickname(nickname)
        return user is not None
    
    async def register(self, data: UserCreate) -> TokenResponse:
        """
        Register a new user.
        
        Raises:
            ValueError: If nickname already exists
        """
        # Check if nickname exists
        if await self.check_nickname_exists(data.nickname):
            raise ValueError("nickname_taken")
        
        # Create user
        user = User(
            nickname=data.nickname.lower(),
            name=data.name or data.nickname,
            phone=data.phone,
            password_hash=self.hash_password(data.password),
            telegram_id=data.telegram_id,
            language=data.language,
            role=UserRole.CLIENT,
        )
        
        self.db.add(user)
        await self.db.flush()  # Get the ID
        await self.db.refresh(user)
        
        # Generate token
        token = self.create_token(user.id)
        
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user)
        )
    
    async def login(self, nickname: str, password: str) -> TokenResponse:
        """
        Login with nickname and password.
        
        Raises:
            ValueError: If credentials are invalid
        """
        user = await self.get_user_by_nickname(nickname)
        
        if not user:
            raise ValueError("invalid_credentials")
        
        if not self.verify_password(password, user.password_hash):
            raise ValueError("invalid_credentials")
        
        if user.is_banned:
            raise ValueError("user_banned")
        
        # Update last active
        user.last_active_at = datetime.utcnow()
        
        # Generate token
        token = self.create_token(user.id)
        
        return TokenResponse(
            access_token=token,
            user=UserResponse.model_validate(user)
        )
    
    async def upgrade_to_seller(self, user_id: int) -> User:
        """Upgrade user to seller/exchanger role"""
        user = await self.get_user_by_id(user_id)
        if not user:
            raise ValueError("user_not_found")
        
        user.role = UserRole.EXCHANGER
        user.is_seller_verified = True
        
        return user
