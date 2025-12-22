"""
Authentication router - registration, login, JWT tokens.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.auth_service import AuthService
from app.schemas.user import UserCreate, UserLogin, TokenResponse

router = APIRouter()


@router.post("/register", response_model=TokenResponse)
async def register(data: UserCreate, db: AsyncSession = Depends(get_db)):
    """
    Register a new user account.
    
    Returns JWT token on success.
    """
    service = AuthService(db)
    
    try:
        result = await service.register(data)
        return result
    except ValueError as e:
        if str(e) == "nickname_taken":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Этот никнейм уже занят"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/login", response_model=TokenResponse)
async def login(data: UserLogin, db: AsyncSession = Depends(get_db)):
    """
    Login with nickname and password.
    
    Returns JWT token on success.
    """
    service = AuthService(db)
    
    try:
        result = await service.login(data.nickname, data.password)
        return result
    except ValueError as e:
        error = str(e)
        if error == "invalid_credentials":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Неверный логин или пароль"
            )
        if error == "user_banned":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Аккаунт заблокирован"
            )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=error
        )


@router.post("/check-nickname")
async def check_nickname(nickname: str, db: AsyncSession = Depends(get_db)):
    """Check if a nickname is available"""
    service = AuthService(db)
    exists = await service.check_nickname_exists(nickname)
    return {"available": not exists}
