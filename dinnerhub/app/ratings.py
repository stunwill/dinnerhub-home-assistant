from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import Float, ForeignKey, String, UniqueConstraint, func, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base, get_db
from .models import Meal

router = APIRouter(prefix="/api/meals", tags=["ratings"])

HOUSEHOLD_MEMBERS = ("Stu", "Kristy", "Sienna")


class MealRating(Base):
    __tablename__ = "meal_ratings"

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_id: Mapped[int] = mapped_column(ForeignKey("meals.id", ondelete="CASCADE"), index=True)
    member_name: Mapped[str] = mapped_column(String(80), index=True)
    score: Mapped[float] = mapped_column(Float)
    updated_at: Mapped[datetime] = mapped_column(
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    __table_args__ = (
        UniqueConstraint("meal_id", "member_name", name="uq_meal_rating_member"),
    )


class RatingUpdate(BaseModel):
    member_name: str
    score: float | None = Field(default=None, ge=0, le=10)


class RatingSummary(BaseModel):
    meal_id: int
    ratings: dict[str, float | None]
    average: float | None
    count: int


def _summary(db: Session, meal_id: int) -> RatingSummary:
    rows = db.scalars(
        select(MealRating).where(MealRating.meal_id == meal_id)
    ).all()
    ratings = {name: None for name in HOUSEHOLD_MEMBERS}
    for row in rows:
        ratings[row.member_name] = round(float(row.score), 1)
    scores = [value for value in ratings.values() if value is not None]
    average = round(sum(scores) / len(scores), 1) if scores else None
    return RatingSummary(meal_id=meal_id, ratings=ratings, average=average, count=len(scores))


@router.get("/{meal_id}/ratings", response_model=RatingSummary)
def get_ratings(meal_id: int, db: Session = Depends(get_db)) -> RatingSummary:
    if not db.get(Meal, meal_id):
        raise HTTPException(status_code=404, detail="Meal not found")
    return _summary(db, meal_id)


@router.put("/{meal_id}/ratings", response_model=RatingSummary)
def update_rating(
    meal_id: int,
    payload: RatingUpdate,
    db: Session = Depends(get_db),
) -> RatingSummary:
    meal = db.get(Meal, meal_id)
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")

    member_name = " ".join(payload.member_name.split())
    if member_name not in HOUSEHOLD_MEMBERS:
        raise HTTPException(status_code=422, detail="Unknown household member")

    existing = db.scalar(
        select(MealRating).where(
            MealRating.meal_id == meal_id,
            func.lower(MealRating.member_name) == member_name.lower(),
        )
    )
    if payload.score is None:
        if existing:
            db.delete(existing)
    elif existing:
        existing.score = payload.score
    else:
        db.add(MealRating(meal_id=meal_id, member_name=member_name, score=payload.score))

    db.commit()
    return _summary(db, meal_id)


@router.get("/ratings/summary", response_model=dict[int, RatingSummary])
def rating_summaries(db: Session = Depends(get_db)) -> dict[int, RatingSummary]:
    meal_ids = db.scalars(select(Meal.id).where(Meal.active.is_(True))).all()
    return {meal_id: _summary(db, meal_id) for meal_id in meal_ids}
