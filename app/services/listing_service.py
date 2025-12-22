"""
Listing service - business logic for marketplace posts.
"""
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
from sqlalchemy import select, func, or_, and_, desc
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.listing import Listing, ListingImage, ListingStatus, ListingType
from app.models.user import User
from app.schemas.listing import ListingCreate, ListingUpdate


class ListingService:
    """
    Listing service for marketplace operations.
    
    Features:
    - CRUD operations with owner validation
    - Feed with boost priority
    - Search and filtering
    - Image management
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def create(self, owner_id: int, data: ListingCreate) -> Listing:
        """Create a new listing"""
        listing = Listing(
            owner_id=owner_id,
            title=data.title,
            description=data.description,
            type=data.type,
            category_id=data.category_id,
            price=data.price,
            currency=data.currency,
            is_negotiable=data.is_negotiable,
            amount=data.amount,
            rate=data.rate,
            location=data.location,
            city=data.city,
            latitude=data.latitude,
            longitude=data.longitude,
            attributes=data.attributes,
            status=ListingStatus.ACTIVE,
        )
        
        self.db.add(listing)
        await self.db.flush()
        await self.db.refresh(listing)
        
        return listing
    
    async def get_by_id(self, listing_id: int) -> Optional[Listing]:
        """Get listing by ID with images and owner"""
        result = await self.db.execute(
            select(Listing)
            .options(
                selectinload(Listing.images),
                selectinload(Listing.owner),
                selectinload(Listing.category)
            )
            .where(Listing.id == listing_id)
        )
        return result.scalar_one_or_none()
    
    async def update(
        self,
        listing_id: int,
        owner_id: int,
        data: ListingUpdate
    ) -> Optional[Listing]:
        """Update listing (only by owner)"""
        listing = await self.get_by_id(listing_id)
        
        if not listing or listing.owner_id != owner_id:
            return None
        
        # Update only provided fields
        update_data = data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(listing, field, value)
        
        listing.updated_at = datetime.utcnow()
        
        return listing
    
    async def delete(self, listing_id: int, owner_id: int) -> bool:
        """Delete listing (only by owner)"""
        listing = await self.get_by_id(listing_id)
        
        if not listing or listing.owner_id != owner_id:
            return False
        
        await self.db.delete(listing)
        return True
    
    async def add_image(
        self,
        listing_id: int,
        url: str,
        thumbnail_url: Optional[str] = None,
        is_primary: bool = False
    ) -> ListingImage:
        """Add image to listing"""
        # If primary, unset other primaries
        if is_primary:
            await self.db.execute(
                select(ListingImage)
                .where(
                    ListingImage.listing_id == listing_id,
                    ListingImage.is_primary == True
                )
            )
            # Update via separate query to avoid issues
        
        # Get current max sort order
        result = await self.db.execute(
            select(func.max(ListingImage.sort_order))
            .where(ListingImage.listing_id == listing_id)
        )
        max_order = result.scalar() or -1
        
        image = ListingImage(
            listing_id=listing_id,
            url=url,
            thumbnail_url=thumbnail_url,
            is_primary=is_primary,
            sort_order=max_order + 1,
        )
        
        self.db.add(image)
        await self.db.flush()
        
        return image
    
    async def get_feed(
        self,
        page: int = 1,
        per_page: int = 20,
        category_id: Optional[int] = None,
        city: Optional[str] = None,
        listing_type: Optional[ListingType] = None,
        min_price: Optional[float] = None,
        max_price: Optional[float] = None,
        search: Optional[str] = None,
    ) -> Tuple[List[Listing], int]:
        """
        Get paginated feed with filtering.
        
        Order: boosted listings first, then by bumped_at (most recent).
        This allows users to "bump" their posts to the top.
        """
        query = (
            select(Listing)
            .options(
                selectinload(Listing.images),
                selectinload(Listing.owner)
            )
            .where(Listing.status == ListingStatus.ACTIVE)
        )
        
        # Filters
        if category_id:
            query = query.where(Listing.category_id == category_id)
        
        if city:
            query = query.where(Listing.city == city)
        
        if listing_type:
            query = query.where(Listing.type == listing_type)
        
        if min_price is not None:
            query = query.where(Listing.price >= min_price)
        
        if max_price is not None:
            query = query.where(Listing.price <= max_price)
        
        if search:
            search_filter = or_(
                Listing.title.ilike(f"%{search}%"),
                Listing.description.ilike(f"%{search}%")
            )
            query = query.where(search_filter)
        
        # Count total
        count_query = select(func.count()).select_from(query.subquery())
        total = (await self.db.execute(count_query)).scalar() or 0
        
        # Order: boosted first, then by bump time
        query = query.order_by(
            desc(Listing.is_boosted),
            desc(Listing.bumped_at)
        )
        
        # Pagination
        offset = (page - 1) * per_page
        query = query.offset(offset).limit(per_page)
        
        result = await self.db.execute(query)
        listings = result.scalars().all()
        
        return listings, total
    
    async def get_user_listings(
        self,
        user_id: int,
        include_archived: bool = False
    ) -> List[Listing]:
        """Get all listings by a user"""
        query = (
            select(Listing)
            .options(selectinload(Listing.images))
            .where(Listing.owner_id == user_id)
        )
        
        if not include_archived:
            query = query.where(
                Listing.status.in_([ListingStatus.ACTIVE, ListingStatus.SOLD])
            )
        
        query = query.order_by(desc(Listing.created_at))
        
        result = await self.db.execute(query)
        return result.scalars().all()
    
    async def boost_listing(
        self,
        listing_id: int,
        owner_id: int,
        duration_hours: int,
        boost_level: int = 1
    ) -> Optional[Listing]:
        """
        Boost a listing to appear at top of feed.
        
        Called after payment is confirmed.
        """
        listing = await self.get_by_id(listing_id)
        
        if not listing or listing.owner_id != owner_id:
            return None
        
        listing.is_boosted = True
        listing.boost_level = boost_level
        listing.boosted_until = datetime.utcnow() + timedelta(hours=duration_hours)
        listing.bumped_at = datetime.utcnow()  # Also bump to top
        
        return listing
    
    async def bump_listing(self, listing_id: int, owner_id: int) -> Optional[Listing]:
        """
        Bump listing to top of feed (paid feature).
        Simply updates bumped_at timestamp.
        """
        listing = await self.get_by_id(listing_id)
        
        if not listing or listing.owner_id != owner_id:
            return None
        
        listing.bumped_at = datetime.utcnow()
        
        return listing
    
    async def increment_views(self, listing_id: int):
        """Increment view counter"""
        await self.db.execute(
            select(Listing)
            .where(Listing.id == listing_id)
        )
        # Use raw SQL for atomic increment
        # In production, consider using Redis for high-frequency counters
        listing = await self.get_by_id(listing_id)
        if listing:
            listing.views_count += 1
