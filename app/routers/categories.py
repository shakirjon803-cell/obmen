"""
Categories router - category tree and attributes.
"""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services.category_service import CategoryService
from app.schemas.category import CategoryResponse, CategoryWithAttributes, CategoryTreeNode

router = APIRouter()


@router.get("/tree", response_model=List[CategoryTreeNode])
async def get_category_tree(
    lang: str = Query("ru", regex="^(ru|uz|en)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get full category tree with nesting.
    
    Used for navigation menu and category selector.
    """
    service = CategoryService(db)
    tree = await service.get_tree(lang)
    return tree


@router.get("/featured", response_model=List[CategoryResponse])
async def get_featured_categories(
    lang: str = Query("ru", regex="^(ru|uz|en)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get featured categories for homepage"""
    service = CategoryService(db)
    return await service.get_featured(lang)


@router.get("/{category_id}", response_model=CategoryWithAttributes)
async def get_category(
    category_id: int,
    lang: str = Query("ru", regex="^(ru|uz|en)$"),
    db: AsyncSession = Depends(get_db)
):
    """
    Get single category with its attribute definitions.
    
    Used for CreatePost form to show required fields.
    """
    service = CategoryService(db)
    category = await service.get_by_id(category_id, lang)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )
    
    return category


@router.get("/slug/{slug}", response_model=CategoryWithAttributes)
async def get_category_by_slug(
    slug: str,
    lang: str = Query("ru", regex="^(ru|uz|en)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get category by slug"""
    service = CategoryService(db)
    category = await service.get_by_slug(slug, lang)
    
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Категория не найдена"
        )
    
    return category


@router.get("/{category_id}/children", response_model=List[CategoryResponse])
async def get_category_children(
    category_id: int,
    lang: str = Query("ru", regex="^(ru|uz|en)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get child categories of a parent"""
    service = CategoryService(db)
    return await service.get_children(category_id, lang)


@router.get("/{category_id}/breadcrumbs", response_model=List[CategoryResponse])
async def get_category_breadcrumbs(
    category_id: int,
    lang: str = Query("ru", regex="^(ru|uz|en)$"),
    db: AsyncSession = Depends(get_db)
):
    """Get category path from root to current (for breadcrumb navigation)"""
    service = CategoryService(db)
    return await service.get_breadcrumbs(category_id, lang)
