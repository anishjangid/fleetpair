"""SQLite persistence for shareable challenge links."""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, create_engine
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

DATABASE_URL = "sqlite:///./fleetpair.db"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


class Challenge(Base):
    __tablename__ = "challenges"

    id: Mapped[str] = mapped_column(String(32), primary_key=True)
    bookings_supported: Mapped[int] = mapped_column(Integer)
    bookings_total: Mapped[int] = mapped_column(Integer)
    long_range_to: Mapped[str] = mapped_column(String(16))
    outage: Mapped[int] = mapped_column(Integer, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


def init_db() -> None:
    Base.metadata.create_all(bind=engine)


def create_challenge(
    *,
    bookings_supported: int,
    bookings_total: int,
    long_range_to: str,
    outage: bool,
) -> Challenge:
    session = SessionLocal()
    try:
        row = Challenge(
            id=uuid.uuid4().hex[:10],
            bookings_supported=bookings_supported,
            bookings_total=bookings_total,
            long_range_to=long_range_to,
            outage=1 if outage else 0,
        )
        session.add(row)
        session.commit()
        session.refresh(row)
        return row
    finally:
        session.close()


def get_challenge(challenge_id: str) -> Challenge | None:
    session = SessionLocal()
    try:
        return session.get(Challenge, challenge_id)
    finally:
        session.close()
