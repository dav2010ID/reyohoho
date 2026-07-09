from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=utcnow, onupdate=utcnow
    )


class User(TimestampMixin, Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    telegram_id: Mapped[int] = mapped_column(BigInteger, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(50))
    photo: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    role: Mapped[str] = mapped_column(String(20), default="user")
    allow_comments: Mapped[bool] = mapped_column(Boolean, default=True)


class TelegramLoginSession(Base):
    __tablename__ = "telegram_login_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Movie(Base):
    __tablename__ = "movies"
    kp_id: Mapped[str] = mapped_column(String(32), primary_key=True)
    shiki_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    imdb_id: Mapped[str | None] = mapped_column(String(32), unique=True, nullable=True)
    type: Mapped[str] = mapped_column(String(20), default="movie")
    metadata_json: Mapped[dict[str, Any]] = mapped_column("metadata", JSON, default=dict)
    parental_guide: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, onupdate=utcnow)


class ViewEvent(Base):
    __tablename__ = "view_events"
    __table_args__ = (Index("ix_view_events_created_kp", "created_at", "kp_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kp_id: Mapped[str] = mapped_column(String(32), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow, index=True)


class UserList(Base):
    __tablename__ = "user_lists"
    __table_args__ = (
        UniqueConstraint("user_id", "content_type", "content_id", "list_type"),
        Index("ix_user_lists_user_type", "user_id", "list_type"),
    )
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content_type: Mapped[str] = mapped_column(String(20), default="movie")
    content_id: Mapped[str] = mapped_column(String(32))
    list_type: Mapped[str] = mapped_column(String(20))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class Rating(TimestampMixin, Base):
    __tablename__ = "ratings"
    __table_args__ = (UniqueConstraint("user_id", "kp_id"), Index("ix_ratings_kp", "kp_id"))
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kp_id: Mapped[str] = mapped_column(String(32))
    rating: Mapped[int] = mapped_column(Integer)


class Comment(TimestampMixin, Base):
    __tablename__ = "comments"
    __table_args__ = (Index("ix_comments_movie_created", "movie_id", "created_at"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    movie_id: Mapped[str] = mapped_column(String(32))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("comments.id"), nullable=True, index=True)
    content: Mapped[str] = mapped_column(Text)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)


class CommentVote(Base):
    __tablename__ = "comment_votes"
    __table_args__ = (UniqueConstraint("comment_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comment_id: Mapped[int] = mapped_column(ForeignKey("comments.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    rating: Mapped[int] = mapped_column(Integer)


class TimingSubmission(TimestampMixin, Base):
    __tablename__ = "timing_submissions"
    __table_args__ = (Index("ix_timings_kp_status", "kp_id", "status"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    kp_id: Mapped[str] = mapped_column(String(32))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    timing_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="pending")
    moderator_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    moderated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_deleted: Mapped[bool] = mapped_column(Boolean, default=False)


class TimingReport(Base):
    __tablename__ = "timing_reports"
    __table_args__ = (UniqueConstraint("timing_id", "user_id", "status"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timing_id: Mapped[int] = mapped_column(ForeignKey("timing_submissions.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    report_text: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class TimingVote(Base):
    __tablename__ = "timing_votes"
    __table_args__ = (UniqueConstraint("timing_id", "user_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    timing_id: Mapped[int] = mapped_column(ForeignKey("timing_submissions.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    vote_type: Mapped[str] = mapped_column(String(20))


class MovieNote(TimestampMixin, Base):
    __tablename__ = "movie_notes"
    __table_args__ = (UniqueConstraint("user_id", "kp_id"),)
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    kp_id: Mapped[str] = mapped_column(String(32))
    note_text: Mapped[str] = mapped_column(Text)
