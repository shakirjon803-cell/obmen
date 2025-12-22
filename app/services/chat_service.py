"""
Chat service - handles conversations and messages.
"""
from datetime import datetime
from typing import List, Optional, Tuple
from sqlalchemy import select, or_, and_, desc, func
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.chat import Conversation, Message
from app.models.user import User
from app.models.listing import Listing
from app.schemas.chat import MessageCreate, ConversationResponse, ConversationParticipant


class ChatService:
    """
    Chat service for internal messaging.
    
    Features:
    - Start/get conversations
    - Send/receive messages
    - Mark as read
    - Unread counts
    """
    
    def __init__(self, db: AsyncSession):
        self.db = db
    
    async def get_or_create_conversation(
        self,
        user1_id: int,
        user2_id: int,
        listing_id: Optional[int] = None
    ) -> Conversation:
        """
        Get existing conversation or create new one.
        
        Enforces user1_id < user2_id for canonical ordering.
        """
        # Ensure canonical ordering
        if user1_id > user2_id:
            user1_id, user2_id = user2_id, user1_id
        
        # Try to find existing
        result = await self.db.execute(
            select(Conversation)
            .where(
                Conversation.user1_id == user1_id,
                Conversation.user2_id == user2_id
            )
        )
        conversation = result.scalar_one_or_none()
        
        if conversation:
            return conversation
        
        # Create new
        conversation = Conversation(
            user1_id=user1_id,
            user2_id=user2_id,
            listing_id=listing_id,
        )
        
        self.db.add(conversation)
        await self.db.flush()
        await self.db.refresh(conversation)
        
        return conversation
    
    async def get_user_conversations(self, user_id: int) -> List[Conversation]:
        """Get all conversations for a user, ordered by last message"""
        result = await self.db.execute(
            select(Conversation)
            .options(
                selectinload(Conversation.user1),
                selectinload(Conversation.user2),
                selectinload(Conversation.listing)
            )
            .where(
                or_(
                    Conversation.user1_id == user_id,
                    Conversation.user2_id == user_id
                )
            )
            .order_by(desc(Conversation.last_message_at))
        )
        return result.scalars().all()
    
    async def get_conversation_by_id(
        self,
        conversation_id: int,
        user_id: int
    ) -> Optional[Conversation]:
        """Get conversation if user is participant"""
        result = await self.db.execute(
            select(Conversation)
            .options(
                selectinload(Conversation.user1),
                selectinload(Conversation.user2),
                selectinload(Conversation.listing)
            )
            .where(
                Conversation.id == conversation_id,
                or_(
                    Conversation.user1_id == user_id,
                    Conversation.user2_id == user_id
                )
            )
        )
        return result.scalar_one_or_none()
    
    async def send_message(
        self,
        conversation_id: int,
        sender_id: int,
        data: MessageCreate
    ) -> Message:
        """Send a message in a conversation"""
        message = Message(
            conversation_id=conversation_id,
            sender_id=sender_id,
            content=data.content,
            image_url=data.image_url,
            message_type=data.message_type,
        )
        
        self.db.add(message)
        
        # Update conversation
        conversation = await self.get_conversation_by_id(conversation_id, sender_id)
        if conversation:
            conversation.last_message_text = (data.content or "[Image]")[:200]
            conversation.last_message_at = datetime.utcnow()
            conversation.last_sender_id = sender_id
            
            # Update unread count for recipient
            if conversation.user1_id == sender_id:
                conversation.unread_count_user2 += 1
            else:
                conversation.unread_count_user1 += 1
        
        await self.db.flush()
        await self.db.refresh(message)
        
        return message
    
    async def get_messages(
        self,
        conversation_id: int,
        user_id: int,
        limit: int = 50,
        before_id: Optional[int] = None
    ) -> List[Message]:
        """Get messages in a conversation with pagination"""
        # Verify user is participant
        conversation = await self.get_conversation_by_id(conversation_id, user_id)
        if not conversation:
            return []
        
        query = (
            select(Message)
            .options(selectinload(Message.sender))
            .where(
                Message.conversation_id == conversation_id,
                Message.is_deleted == False
            )
        )
        
        if before_id:
            query = query.where(Message.id < before_id)
        
        query = query.order_by(desc(Message.created_at)).limit(limit)
        
        result = await self.db.execute(query)
        messages = result.scalars().all()
        
        # Return in chronological order
        return list(reversed(messages))
    
    async def mark_as_read(self, conversation_id: int, user_id: int):
        """Mark all messages in conversation as read for user"""
        conversation = await self.get_conversation_by_id(conversation_id, user_id)
        if not conversation:
            return
        
        # Update unread messages
        await self.db.execute(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.is_read == False
            )
        )
        
        # Get and update messages
        result = await self.db.execute(
            select(Message)
            .where(
                Message.conversation_id == conversation_id,
                Message.sender_id != user_id,
                Message.is_read == False
            )
        )
        messages = result.scalars().all()
        
        now = datetime.utcnow()
        for msg in messages:
            msg.is_read = True
            msg.read_at = now
        
        # Reset unread counter
        if conversation.user1_id == user_id:
            conversation.unread_count_user1 = 0
        else:
            conversation.unread_count_user2 = 0
    
    async def get_total_unread(self, user_id: int) -> int:
        """Get total unread message count for user"""
        result = await self.db.execute(
            select(func.count())
            .select_from(Conversation)
            .where(
                or_(
                    and_(
                        Conversation.user1_id == user_id,
                        Conversation.unread_count_user1 > 0
                    ),
                    and_(
                        Conversation.user2_id == user_id,
                        Conversation.unread_count_user2 > 0
                    )
                )
            )
        )
        return result.scalar() or 0
    
    async def block_conversation(
        self,
        conversation_id: int,
        user_id: int,
        block: bool = True
    ) -> bool:
        """Block or unblock a conversation"""
        conversation = await self.get_conversation_by_id(conversation_id, user_id)
        if not conversation:
            return False
        
        conversation.is_blocked = block
        conversation.blocked_by = user_id if block else None
        
        return True
