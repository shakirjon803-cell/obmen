"""
Category and CategoryAttribute models - EAV pattern for dynamic attributes.

EAV (Entity-Attribute-Value) pattern allows:
- Adding new attributes without schema changes
- Different attributes per category (Food -> expiry_date, Clothes -> size)
- Filterable search attributes
"""
from sqlalchemy import Column, Integer, String, ForeignKey, Boolean, JSON, Text
from sqlalchemy.orm import relationship
from app.database import Base


class Category(Base):
    """
    Hierarchical category tree supporting deep nesting.
    
    Example hierarchy:
    - Home (level=0)
      - Furniture (level=1)
        - Tables (level=2)
        - Chairs (level=2)
      - Electronics (level=1)
    
    Design decisions:
    - Multi-language support via name_ru/name_uz/name_en columns
    - slug for SEO-friendly URLs
    - icon for UI display (emoji or icon name)
    - sort_order for custom ordering in UI
    """
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    
    # === Names (multi-language) ===
    name_ru = Column(String(100), nullable=False)
    name_uz = Column(String(100))
    name_en = Column(String(100))
    
    # === URL & Display ===
    slug = Column(String(100), unique=True, index=True)  # e.g., "home-furniture-tables"
    icon = Column(String(50))  # e.g., "🍔" or "chair-icon"
    description_ru = Column(Text)
    description_uz = Column(Text)
    description_en = Column(Text)
    
    # === Hierarchy ===
    parent_id = Column(Integer, ForeignKey("categories.id"), nullable=True, index=True)
    level = Column(Integer, default=0)  # 0 = root, 1 = child, 2 = grandchild, etc.
    sort_order = Column(Integer, default=0)
    
    # === Status ===
    is_active = Column(Boolean, default=True)
    is_featured = Column(Boolean, default=False)  # Show on main page
    
    # === Monetization ===
    is_paid = Column(Boolean, default=False)  # Requires payment to post
    post_price = Column(Integer, default=0)  # Price to post in this category
    
    # === Relationships ===
    parent = relationship("Category", remote_side=[id], backref="children")
    attributes = relationship("CategoryAttribute", back_populates="category", lazy="selectin")
    listings = relationship("Listing", back_populates="category", lazy="dynamic")

    def __repr__(self):
        return f"<Category {self.name_ru} (id={self.id})>"
    
    def get_name(self, lang: str = "ru") -> str:
        """Get localized category name"""
        if lang == "uz" and self.name_uz:
            return self.name_uz
        if lang == "en" and self.name_en:
            return self.name_en
        return self.name_ru


class CategoryAttribute(Base):
    """
    Defines what attributes a category requires/supports.
    
    Example for "Food" category:
    - name="expiry_date", type="date", is_required=True
    - name="brand", type="text", is_required=False
    
    Example for "Clothes" category:
    - name="size", type="select", options=["XS","S","M","L","XL","XXL"]
    - name="color", type="select", options=["red","blue","black"]
    
    Attribute types:
    - text: Free text input
    - number: Numeric input
    - date: Date picker
    - select: Dropdown from predefined options
    - boolean: Checkbox (yes/no)
    """
    __tablename__ = "category_attributes"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # === Attribute Definition ===
    name = Column(String(50), nullable=False)  # Internal name: "size", "expiry_date"
    
    # === Labels (multi-language) ===
    label_ru = Column(String(100))  # Display label: "Размер"
    label_uz = Column(String(100))  # "O'lcham"
    label_en = Column(String(100))  # "Size"
    
    # === Configuration ===
    type = Column(String(20), nullable=False)  # text, number, date, select, boolean
    options = Column(JSON, nullable=True)  # For 'select': ["S", "M", "L", "XL"]
    default_value = Column(String(200))  # Default value if any
    placeholder = Column(String(200))  # Input placeholder text
    
    # === Validation ===
    is_required = Column(Boolean, default=False)
    min_value = Column(Integer)  # For number type
    max_value = Column(Integer)  # For number type
    
    # === UI ===
    is_filterable = Column(Boolean, default=True)  # Show in search filters
    is_visible_in_list = Column(Boolean, default=True)  # Show in listing cards
    sort_order = Column(Integer, default=0)
    
    # === Relationship ===
    category = relationship("Category", back_populates="attributes")

    def __repr__(self):
        return f"<CategoryAttribute {self.name} (category_id={self.category_id})>"
    
    def get_label(self, lang: str = "ru") -> str:
        """Get localized attribute label"""
        if lang == "uz" and self.label_uz:
            return self.label_uz
        if lang == "en" and self.label_en:
            return self.label_en
        return self.label_ru or self.name
