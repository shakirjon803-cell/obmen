"""
Async SQLAlchemy database configuration for PostgreSQL.
Replaces the old aiosqlite connection from bot/database/database.py
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base
from app.config import settings
import logging

logger = logging.getLogger(__name__)

# Create async engine with connection pooling for high-load (10k-15k users)
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,  # Log SQL queries in debug mode
    pool_size=20,         # Maintain 20 connections in pool
    max_overflow=10,      # Allow 10 extra connections during peak
    pool_pre_ping=True,   # Verify connections before use
)

# Session factory - creates new sessions for each request
AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autoflush=False,
)

# Base class for all ORM models
Base = declarative_base()


async def get_db():
    """
    FastAPI dependency for database sessions.
    
    Usage in routes:
        @router.get("/items")
        async def get_items(db: AsyncSession = Depends(get_db)):
            result = await db.execute(select(Item))
            return result.scalars().all()
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception as e:
            await session.rollback()
            logger.error(f"Database error: {e}")
            raise
        finally:
            await session.close()


async def init_db():
    """
    Create all tables on application startup.
    Should be called in FastAPI lifespan.
    """
    async with engine.begin() as conn:
        # Import all models so they're registered with Base
        from app.models import user, category, listing, chat, monetization  # noqa
        await conn.run_sync(Base.metadata.create_all)
        logger.info("✅ Database tables created successfully")


async def close_db():
    """Close database connections on shutdown"""
    await engine.dispose()
    logger.info("👋 Database connections closed")
