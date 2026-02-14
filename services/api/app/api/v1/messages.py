from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.message import MessageSend, MessageResponse, ConversationResponse
from app.services.message import get_conversations, get_messages, send_message, mark_messages_read

router = APIRouter(prefix="/messages", tags=["Messages"])


@router.get("/conversations", response_model=list[ConversationResponse])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all conversations for the current user."""
    return await get_conversations(db, user.id)


@router.get("/{other_user_id}", response_model=list[MessageResponse])
async def list_messages(
    other_user_id: int,
    before_id: int | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get messages between current user and another user."""
    # Verify other user exists
    other = await db.get(User, other_user_id)
    if not other:
        raise HTTPException(status_code=404, detail="The specified user could not be found.")

    # Mark messages as read
    await mark_messages_read(db, user.id, other_user_id)

    messages = await get_messages(db, user.id, other_user_id, limit, before_id)
    return messages


@router.post("/send", response_model=MessageResponse)
async def send(
    data: MessageSend,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Send a message to another user."""
    if data.receiver_id == user.id:
        raise HTTPException(status_code=400, detail="You cannot send a message to yourself.")

    receiver = await db.get(User, data.receiver_id)
    if not receiver:
        raise HTTPException(status_code=404, detail="The recipient could not be found. They may have deactivated their account.")
    if not receiver.is_active:
        raise HTTPException(status_code=400, detail="This user's account is currently inactive and cannot receive messages.")

    msg = await send_message(db, user.id, data.receiver_id, data.content)
    return msg
