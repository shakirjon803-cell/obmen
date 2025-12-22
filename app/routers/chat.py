"""
Chat router - conversations and messages.
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.user import User
from app.services.chat_service import ChatService
from app.schemas.chat import (
    MessageCreate, MessageResponse,
    ConversationResponse, ConversationDetailResponse,
    StartConversationRequest, ConversationParticipant
)

router = APIRouter()


@router.get("/conversations", response_model=List[ConversationResponse])
async def get_conversations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get all conversations for current user (inbox)"""
    service = ChatService(db)
    conversations = await service.get_user_conversations(current_user.id)
    
    result = []
    for conv in conversations:
        # Determine the other user
        other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
        unread = conv.get_unread_count(current_user.id)
        
        result.append(ConversationResponse(
            id=conv.id,
            other_user=ConversationParticipant(
                id=other_user.id,
                nickname=other_user.nickname,
                name=other_user.name,
                avatar_url=other_user.avatar_url,
                is_online=False,  # TODO: Implement online status
            ),
            listing_id=conv.listing_id,
            listing_title=conv.listing.title if conv.listing else None,
            last_message=conv.last_message_text,
            last_message_at=conv.last_message_at,
            unread_count=unread,
            is_blocked=conv.is_blocked,
        ))
    
    return result


@router.post("/conversations", response_model=ConversationResponse)
async def start_conversation(
    data: StartConversationRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Start a new conversation or get existing one"""
    if data.recipient_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Нельзя написать самому себе"
        )
    
    service = ChatService(db)
    
    # Get or create conversation
    conv = await service.get_or_create_conversation(
        user1_id=current_user.id,
        user2_id=data.recipient_id,
        listing_id=data.listing_id,
    )
    
    # Send initial message if provided
    if data.initial_message:
        await service.send_message(
            conversation_id=conv.id,
            sender_id=current_user.id,
            data=MessageCreate(content=data.initial_message),
        )
    
    # Reload with relationships
    conv = await service.get_conversation_by_id(conv.id, current_user.id)
    other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
    
    return ConversationResponse(
        id=conv.id,
        other_user=ConversationParticipant(
            id=other_user.id,
            nickname=other_user.nickname,
            name=other_user.name,
            avatar_url=other_user.avatar_url,
            is_online=False,
        ),
        listing_id=conv.listing_id,
        listing_title=conv.listing.title if conv.listing else None,
        last_message=conv.last_message_text,
        last_message_at=conv.last_message_at,
        unread_count=0,
        is_blocked=conv.is_blocked,
    )


@router.get("/conversations/{conversation_id}", response_model=ConversationDetailResponse)
async def get_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get conversation with messages"""
    service = ChatService(db)
    
    conv = await service.get_conversation_by_id(conversation_id, current_user.id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Диалог не найден"
        )
    
    # Get messages
    messages = await service.get_messages(conversation_id, current_user.id)
    
    # Mark as read
    await service.mark_as_read(conversation_id, current_user.id)
    
    other_user = conv.user2 if conv.user1_id == current_user.id else conv.user1
    
    return ConversationDetailResponse(
        id=conv.id,
        other_user=ConversationParticipant(
            id=other_user.id,
            nickname=other_user.nickname,
            name=other_user.name,
            avatar_url=other_user.avatar_url,
            is_online=False,
        ),
        listing_id=conv.listing_id,
        listing_title=conv.listing.title if conv.listing else None,
        messages=[
            MessageResponse(
                id=msg.id,
                sender_id=msg.sender_id,
                sender_name=msg.sender.name if msg.sender else None,
                sender_avatar=msg.sender.avatar_url if msg.sender else None,
                content=msg.content,
                image_url=msg.image_url,
                message_type=msg.message_type,
                is_read=msg.is_read,
                created_at=msg.created_at,
            )
            for msg in messages
        ],
        is_blocked=conv.is_blocked,
    )


@router.post("/conversations/{conversation_id}/messages", response_model=MessageResponse)
async def send_message(
    conversation_id: int,
    data: MessageCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Send a message in a conversation"""
    service = ChatService(db)
    
    # Verify access
    conv = await service.get_conversation_by_id(conversation_id, current_user.id)
    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Диалог не найден"
        )
    
    if conv.is_blocked:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Диалог заблокирован"
        )
    
    message = await service.send_message(
        conversation_id=conversation_id,
        sender_id=current_user.id,
        data=data,
    )
    
    return MessageResponse(
        id=message.id,
        sender_id=message.sender_id,
        sender_name=current_user.name,
        sender_avatar=current_user.avatar_url,
        content=message.content,
        image_url=message.image_url,
        message_type=message.message_type,
        is_read=False,
        created_at=message.created_at,
    )


@router.post("/conversations/{conversation_id}/read")
async def mark_as_read(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Mark all messages in conversation as read"""
    service = ChatService(db)
    await service.mark_as_read(conversation_id, current_user.id)
    return {"status": "ok"}


@router.get("/unread")
async def get_unread_count(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Get total unread message count"""
    service = ChatService(db)
    count = await service.get_total_unread(current_user.id)
    return {"unread_count": count}


@router.post("/conversations/{conversation_id}/block")
async def block_conversation(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Block a conversation"""
    service = ChatService(db)
    success = await service.block_conversation(conversation_id, current_user.id, block=True)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Диалог не найден"
        )
    
    return {"status": "ok"}
