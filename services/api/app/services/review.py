from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.models.review import Review
from app.models.rental import Rental
from app.models.rig import Rig


async def create_review(
    db: AsyncSession, reviewer_id: int, rental_id: int, rating: int, comment: str | None = None,
) -> Review:
    result = await db.execute(select(Rental).where(Rental.id == rental_id))
    rental = result.scalar_one_or_none()
    if not rental:
        raise ValueError("Rental not found")
    if rental.renter_id != reviewer_id:
        raise ValueError("Only the renter can leave a review")
    if rental.status not in ("completed", "active"):
        raise ValueError("Cannot review this rental")

    existing = await db.execute(
        select(Review).where(Review.rental_id == rental_id, Review.reviewer_id == reviewer_id)
    )
    if existing.scalar_one_or_none():
        raise ValueError("Already reviewed")

    review = Review(
        rental_id=rental_id, rig_id=rental.rig_id,
        reviewer_id=reviewer_id, rating=rating, comment=comment,
    )
    db.add(review)

    # Update rig average rating
    rig_result = await db.execute(select(Rig).where(Rig.id == rental.rig_id))
    rig = rig_result.scalar_one()
    avg_q = select(func.avg(Review.rating)).where(Review.rig_id == rig.id)
    avg_rating = (await db.execute(avg_q)).scalar() or 0
    rig.average_rating = round(avg_rating, 2)

    await db.flush()
    await db.refresh(review)
    return review


async def list_rig_reviews(db: AsyncSession, rig_id: int) -> list[Review]:
    result = await db.execute(
        select(Review)
        .options(selectinload(Review.reviewer))
        .where(Review.rig_id == rig_id)
        .order_by(Review.created_at.desc())
    )
    return list(result.scalars().all())
