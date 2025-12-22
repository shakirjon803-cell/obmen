"""
Monetization router - boost packages, payments, balance.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.models.monetization import BoostPackage, Transaction, TransactionType
from pydantic import BaseModel

router = APIRouter()


class BoostPackageResponse(BaseModel):
    id: int
    name: str
    description: str | None
    duration_hours: int
    price: float
    currency: str
    original_price: float | None
    includes_bump: bool
    priority_in_search: bool
    badge_text: str | None
    
    class Config:
        from_attributes = True


class BalanceResponse(BaseModel):
    balance: float
    is_vip: bool
    vip_until: str | None


class TopUpRequest(BaseModel):
    amount: float
    payment_method: str = "card"  # 'card', 'payme', 'click'


class PurchaseBoostRequest(BaseModel):
    listing_id: int
    package_id: int


@router.get("/packages", response_model=List[BoostPackageResponse])
async def get_boost_packages(
    lang: str = "ru",
    db: AsyncSession = Depends(get_db)
):
    """Get available boost packages"""
    result = await db.execute(
        select(BoostPackage)
        .where(BoostPackage.is_active == True)
        .order_by(BoostPackage.sort_order)
    )
    packages = result.scalars().all()
    
    return [
        BoostPackageResponse(
            id=pkg.id,
            name=pkg.get_name(lang),
            description=pkg.description_ru if lang == "ru" else 
                       (pkg.description_uz if lang == "uz" else pkg.description_en),
            duration_hours=pkg.duration_hours,
            price=pkg.price,
            currency=pkg.currency,
            original_price=pkg.original_price,
            includes_bump=pkg.includes_bump,
            priority_in_search=pkg.priority_in_search,
            badge_text=pkg.badge_text,
        )
        for pkg in packages
    ]


@router.get("/balance", response_model=BalanceResponse)
async def get_balance(current_user: User = Depends(get_current_user)):
    """Get current user's balance and VIP status"""
    return BalanceResponse(
        balance=current_user.balance,
        is_vip=current_user.is_vip,
        vip_until=current_user.vip_until.isoformat() if current_user.vip_until else None,
    )


@router.post("/topup")
async def top_up_balance(
    data: TopUpRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Top up balance.
    
    In production, this would initiate payment via PayMe/Click/Card.
    For now, returns payment URL placeholder.
    """
    if data.amount <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Сумма должна быть положительной"
        )
    
    # Create pending transaction
    transaction = Transaction(
        user_id=current_user.id,
        type=TransactionType.DEPOSIT,
        amount=data.amount,
        payment_method=data.payment_method,
        status="pending",
        description=f"Пополнение баланса на {data.amount} UZS",
    )
    db.add(transaction)
    await db.flush()
    
    # TODO: Integrate with payment provider
    # For now, return mock payment URL
    payment_url = f"https://pay.example.com/checkout?tx={transaction.id}"
    
    return {
        "transaction_id": transaction.id,
        "payment_url": payment_url,
        "amount": data.amount,
    }


@router.post("/boost")
async def purchase_boost(
    data: PurchaseBoostRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Purchase a boost package for a listing.
    
    Deducts from balance if sufficient, otherwise requires payment.
    """
    # Get package
    result = await db.execute(
        select(BoostPackage).where(BoostPackage.id == data.package_id)
    )
    package = result.scalar_one_or_none()
    
    if not package or not package.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Пакет не найден"
        )
    
    # Check balance
    if current_user.balance < package.price:
        return {
            "success": False,
            "error": "insufficient_balance",
            "required": package.price,
            "balance": current_user.balance,
        }
    
    # Deduct balance
    current_user.balance -= package.price
    
    # Create transaction
    transaction = Transaction(
        user_id=current_user.id,
        type=TransactionType.BOOST,
        amount=-package.price,
        listing_id=data.listing_id,
        boost_package_id=package.id,
        payment_method="balance",
        description=f"Boost: {package.name_ru}",
    )
    db.add(transaction)
    
    # Apply boost to listing
    from app.services.listing_service import ListingService
    service = ListingService(db)
    listing = await service.boost_listing(
        listing_id=data.listing_id,
        owner_id=current_user.id,
        duration_hours=package.duration_hours,
        boost_level=package.boost_level,
    )
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено"
        )
    
    return {
        "success": True,
        "transaction_id": transaction.id,
        "new_balance": current_user.balance,
        "boosted_until": listing.boosted_until.isoformat(),
    }


@router.get("/transactions")
async def get_transactions(
    page: int = 1,
    per_page: int = 20,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get user's transaction history"""
    from sqlalchemy import func, desc
    
    # Count total
    count_result = await db.execute(
        select(func.count()).select_from(Transaction).where(
            Transaction.user_id == current_user.id
        )
    )
    total = count_result.scalar() or 0
    
    # Get transactions
    offset = (page - 1) * per_page
    result = await db.execute(
        select(Transaction)
        .where(Transaction.user_id == current_user.id)
        .order_by(desc(Transaction.created_at))
        .offset(offset)
        .limit(per_page)
    )
    transactions = result.scalars().all()
    
    return {
        "items": [
            {
                "id": tx.id,
                "type": tx.type.value,
                "amount": tx.amount,
                "status": tx.status,
                "description": tx.description,
                "created_at": tx.created_at.isoformat(),
            }
            for tx in transactions
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }
