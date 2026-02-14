from datetime import datetime
from pydantic import BaseModel, Field


class MessageSend(BaseModel):
    receiver_id: int
    content: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: int
    sender_id: int
    receiver_id: int
    content: str
    is_read: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ConversationResponse(BaseModel):
    user_id: int
    username: str
    avatar_url: str | None
    last_message: str
    last_message_at: datetime
    unread_count: int
