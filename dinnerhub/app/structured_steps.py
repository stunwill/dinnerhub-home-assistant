from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, JSON, String, Text, UniqueConstraint, select
from sqlalchemy.orm import Mapped, Session, mapped_column

from .database import Base


class RecipeStep(Base):
    __tablename__ = "recipe_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_id: Mapped[int] = mapped_column(ForeignKey("meals.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(Integer)
    instruction: Mapped[str] = mapped_column(Text)
    ingredient_names: Mapped[list[str]] = mapped_column(JSON, default=list)
    timer_minutes: Mapped[int | None] = mapped_column(Integer)
    note: Mapped[str | None] = mapped_column(String(500))

    __table_args__ = (UniqueConstraint("meal_id", "position", name="uq_recipe_step_position"),)


def list_steps(db: Session, meal_id: int) -> list[RecipeStep]:
    return list(
        db.scalars(
            select(RecipeStep).where(RecipeStep.meal_id == meal_id).order_by(RecipeStep.position)
        ).all()
    )


def replace_steps(db: Session, meal_id: int, steps: list[dict]) -> list[RecipeStep]:
    for step in list_steps(db, meal_id):
        db.delete(step)
    db.flush()

    created: list[RecipeStep] = []
    for position, step in enumerate(steps, start=1):
        row = RecipeStep(
            meal_id=meal_id,
            position=position,
            instruction=str(step.get("instruction", "")).strip(),
            ingredient_names=[
                str(value).strip() for value in step.get("ingredient_names", []) if str(value).strip()
            ],
            timer_minutes=step.get("timer_minutes"),
            note=(str(step.get("note")).strip() if step.get("note") else None),
        )
        db.add(row)
        created.append(row)
    db.flush()
    return created
