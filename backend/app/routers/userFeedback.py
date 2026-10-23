
import os
from datetime import datetime, timezone

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.user import User
from app.models.userFeedback import UserFeedback

load_dotenv()

router = APIRouter(prefix="/api/feedback", tags=["Feedback"])
bearer_scheme = HTTPBearer()

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class FeedbackCreate(BaseModel):
    rating: int = Field(ge=1, le=5)
    ease_of_use: str = Field(min_length=1, max_length=50)
    hint_usefulness: str = Field(min_length=1, max_length=50)
    recommendation: str = Field(min_length=1, max_length=50)
    improvements: str | None = Field(default=None, max_length=1500)


@router.post("", status_code=status.HTTP_201_CREATED)
def submit_feedback(
    payload: FeedbackCreate,
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
):
    try:
        claims = jwt.decode(
            credentials.credentials,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )
        subject = claims.get("sub")

        if not subject:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token.",
            )

        user_id = int(subject)

    except (jwt.InvalidTokenError, ValueError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    feedback = UserFeedback(
        user_id=user.id,
        rating=payload.rating,
        ease_of_use=payload.ease_of_use,
        hint_usefulness=payload.hint_usefulness,
        recommendation=payload.recommendation,
        improvements=payload.improvements or None,
        submitted_at=datetime.now(timezone.utc),
    )

    db.add(feedback)

    try:
        db.commit()
        db.refresh(feedback)
    except Exception:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Unable to save feedback. Please try again.",
        )

    return {
        "message": "Feedback submitted successfully.",
        "feedback_id": feedback.id,
        "submitted_at": feedback.submitted_at,
    }
