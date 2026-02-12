from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.schemas.notification import NotificationListResponse
from app.schemas.common import MessageResponse
from app.services.notification import list_notifications, mark_as_read

router = APIRouter(prefix="/notifications", tags=["Notifications"])


@router.get("", response_model=NotificationListResponse)
async def get_notifications(
    limit: int = Query(50, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    items, unread_count = await list_notifications(db, user.id, limit=limit)
    return {"items": items, "total": len(items), "unread_count": unread_count}


@router.post("/mark-read", response_model=MessageResponse)
async def mark_notifications_read(
    notification_id: int | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await mark_as_read(db, user.id, notification_id)
    return {"message": "Marked as read"}
