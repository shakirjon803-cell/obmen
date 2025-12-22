"""
Chat models for internal messaging system.

Replaces Telegram chat redirection with in-app messaging.
Supports real-time WebSocket communication.
"""
from sqlalchemy import Column, Integer, String, Text, ForeignKey, DateTime, Boolean, Index
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Conversation(Base):
    """
    Chat conversation between two users.
    
    Design decisions:
    - user1_id < user2_id always (canonical ordering) to prevent duplicates
    - Optional listing_id to link conversation to a specific product inquiry
    - last_message fields denormalized for fast inbox loading
    """
    __tablename__ = "conversations"

    id = Column(Integer, primary_key=True, index=True)
    
    # === Participants ===
    # Convention: user1_id < user2_id (enforced in service layer)
    user1_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    user2_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # === Context ===
    # Optional link to a listing (e.g., buyer asking about a product)
    listing_id = Column(Integer, ForeignKey("listings.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # === Denormalized for performance ===
    # Updated when new message is sent
    last_message_text = Column(String(200))  # Preview of last message
    last_message_at = Column(DateTime, server_default=func.now(), index=True)
    last_sender_id = Column(Integer)
    
    # === Unread Counters ===
    # Updated in real-time via WebSocket
    unread_count_user1 = Column(Integer, default=0)  # Unread by user1
    unread_count_user2 = Column(Integer, default=0)  # Unread by user2
    
    # === Status ===
    is_blocked = Column(Boolean, default=False)  # If one user blocked the other
    blocked_by = Column(Integer, nullable=True)  # Who blocked
    
    created_at = Column(DateTime, server_default=func.now())

    # === Relationships ===
    user1 = relationship("User", foreign_keys=[user1_id])
    user2 = relationship("User", foreign_keys=[user2_id])
    listing = relationship("Listing")
    messages = relationship(
        "Message",
        back_populates="conversation",
        order_by="Message.created_at.desc()",
        lazy="dynamic"
    )

    # === Indexes ===
    __table_args__ = (
        # Unique constraint to prevent duplicate conversations
        Index("idx_conversation_users", "user1_id", "user2_id", unique=True),
        # Index for inbox queries
        Index("idx_conversation_inbox", "user1_id", "last_message_at"),
        Index("idx_conversation_inbox2", "user2_id", "last_message_at"),
    )

    def __repr__(self):
        return f"<Conversation {self.id} ({self.user1_id} <-> {self.user2_id})>"
    
    def get_other_user_id(self, current_user_id: int) -> int:
        """Get the ID of the other participant"""
        return self.user2_id if self.user1_id == current_user_id else self.user1_id
    
    def get_unread_count(self, user_id: int) -> int:
        """Get unread count for a specific user"""
        if user_id == self.user1_id:
            return self.unread_count_user1
        return self.unread_count_user2


class Message(Base):
    """
    Individual message in a conversation.
    
    Supports:
    - Text messages
    - Image attachments
    - System messages (deal completed, etc.)
    """
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(
        Integer,
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
        index=True
    )
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    
    # === Content ===
    content = Column(Text)  # Message text
    image_url = Column(String(500))  # Optional image attachment
    
    # === Message Type ===
    # 'text' - regular message
    # 'image' - image with optional caption
    # 'system' - system notification (e.g., "Deal completed")
    message_type = Column(String(20), default="text")
    
    # === Read Status ===
    is_read = Column(Boolean, default=False, index=True)
    read_at = Column(DateTime, nullable=True)
    
    # === Status ===
    is_deleted = Column(Boolean, default=False)  # Soft delete
    deleted_at = Column(DateTime, nullable=True)
    
    created_at = Column(DateTime, server_default=func.now(), index=True)

    # === Relationships ===
    conversation = relationship("Conversation", back_populates="messages")
    sender = relationship("User", foreign_keys=[sender_id])

    # === Indexes ===
    __table_args__ = (
        # Index for loading conversation messages
        Index("idx_messages_conversation", "conversation_id", "created_at"),
        # Index for unread messages
        Index("idx_messages_unread", "conversation_id", "is_read"),
    )

    def __repr__(self):
        preview = self.content[:30] if self.content else "[image]"
        return f"<Message {self.id}: {preview}>"
