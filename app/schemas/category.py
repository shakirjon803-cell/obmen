"""
Category Pydantic schemas with attribute definitions.
"""
from pydantic import BaseModel
from typing import Optional, List, Any


class CategoryAttributeResponse(BaseModel):
    """Single attribute definition for a category"""
    id: int
    name: str
    label: str  # Localized label (set by service based on user's language)
    type: str  # text, number, date, select, boolean
    options: Optional[List[str]] = None  # For 'select' type
    is_required: bool
    is_filterable: bool
    placeholder: Optional[str] = None
    default_value: Optional[str] = None
    min_value: Optional[int] = None
    max_value: Optional[int] = None
    
    class Config:
        from_attributes = True


class CategoryResponse(BaseModel):
    """Single category"""
    id: int
    name: str  # Localized name
    slug: str
    icon: Optional[str] = None
    level: int
    parent_id: Optional[int] = None
    is_featured: bool = False
    is_paid: bool = False
    post_price: int = 0
    
    class Config:
        from_attributes = True


class CategoryWithAttributes(CategoryResponse):
    """Category with its attribute definitions - for CreatePost form"""
    attributes: List[CategoryAttributeResponse] = []
    description: Optional[str] = None


class CategoryTreeNode(BaseModel):
    """Category with nested children for tree display"""
    id: int
    name: str
    slug: str
    icon: Optional[str] = None
    level: int
    is_featured: bool = False
    children: List["CategoryTreeNode"] = []
    
    class Config:
        from_attributes = True


class CategoryTreeResponse(BaseModel):
    """Full category tree"""
    categories: List[CategoryTreeNode]


# Rebuild for self-reference
CategoryTreeNode.model_rebuild()
