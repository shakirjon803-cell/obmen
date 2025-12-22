"""
NellX Marketplace API v2.0

FastAPI application with:
- PostgreSQL + async SQLAlchemy
- JWT authentication
- Real-time WebSocket chat
- Image upload with thumbnails
- Monetization (boost, VIP)
"""
from contextlib import asynccontextmanager
from pathlib import Path
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.database import init_db, close_db
from app.routers import auth, users, listings, categories, chat, monetization

# Configure logging
logging.basicConfig(
    level=logging.INFO if settings.DEBUG else logging.WARNING,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan events.
    
    Startup: Initialize database tables
    Shutdown: Close database connections
    """
    logger.info("🚀 Starting NellX Marketplace API v2.0...")
    
    # Create upload directory
    Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
    
    # Initialize database
    await init_db()
    logger.info("✅ Database initialized")
    
    yield
    
    # Cleanup
    await close_db()
    logger.info("👋 NellX API shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="NellX Marketplace API",
    version="2.0.0",
    description="P2P Exchange + Goods & Services Marketplace",
    lifespan=lifespan,
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
)

# CORS middleware for Telegram Mini App & Android WebView
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify allowed origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static files for uploaded images
uploads_path = Path(settings.UPLOAD_DIR)
if uploads_path.exists():
    app.mount("/uploads", StaticFiles(directory=str(uploads_path)), name="uploads")

# API Routers
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(listings.router, prefix="/api/listings", tags=["Listings"])
app.include_router(categories.router, prefix="/api/categories", tags=["Categories"])
app.include_router(chat.router, prefix="/api/chat", tags=["Chat"])
app.include_router(monetization.router, prefix="/api/monetization", tags=["Monetization"])


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring"""
    return {
        "status": "ok",
        "version": "2.0.0",
        "app": settings.APP_NAME,
    }


@app.get("/")
async def root():
    """Root endpoint - API info"""
    return {
        "name": settings.APP_NAME,
        "version": "2.0.0",
        "docs": "/docs" if settings.DEBUG else None,
    }


# WebSocket endpoint for real-time chat
from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Set
import json

# Active WebSocket connections by user_id
active_connections: Dict[int, Set[WebSocket]] = {}


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: int):
    """
    WebSocket endpoint for real-time messaging.
    
    Client should connect after authentication.
    Supports:
    - New message notifications
    - Typing indicators
    - Read receipts
    - Online status
    """
    await websocket.accept()
    
    # Add to active connections
    if user_id not in active_connections:
        active_connections[user_id] = set()
    active_connections[user_id].add(websocket)
    
    logger.info(f"WebSocket connected: user_id={user_id}")
    
    try:
        while True:
            # Receive message from client
            data = await websocket.receive_text()
            message = json.loads(data)
            
            msg_type = message.get("type")
            
            if msg_type == "typing":
                # Broadcast typing indicator to conversation participants
                conversation_id = message.get("conversation_id")
                # TODO: Get other participant and send typing event
                pass
            
            elif msg_type == "read":
                # Mark messages as read
                conversation_id = message.get("conversation_id")
                # TODO: Update read status and notify sender
                pass
            
    except WebSocketDisconnect:
        active_connections[user_id].discard(websocket)
        if not active_connections[user_id]:
            del active_connections[user_id]
        logger.info(f"WebSocket disconnected: user_id={user_id}")


async def send_to_user(user_id: int, message: dict):
    """Send message to all connections of a user"""
    if user_id in active_connections:
        data = json.dumps(message)
        dead_connections = set()
        
        for ws in active_connections[user_id]:
            try:
                await ws.send_text(data)
            except:
                dead_connections.add(ws)
        
        # Clean up dead connections
        active_connections[user_id] -= dead_connections


# Export for use in services
def get_ws_manager():
    return {
        "send_to_user": send_to_user,
        "active_connections": active_connections,
    }
