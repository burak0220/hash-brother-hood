from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, update

from app.models.notification import Notification


async def create_notification(
    db: AsyncSession, user_id: int, type: str, title: str, message: str, link: str | None = None,
) -> Notification:
    notif = Notification(user_id=user_id, type=type, title=title, message=message, link=link)
    db.add(notif)
    await db.flush()
    await db.refresh(notif)
    return notif


async def list_notifications(db: AsyncSession, user_id: int, limit: int = 50) -> tuple[list[Notification], int]:
    query = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .limit(limit)
    )
    result = await db.execute(query)
    items = list(result.scalars().all())

    unread_q = select(func.count()).where(
        Notification.user_id == user_id, Notification.is_read == False
    )
    unread_count = (await db.execute(unread_q)).scalar() or 0

    return items, unread_count


async def mark_as_read(db: AsyncSession, user_id: int, notification_id: int | None = None) -> None:
    if notification_id:
        await db.execute(
            update(Notification)
            .where(Notification.id == notification_id, Notification.user_id == user_id)
            .values(is_read=True)
        )
    else:
        await db.execute(
            update(Notification)
            .where(Notification.user_id == user_id, Notification.is_read == False)
            .values(is_read=True)
        )
    await db.flush()
