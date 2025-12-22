"""
Listings router - marketplace CRUD and feed.
"""
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user, get_optional_user
from app.models.user import User
from app.models.listing import ListingType
from app.services.listing_service import ListingService
from app.services.file_service import file_service
from app.schemas.listing import (
    ListingCreate, ListingUpdate, ListingResponse,
    ListingListResponse, ListingCardResponse, BoostListingRequest
)

router = APIRouter()


@router.get("", response_model=ListingListResponse)
async def get_listings(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    category_id: Optional[int] = None,
    city: Optional[str] = None,
    type: Optional[ListingType] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    search: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """
    Get paginated feed of listings.
    
    Listings are ordered by:
    1. Boosted listings first
    2. Then by bump time (most recently bumped first)
    """
    service = ListingService(db)
    
    listings, total = await service.get_feed(
        page=page,
        per_page=per_page,
        category_id=category_id,
        city=city,
        listing_type=type,
        min_price=min_price,
        max_price=max_price,
        search=search,
    )
    
    # Convert to card responses
    items = []
    for listing in listings:
        items.append(ListingCardResponse(
            id=listing.id,
            title=listing.title,
            type=listing.type,
            price=listing.price,
            currency=listing.currency,
            location=listing.location,
            thumbnail_url=listing.thumbnail_url,
            is_boosted=listing.is_boosted,
            owner_name=listing.owner.name if listing.owner else None,
            owner_avatar=listing.owner.avatar_url if listing.owner else None,
            created_at=listing.created_at,
        ))
    
    pages = (total + per_page - 1) // per_page
    
    return ListingListResponse(
        items=items,
        total=total,
        page=page,
        per_page=per_page,
        pages=pages,
    )


@router.post("", response_model=ListingResponse)
async def create_listing(
    data: ListingCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Create a new listing"""
    service = ListingService(db)
    listing = await service.create(current_user.id, data)
    
    # Reload with relationships
    listing = await service.get_by_id(listing.id)
    
    return listing


@router.get("/my", response_model=List[ListingCardResponse])
async def get_my_listings(
    include_archived: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get current user's listings"""
    service = ListingService(db)
    listings = await service.get_user_listings(current_user.id, include_archived)
    
    return [
        ListingCardResponse(
            id=listing.id,
            title=listing.title,
            type=listing.type,
            price=listing.price,
            currency=listing.currency,
            location=listing.location,
            thumbnail_url=listing.thumbnail_url,
            is_boosted=listing.is_boosted,
            owner_name=current_user.name,
            owner_avatar=current_user.avatar_url,
            created_at=listing.created_at,
        )
        for listing in listings
    ]


@router.get("/{listing_id}", response_model=ListingResponse)
async def get_listing(
    listing_id: int,
    current_user: Optional[User] = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """Get single listing by ID"""
    service = ListingService(db)
    listing = await service.get_by_id(listing_id)
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено"
        )
    
    # Increment views (don't count owner views)
    if not current_user or current_user.id != listing.owner_id:
        await service.increment_views(listing_id)
    
    return listing


@router.patch("/{listing_id}", response_model=ListingResponse)
async def update_listing(
    listing_id: int,
    data: ListingUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Update a listing (owner only)"""
    service = ListingService(db)
    listing = await service.update(listing_id, current_user.id, data)
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено или нет прав"
        )
    
    return listing


@router.delete("/{listing_id}")
async def delete_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Delete a listing (owner only)"""
    service = ListingService(db)
    success = await service.delete(listing_id, current_user.id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено или нет прав"
        )
    
    return {"status": "ok"}


@router.post("/{listing_id}/images")
async def upload_image(
    listing_id: int,
    file: UploadFile = File(...),
    is_primary: bool = False,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload image for a listing.
    
    Images are stored on disk/S3, only URL is saved to DB.
    Thumbnails are automatically generated.
    """
    service = ListingService(db)
    
    # Verify ownership
    listing = await service.get_by_id(listing_id)
    if not listing or listing.owner_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено или нет прав"
        )
    
    try:
        # Save file
        result = await file_service.save_image(file, folder="listings")
        
        # Add to database
        image = await service.add_image(
            listing_id=listing_id,
            url=result["url"],
            thumbnail_url=result.get("thumbnail_url"),
            is_primary=is_primary,
        )
        
        return {
            "id": image.id,
            "url": result["url"],
            "thumbnail_url": result.get("thumbnail_url"),
        }
    
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/{listing_id}/boost")
async def boost_listing(
    listing_id: int,
    data: BoostListingRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Boost a listing to appear at top of feed.
    
    Requires payment (balance or external).
    """
    # TODO: Implement payment processing
    # For now, just mark as boosted
    
    service = ListingService(db)
    listing = await service.boost_listing(
        listing_id=listing_id,
        owner_id=current_user.id,
        duration_hours=24,  # TODO: Get from package
        boost_level=1,
    )
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено или нет прав"
        )
    
    return {"status": "ok", "boosted_until": listing.boosted_until}


@router.post("/{listing_id}/bump")
async def bump_listing(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Bump listing to top of feed (paid feature)"""
    service = ListingService(db)
    listing = await service.bump_listing(listing_id, current_user.id)
    
    if not listing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Объявление не найдено или нет прав"
        )
    
    return {"status": "ok", "bumped_at": listing.bumped_at}
