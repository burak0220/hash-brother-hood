from sqlalchemy import select, func, or_, and_, case, literal_column
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.user import User


async def get_conversations(db: AsyncSession, user_id: int):
    """Get list of conversations for a user with last message and unread count."""
    # Subquery: for each conversation partner, get latest message id
    other_id = case(
        (Message.sender_id == user_id, Message.receiver_id),
        else_=Message.sender_id,
    ).label("other_id")

    partner_msg = (
        select(
            other_id,
            func.max(Message.id).label("last_msg_id"),
            func.sum(
                case(
                    (and_(Message.receiver_id == user_id, Message.is_read == False), 1),
                    else_=0,
                )
            ).label("unread_count"),
        )
        .where(or_(Message.sender_id == user_id, Message.receiver_id == user_id))
        .group_by(literal_column("other_id"))
        .subquery()
    )

    # Join with messages and users to get details
    result = await db.execute(
        select(
            User.id.label("user_id"),
            User.username,
            User.avatar_url,
            Message.content.label("last_message"),
            Message.created_at.label("last_message_at"),
            partner_msg.c.unread_count,
        )
        .join(Message, Message.id == partner_msg.c.last_msg_id)
        .join(User, User.id == partner_msg.c.other_id)
        .order_by(Message.created_at.desc())
    )
    return [dict(row._mapping) for row in result.all()]


async def get_messages(db: AsyncSession, user_id: int, other_user_id: int, limit: int = 50, before_id: int | None = None):
    """Get messages between two users."""
    query = (
        select(Message)
        .where(
            or_(
                and_(Message.sender_id == user_id, Message.receiver_id == other_user_id),
                and_(Message.sender_id == other_user_id, Message.receiver_id == user_id),
            )
        )
    )
    if before_id:
        query = query.where(Message.id < before_id)
    query = query.order_by(Message.created_at.desc()).limit(limit)

    result = await db.execute(query)
    return result.scalars().all()


async def send_message(db: AsyncSession, sender_id: int, receiver_id: int, content: str) -> Message:
    """Send a message to another user."""
    msg = Message(sender_id=sender_id, receiver_id=receiver_id, content=content)
    db.add(msg)
    await db.flush()
    await db.refresh(msg)
    return msg


async def mark_messages_read(db: AsyncSession, user_id: int, sender_id: int):
    """Mark all messages from sender as read for the user."""
    from sqlalchemy import update
    await db.execute(
        update(Message)
        .where(
            Message.receiver_id == user_id,
            Message.sender_id == sender_id,
            Message.is_read == False,
        )
        .values(is_read=True)
    )
