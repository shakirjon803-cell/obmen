"""
File upload service - handles image uploads to local disk or S3.
Replaces base64 image_data storage with proper file management.
"""
import os
import uuid
import logging
from pathlib import Path
from typing import Optional
from fastapi import UploadFile
from PIL import Image
import aiofiles

from app.config import settings

logger = logging.getLogger(__name__)


class FileService:
    """
    File upload service supporting local disk and S3/MinIO storage.
    
    Key features:
    - Automatic thumbnail generation (300px)
    - Image optimization (WebP conversion)
    - Unique filename generation
    - Extension validation
    """
    
    ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "webp", "gif"}
    MAX_SIZE_BYTES = settings.MAX_IMAGE_SIZE_MB * 1024 * 1024
    THUMBNAIL_SIZE = (300, 300)
    
    def __init__(self):
        self.storage_type = settings.STORAGE_TYPE
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.base_url = settings.BASE_URL
    
    async def save_image(
        self,
        file: UploadFile,
        folder: str = "listings",
        generate_thumbnail: bool = True
    ) -> dict:
        """
        Save uploaded image and return URLs.
        
        Args:
            file: Uploaded file from FastAPI
            folder: Subfolder (e.g., 'listings', 'avatars')
            generate_thumbnail: Whether to create thumbnail
        
        Returns:
            {
                "url": "http://localhost:8080/uploads/listings/abc123.webp",
                "thumbnail_url": "http://localhost:8080/uploads/listings/thumb_abc123.webp",
                "filename": "abc123.webp",
                "size": 12345,
                "width": 800,
                "height": 600
            }
        """
        # Validate extension
        ext = self._get_extension(file.filename)
        if ext not in self.ALLOWED_EXTENSIONS:
            raise ValueError(f"Invalid file type. Allowed: {', '.join(self.ALLOWED_EXTENSIONS)}")
        
        # Read file content
        content = await file.read()
        
        # Validate size
        if len(content) > self.MAX_SIZE_BYTES:
            raise ValueError(f"File too large. Max size: {settings.MAX_IMAGE_SIZE_MB}MB")
        
        # Generate unique filename
        filename = f"{uuid.uuid4()}.webp"
        
        if self.storage_type == "local":
            return await self._save_local(content, folder, filename, generate_thumbnail)
        else:
            return await self._save_s3(content, folder, filename, generate_thumbnail)
    
    async def _save_local(
        self,
        content: bytes,
        folder: str,
        filename: str,
        generate_thumbnail: bool
    ) -> dict:
        """Save to local filesystem"""
        folder_path = self.upload_dir / folder
        folder_path.mkdir(parents=True, exist_ok=True)
        
        file_path = folder_path / filename
        
        # Process image with Pillow
        from io import BytesIO
        img = Image.open(BytesIO(content))
        
        # Convert to RGB if necessary (for WebP)
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if 'A' in img.mode else None)
            img = background
        elif img.mode != 'RGB':
            img = img.convert('RGB')
        
        width, height = img.size
        
        # Save optimized image
        img.save(file_path, "WEBP", quality=85, optimize=True)
        file_size = file_path.stat().st_size
        
        result = {
            "url": f"{self.base_url}/uploads/{folder}/{filename}",
            "filename": filename,
            "size": file_size,
            "width": width,
            "height": height,
        }
        
        # Generate thumbnail
        if generate_thumbnail:
            thumb_filename = f"thumb_{filename}"
            thumb_path = folder_path / thumb_filename
            
            thumb_img = img.copy()
            thumb_img.thumbnail(self.THUMBNAIL_SIZE, Image.Resampling.LANCZOS)
            thumb_img.save(thumb_path, "WEBP", quality=80, optimize=True)
            
            result["thumbnail_url"] = f"{self.base_url}/uploads/{folder}/{thumb_filename}"
        
        logger.info(f"Saved image: {file_path}")
        return result
    
    async def _save_s3(
        self,
        content: bytes,
        folder: str,
        filename: str,
        generate_thumbnail: bool
    ) -> dict:
        """
        Save to S3/MinIO storage.
        Placeholder for future implementation.
        """
        # TODO: Implement S3 upload
        # import boto3
        # s3 = boto3.client(
        #     's3',
        #     endpoint_url=settings.S3_ENDPOINT,
        #     aws_access_key_id=settings.S3_ACCESS_KEY,
        #     aws_secret_access_key=settings.S3_SECRET_KEY
        # )
        raise NotImplementedError("S3 storage not yet implemented. Set STORAGE_TYPE=local")
    
    async def delete_image(self, url: str) -> bool:
        """Delete an image by its URL"""
        if self.storage_type == "local":
            # Extract path from URL
            path = url.replace(f"{self.base_url}/", "")
            file_path = Path(path)
            
            if file_path.exists():
                file_path.unlink()
                logger.info(f"Deleted image: {file_path}")
                
                # Also delete thumbnail
                thumb_path = file_path.parent / f"thumb_{file_path.name}"
                if thumb_path.exists():
                    thumb_path.unlink()
                
                return True
        return False
    
    @staticmethod
    def _get_extension(filename: str) -> str:
        """Get lowercase file extension"""
        if not filename or "." not in filename:
            return ""
        return filename.rsplit(".", 1)[-1].lower()


# Singleton instance
file_service = FileService()
