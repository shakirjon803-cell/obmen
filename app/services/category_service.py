"""
Category service - handles category tree and attributes.
"""
from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.category import Category, CategoryAttribute
from app.schemas.category import (
    CategoryResponse,
    CategoryWithAttributes,
    CategoryTreeNode,
    CategoryAttributeResponse
)


class CategoryService:
    """
    Category service for dynamic category system.
    
    Features:
    - Category tree with nesting
    - Dynamic attributes per category
    - Localization support
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_tree(self, lang: str = "ru") -> List[CategoryTreeNode]:
        """
        Get full category tree with nesting.
        
        Returns hierarchical structure for menu/sidebar.
        """
        # Get all active categories
        result = await self.db.execute(
            select(Category)
            .where(Category.is_active == True)
            .order_by(Category.level, Category.sort_order)
        )
        categories = result.scalars().all()
        
        # Build tree
        category_map = {}
        roots = []
        
        for cat in categories:
            node = CategoryTreeNode(
                id=cat.id,
                name=cat.get_name(lang),
                slug=cat.slug,
                icon=cat.icon,
                level=cat.level,
                is_featured=cat.is_featured,
                children=[]
            )
            category_map[cat.id] = node
            
            if cat.parent_id is None:
                roots.append(node)
            elif cat.parent_id in category_map:
                category_map[cat.parent_id].children.append(node)
        
        return roots
    
    async def get_by_id(self, category_id: int, lang: str = "ru") -> Optional[CategoryWithAttributes]:
        """
        Get single category with its attributes.
        
        Used for CreatePost form to show required fields.
        """
        result = await self.db.execute(
            select(Category)
            .options(selectinload(Category.attributes))
            .where(Category.id == category_id, Category.is_active == True)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            return None
        
        # Build response with localized labels
        attributes = []
        for attr in sorted(category.attributes, key=lambda a: a.sort_order):
            attributes.append(CategoryAttributeResponse(
                id=attr.id,
                name=attr.name,
                label=attr.get_label(lang),
                type=attr.type,
                options=attr.options,
                is_required=attr.is_required,
                is_filterable=attr.is_filterable,
                placeholder=attr.placeholder,
                default_value=attr.default_value,
                min_value=attr.min_value,
                max_value=attr.max_value,
            ))
        
        return CategoryWithAttributes(
            id=category.id,
            name=category.get_name(lang),
            slug=category.slug,
            icon=category.icon,
            level=category.level,
            parent_id=category.parent_id,
            is_featured=category.is_featured,
            is_paid=category.is_paid,
            post_price=category.post_price,
            attributes=attributes,
            description=category.description_ru if lang == "ru" else 
                       (category.description_uz if lang == "uz" else category.description_en)
        )
    
    async def get_by_slug(self, slug: str, lang: str = "ru") -> Optional[CategoryWithAttributes]:
        """Get category by slug"""
        result = await self.db.execute(
            select(Category)
            .options(selectinload(Category.attributes))
            .where(Category.slug == slug, Category.is_active == True)
        )
        category = result.scalar_one_or_none()
        
        if not category:
            return None
        
        return await self.get_by_id(category.id, lang)
    
    async def get_featured(self, lang: str = "ru") -> List[CategoryResponse]:
        """Get featured categories for homepage"""
        result = await self.db.execute(
            select(Category)
            .where(Category.is_active == True, Category.is_featured == True)
            .order_by(Category.sort_order)
        )
        categories = result.scalars().all()
        
        return [
            CategoryResponse(
                id=cat.id,
                name=cat.get_name(lang),
                slug=cat.slug,
                icon=cat.icon,
                level=cat.level,
                parent_id=cat.parent_id,
                is_featured=cat.is_featured,
                is_paid=cat.is_paid,
                post_price=cat.post_price,
            )
            for cat in categories
        ]
    
    async def get_children(self, parent_id: int, lang: str = "ru") -> List[CategoryResponse]:
        """Get child categories of a parent"""
        result = await self.db.execute(
            select(Category)
            .where(Category.parent_id == parent_id, Category.is_active == True)
            .order_by(Category.sort_order)
        )
        categories = result.scalars().all()
        
        return [
            CategoryResponse(
                id=cat.id,
                name=cat.get_name(lang),
                slug=cat.slug,
                icon=cat.icon,
                level=cat.level,
                parent_id=cat.parent_id,
                is_featured=cat.is_featured,
                is_paid=cat.is_paid,
                post_price=cat.post_price,
            )
            for cat in categories
        ]
    
    async def get_breadcrumbs(self, category_id: int, lang: str = "ru") -> List[CategoryResponse]:
        """Get category path from root to current (for breadcrumbs)"""
        breadcrumbs = []
        current_id = category_id
        
        while current_id:
            result = await self.db.execute(
                select(Category).where(Category.id == current_id)
            )
            cat = result.scalar_one_or_none()
            
            if not cat:
                break
            
            breadcrumbs.insert(0, CategoryResponse(
                id=cat.id,
                name=cat.get_name(lang),
                slug=cat.slug,
                icon=cat.icon,
                level=cat.level,
                parent_id=cat.parent_id,
                is_featured=cat.is_featured,
                is_paid=cat.is_paid,
                post_price=cat.post_price,
            ))
            
            current_id = cat.parent_id
        
        return breadcrumbs
