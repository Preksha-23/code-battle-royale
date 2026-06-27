import uuid
from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, DateTime, func

# Existing imports adjusted

from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    client_id = Column(String(36), unique=True, nullable=False, default=lambda: str(uuid.uuid4()))
    username = Column(String(50), unique=True, nullable=False, index=True)
    password_hash = Column(String(128), nullable=False)
    xp = Column(Integer, default=0, nullable=False)
    wins = Column(Integer, default=0, nullable=False)
    total_games = Column(Integer, default=0, nullable=False)
    winstreak = Column(Integer, default=0, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

class Friendship(Base):
    __tablename__ = "friendships"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    friend_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    status = Column(String(20), default="pending", nullable=False)  # 'pending', 'accepted'
    is_sender = Column(Boolean, default=False, nullable=False)
    created_at = Column(DateTime, server_default=func.now(), nullable=False)

    # Relationship to join user details
    friend_user = relationship("User", foreign_keys=[friend_id], lazy="joined")
