"""
Database seeder - populate initial categories and attributes.
Run this after database initialization.

Usage:
    python -m app.seed
"""
import asyncio
import logging
from app.database import AsyncSessionLocal, init_db
from app.models.category import Category, CategoryAttribute

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Initial categories with attributes
CATEGORIES = [
    # === P2P Exchange (Legacy) ===
    {
        "name_ru": "Обмен валюты",
        "name_uz": "Valyuta ayirboshlash",
        "name_en": "Currency Exchange",
        "slug": "exchange",
        "icon": "💱",
        "is_featured": True,
        "attributes": [
            {"name": "direction", "label_ru": "Направление", "type": "select", "options": ["Покупка", "Продажа"], "is_required": True},
        ]
    },
    
    # === Electronics ===
    {
        "name_ru": "Электроника",
        "name_uz": "Elektronika",
        "name_en": "Electronics",
        "slug": "electronics",
        "icon": "📱",
        "is_featured": True,
        "children": [
            {
                "name_ru": "Телефоны",
                "slug": "phones",
                "icon": "📱",
                "attributes": [
                    {"name": "brand", "label_ru": "Бренд", "type": "select", "options": ["Apple", "Samsung", "Xiaomi", "Huawei", "Other"], "is_required": True, "is_filterable": True},
                    {"name": "storage", "label_ru": "Память", "type": "select", "options": ["32GB", "64GB", "128GB", "256GB", "512GB", "1TB"], "is_filterable": True},
                    {"name": "condition", "label_ru": "Состояние", "type": "select", "options": ["Новый", "Б/у", "На запчасти"], "is_required": True},
                ]
            },
            {
                "name_ru": "Ноутбуки",
                "slug": "laptops",
                "icon": "💻",
                "attributes": [
                    {"name": "brand", "label_ru": "Бренд", "type": "select", "options": ["Apple", "Dell", "HP", "Lenovo", "Asus", "Acer", "Other"], "is_required": True},
                    {"name": "ram", "label_ru": "RAM", "type": "select", "options": ["4GB", "8GB", "16GB", "32GB", "64GB"]},
                    {"name": "condition", "label_ru": "Состояние", "type": "select", "options": ["Новый", "Б/у", "На запчасти"], "is_required": True},
                ]
            },
            {
                "name_ru": "Планшеты",
                "slug": "tablets",
                "icon": "📲",
            },
            {
                "name_ru": "Аксессуары",
                "slug": "accessories",
                "icon": "🎧",
            },
        ]
    },
    
    # === Home & Living ===
    {
        "name_ru": "Дом и сад",
        "name_uz": "Uy va bog'",
        "name_en": "Home & Garden",
        "slug": "home",
        "icon": "🏠",
        "is_featured": True,
        "children": [
            {
                "name_ru": "Мебель",
                "slug": "furniture",
                "icon": "🛋️",
                "children": [
                    {"name_ru": "Столы", "slug": "tables", "icon": "🪑"},
                    {"name_ru": "Стулья", "slug": "chairs", "icon": "🪑"},
                    {"name_ru": "Диваны", "slug": "sofas", "icon": "🛋️"},
                    {"name_ru": "Шкафы", "slug": "cabinets", "icon": "🗄️"},
                ]
            },
            {
                "name_ru": "Бытовая техника",
                "slug": "appliances",
                "icon": "🔌",
            },
            {
                "name_ru": "Ремонт и строительство",
                "slug": "construction",
                "icon": "🔧",
            },
        ]
    },
    
    # === Food ===
    {
        "name_ru": "Еда и напитки",
        "name_uz": "Oziq-ovqat",
        "name_en": "Food & Drinks",
        "slug": "food",
        "icon": "🍔",
        "is_featured": True,
        "attributes": [
            {"name": "expiry_date", "label_ru": "Срок годности", "type": "date"},
            {"name": "halal", "label_ru": "Халяль", "type": "boolean"},
        ],
        "children": [
            {"name_ru": "Домашняя еда", "slug": "homemade", "icon": "🍲"},
            {"name_ru": "Продукты", "slug": "groceries", "icon": "🥬"},
            {"name_ru": "Сладости", "slug": "sweets", "icon": "🍰"},
        ]
    },
    
    # === Clothes ===
    {
        "name_ru": "Одежда и обувь",
        "name_uz": "Kiyim-kechak",
        "name_en": "Clothing",
        "slug": "clothing",
        "icon": "👕",
        "is_featured": True,
        "attributes": [
            {"name": "size", "label_ru": "Размер", "type": "select", "options": ["XS", "S", "M", "L", "XL", "XXL", "XXXL"], "is_filterable": True},
            {"name": "gender", "label_ru": "Пол", "type": "select", "options": ["Мужской", "Женский", "Унисекс"], "is_filterable": True},
            {"name": "condition", "label_ru": "Состояние", "type": "select", "options": ["Новое", "Б/у"]},
        ],
        "children": [
            {"name_ru": "Мужская одежда", "slug": "mens-clothing", "icon": "👔"},
            {"name_ru": "Женская одежда", "slug": "womens-clothing", "icon": "👗"},
            {"name_ru": "Детская одежда", "slug": "kids-clothing", "icon": "🧒"},
            {"name_ru": "Обувь", "slug": "shoes", "icon": "👟"},
        ]
    },
    
    # === Services ===
    {
        "name_ru": "Услуги",
        "name_uz": "Xizmatlar",
        "name_en": "Services",
        "slug": "services",
        "icon": "🛠️",
        "is_featured": True,
        "children": [
            {"name_ru": "Ремонт техники", "slug": "tech-repair", "icon": "🔧"},
            {"name_ru": "Ремонт авто", "slug": "auto-repair", "icon": "🚗"},
            {"name_ru": "Уборка", "slug": "cleaning", "icon": "🧹"},
            {"name_ru": "Красота", "slug": "beauty", "icon": "💅"},
            {"name_ru": "Репетиторы", "slug": "tutoring", "icon": "📚"},
            {"name_ru": "Грузоперевозки", "slug": "moving", "icon": "🚚"},
        ]
    },
    
    # === Transport ===
    {
        "name_ru": "Транспорт",
        "name_uz": "Transport",
        "name_en": "Transport",
        "slug": "transport",
        "icon": "🚗",
        "is_featured": True,
        "children": [
            {
                "name_ru": "Автомобили",
                "slug": "cars",
                "icon": "🚗",
                "attributes": [
                    {"name": "brand", "label_ru": "Марка", "type": "text", "is_required": True},
                    {"name": "year", "label_ru": "Год выпуска", "type": "number", "min_value": 1990, "max_value": 2025},
                    {"name": "mileage", "label_ru": "Пробег (км)", "type": "number"},
                    {"name": "transmission", "label_ru": "КПП", "type": "select", "options": ["Механика", "Автомат"]},
                ]
            },
            {"name_ru": "Мотоциклы", "slug": "motorcycles", "icon": "🏍️"},
            {"name_ru": "Велосипеды", "slug": "bicycles", "icon": "🚲"},
            {"name_ru": "Запчасти", "slug": "spare-parts", "icon": "⚙️"},
        ]
    },
    
    # === Other ===
    {
        "name_ru": "Другое",
        "name_uz": "Boshqa",
        "name_en": "Other",
        "slug": "other",
        "icon": "📦",
    },
]


async def create_category_tree(session, categories: list, parent_id: int = None, level: int = 0):
    """Recursively create categories with attributes"""
    for idx, cat_data in enumerate(categories):
        children = cat_data.pop("children", [])
        attributes = cat_data.pop("attributes", [])
        
        # Create category
        category = Category(
            parent_id=parent_id,
            level=level,
            sort_order=idx,
            **cat_data
        )
        session.add(category)
        await session.flush()
        
        logger.info(f"Created category: {category.name_ru} (level={level})")
        
        # Create attributes
        for attr_idx, attr_data in enumerate(attributes):
            attr = CategoryAttribute(
                category_id=category.id,
                sort_order=attr_idx,
                **attr_data
            )
            session.add(attr)
        
        # Recursively create children
        if children:
            await create_category_tree(session, children, category.id, level + 1)


async def seed_database():
    """Main seeding function"""
    logger.info("🌱 Starting database seeding...")
    
    # Initialize DB first
    await init_db()
    
    async with AsyncSessionLocal() as session:
        # Check if already seeded
        from sqlalchemy import select, func
        result = await session.execute(select(func.count()).select_from(Category))
        count = result.scalar()
        
        if count > 0:
            logger.warning(f"⚠️ Database already has {count} categories. Skipping seed.")
            return
        
        # Create categories
        await create_category_tree(session, CATEGORIES)
        
        await session.commit()
        logger.info("✅ Database seeding complete!")


if __name__ == "__main__":
    asyncio.run(seed_database())
