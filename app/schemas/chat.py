"""
Chat Pydantic schemas for messaging.
"""
from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime


class MessageCreate(BaseModel):
    """Create a new message"""
    content: Optional[str] = Field(None, max_length=4000)
    image_url: Optional[str] = None
    message_type: str = "text"  # text, image, system


class MessageResponse(BaseModel):
    """Single message response"""
    id: int
    sender_id: int
    sender_name: Optional[str] = None
    sender_avatar: Optional[str] = None
    content: Optional[str] = None
    image_url: Optional[str] = None
    message_type: str
    is_read: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class ConversationParticipant(BaseModel):
    """Participant info in conversation"""
    id: int
    nickname: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    is_online: bool = False
    
    class Config:
        from_attributes = True


class ConversationResponse(BaseModel):
    """Conversation for inbox list"""
    id: int
    other_user: ConversationParticipant
    listing_id: Optional[int] = None
    listing_title: Optional[str] = None  # For context
    last_message: Optional[str] = None
    last_message_at: datetime
    unread_count: int
    is_blocked: bool = False
    
    class Config:
        from_attributes = True


class ConversationDetailResponse(BaseModel):
    """Full conversation with messages"""
    id: int
    other_user: ConversationParticipant
    listing_id: Optional[int] = None
    listing_title: Optional[str] = None
    messages: List[MessageResponse] = []
    is_blocked: bool = False
    
    class Config:
        from_attributes = True


class StartConversationRequest(BaseModel):
    """Start a new conversation"""
    recipient_id: int
    listing_id: Optional[int] = None  # Optional: if asking about a listing
    initial_message: Optional[str] = None


class WebSocketMessage(BaseModel):
    """WebSocket message format"""
    type: str  # 'message', 'typing', 'read', 'online'
    conversation_id: Optional[int] = None
    data: dict = {}
