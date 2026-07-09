"""Initial persistent backend schema.

Revision ID: 20260622_01
Revises:
"""
from typing import Sequence

from alembic import op

from backend import models  # noqa: F401
from backend.db import Base


revision: str = "20260622_01"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    Base.metadata.drop_all(bind=op.get_bind())
