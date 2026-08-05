from __future__ import annotations

import os
from collections.abc import Generator
from pathlib import Path

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

DATA_DIR = Path(os.getenv("DINNERHUB_DATA_DIR", "/data/dinnerhub"))
DATABASE_PATH = DATA_DIR / "dinnerhub.db"
DATABASE_URL = os.getenv("DINNERHUB_DATABASE_URL", f"sqlite:///{DATABASE_PATH}")


class Base(DeclarativeBase):
    pass


def _connect_args() -> dict[str, object]:
    return {"check_same_thread": False, "timeout": 30} if DATABASE_URL.startswith("sqlite") else {}


engine = create_engine(DATABASE_URL, connect_args=_connect_args(), future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, class_=Session)


if DATABASE_URL.startswith("sqlite"):
    @event.listens_for(engine, "connect")
    def configure_sqlite(dbapi_connection, _connection_record) -> None:  # type: ignore[no-untyped-def]
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA synchronous=NORMAL")
        cursor.execute("PRAGMA busy_timeout=30000")
        cursor.close()


def initialise_database() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    from . import models, shopping_models  # noqa: F401

    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
