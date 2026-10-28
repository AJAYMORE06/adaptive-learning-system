from datetime import UTC, datetime

from sqlalchemy import (
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class LearningAttempt(Base):
    __tablename__ = "learning_attempts"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "session_id",
            "question_id",
            name="uq_learning_attempt_user_session_question",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    session_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    question_id: Mapped[str] = mapped_column(String(100), nullable=False)
    question_text: Mapped[str] = mapped_column(Text, nullable=False)
    answer_text: Mapped[str] = mapped_column(Text, nullable=False)

    hint_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    hints_used: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)

    score: Mapped[float | None] = mapped_column(Float, nullable=True)
    feedback: Mapped[str | None] = mapped_column(Text, nullable=True)
    strengths: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    improvements: Mapped[list] = mapped_column(JSONB, default=list, nullable=False)
    learning_hint: Mapped[str | None] = mapped_column(Text, nullable=True)
    learning_hints: Mapped[list] = mapped_column(
        JSONB,
        default=list,
        nullable=False,
    )
    total_hints: Mapped[int] = mapped_column(
        Integer,
        default=0,
        nullable=False,
    )
    difficulty: Mapped[str] = mapped_column(
        String(30), default="beginner", nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(UTC),
        nullable=False,
    )
