"""
Application configuration using pydantic-settings.
Environment variables are loaded from .env file.
"""
from pydantic_settings import BaseSettings
from functools import lru_cache
import os


class Settings(BaseSettings):
    """
    Application settings loaded from environment variables.
    All sensitive data should be in .env file.
    """
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:password@localhost:5432/nellx"
    
    # Application
    APP_NAME: str = "NellX Marketplace"
    DEBUG: bool = True
    SECRET_KEY: str = "your-secret-key-change-in-production"
    
    # File Storage
    STORAGE_TYPE: str = "local"  # "local" or "s3"
    UPLOAD_DIR: str = "uploads"
    MAX_IMAGE_SIZE_MB: int = 10
    
    # S3/MinIO (optional)
    S3_ENDPOINT: str = ""
    S3_BUCKET: str = "nellx-uploads"
    S3_ACCESS_KEY: str = ""
    S3_SECRET_KEY: str = ""
    
    # Base URL for generating image URLs
    BASE_URL: str = "http://localhost:8080"
    
    # Telegram Bot Token (for notifications)
    BOT_TOKEN: str = ""
    
    # JWT Settings
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days
    
    class Config:
        env_file = ".env"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    """Cached settings instance"""
    return Settings()


settings = get_settings()
