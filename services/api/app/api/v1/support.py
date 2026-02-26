"""Support ticket endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.support_ticket import SupportTicket, SupportMessage

router = APIRouter(prefix="/support", tags=["Support"])


class CreateTicket(BaseModel):
    subject: str
    message: str
    category: str = "general"
    priority: str = "normal"
    rental_id: int | None = None


class AddMessage(BaseModel):
    message: str


def _ticket_to_response(t: SupportTicket) -> dict:
    return {
        "id": t.id,
        "user_id": t.user_id,
        "username": t.user.username if t.user else None,
        "subject": t.subject,
        "category": t.category,
        "priority": t.priority,
        "status": t.status,
        "rental_id": t.rental_id,
        "assigned_to": t.assigned_to,
        "resolved_at": t.resolved_at,
        "created_at": t.created_at,
        "updated_at": t.updated_at,
        "messages": [
            {
                "id": m.id,
                "sender_id": m.sender_id,
                "sender_name": m.sender.username if m.sender else None,
                "message": m.message,
                "is_internal": m.is_internal,
                "created_at": m.created_at,
            }
            for m in (t.messages or [])
            if not m.is_internal  # Hide internal notes from non-admin
        ],
        "message_count": len(t.messages) if t.messages else 0,
    }


def _ticket_to_admin_response(t: SupportTicket) -> dict:
    """Admin sees internal notes too."""
    data = _ticket_to_response(t)
    data["messages"] = [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender_name": m.sender.username if m.sender else None,
            "message": m.message,
            "is_internal": m.is_internal,
            "created_at": m.created_at,
        }
        for m in (t.messages or [])
    ]
    return data


@router.post("", status_code=201)
async def create_ticket(
    data: CreateTicket,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    ticket = SupportTicket(
        user_id=user.id,
        subject=data.subject,
        category=data.category,
        priority=data.priority,
        rental_id=data.rental_id,
    )
    db.add(ticket)
    await db.flush()

    msg = SupportMessage(ticket_id=ticket.id, sender_id=user.id, message=data.message)
    db.add(msg)
    await db.commit()
    await db.refresh(ticket, ["messages", "user"])

    return _ticket_to_response(ticket)


@router.get("")
async def list_my_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str | None = Query(None),
):
    query = select(SupportTicket).where(SupportTicket.user_id == user.id)
    if status:
        query = query.where(SupportTicket.status == status)
    result = await db.execute(
        query.options(selectinload(SupportTicket.messages).selectinload(SupportMessage.sender), selectinload(SupportTicket.user))
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()
    return [_ticket_to_response(t) for t in tickets]


@router.get("/{ticket_id}")
async def get_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SupportTicket)
        .options(selectinload(SupportTicket.messages).selectinload(SupportMessage.sender), selectinload(SupportTicket.user))
        .where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if ticket.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not authorized")

    if user.role == "admin":
        return _ticket_to_admin_response(ticket)
    return _ticket_to_response(ticket)


@router.post("/{ticket_id}/messages")
async def add_message(
    ticket_id: int,
    data: AddMessage,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    if ticket.user_id != user.id and user.role != "admin":
        raise HTTPException(403, "Not authorized")

    msg = SupportMessage(ticket_id=ticket_id, sender_id=user.id, message=data.message, is_internal=False)
    db.add(msg)

    if ticket.status == "resolved":
        ticket.status = "open"  # Re-open on new message

    await db.commit()
    return {"status": "ok"}


@router.post("/{ticket_id}/resolve")
async def resolve_ticket(
    ticket_id: int,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role != "admin":
        raise HTTPException(403, "Admin only")

    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    from datetime import datetime, timezone
    ticket.status = "resolved"
    ticket.resolved_at = datetime.now(timezone.utc)
    await db.commit()
    return {"status": "resolved"}


@router.get("/admin/all")
async def admin_list_tickets(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    status: str | None = Query(None),
):
    if user.role != "admin":
        raise HTTPException(403, "Admin only")

    query = select(SupportTicket)
    if status:
        query = query.where(SupportTicket.status == status)
    result = await db.execute(
        query.options(selectinload(SupportTicket.messages).selectinload(SupportMessage.sender), selectinload(SupportTicket.user))
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()
    return [_ticket_to_admin_response(t) for t in tickets]
