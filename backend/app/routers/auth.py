import hashlib
import logging
import os
import secrets
from datetime import UTC, datetime, timedelta
from urllib.parse import urlencode

import jwt
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pwdlib import PasswordHash
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import SessionLocal
from app.models.password_reset import PasswordResetToken
from app.models.user import User
from app.schemas.auth import (
    ForgotPasswordRequest,
    LoginRequest,
    RegisterRequest,
    ResetPasswordRequest,
    TokenResponse,
    UserResponse,
)
from app.services.email import send_password_reset_email

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
password_hash = PasswordHash.recommended()

def create_refresh_token(user_id: int) -> str:
    now = datetime.now(UTC)

    return jwt.encode(
        {
            "sub": str(user_id),
            "type": "refresh",
            "iat": now,
            "exp": now + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
            "jti": secrets.token_urlsafe(32),
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

def set_refresh_cookie(response: Response, refresh_token: str) -> None:
    is_production = os.getenv("ENVIRONMENT", "development").lower() == "production"

    response.set_cookie(
        key=REFRESH_COOKIE_NAME,
        value=refresh_token,
        httponly=True,
        secure=is_production,
        samesite="lax",
        max_age=REFRESH_TOKEN_EXPIRE_DAYS * 24 * 60 * 60,
        path=REFRESH_COOKIE_PATH,
    )

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_user(
    payload: RegisterRequest,
    db: Session = Depends(get_db),
):
    normalized_email = str(payload.email).strip().lower()

    existing_user = db.scalar(select(User).where(User.email == normalized_email))
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None

    user = User(
        full_name=payload.full_name,
        email=normalized_email,
        password_hash=password_hash.hash(payload.password),
    )

    db.add(user)

    try:
        db.commit()
        db.refresh(user)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        ) from None

    return user


load_dotenv()

JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(
    os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "7")
)

REFRESH_COOKIE_NAME = "intelliprep_refresh"
REFRESH_COOKIE_PATH = "/api/auth"


@router.post("/login", response_model=TokenResponse)

@router.post("/login", response_model=TokenResponse)
def login_user(
    payload: LoginRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    normalized_email = str(payload.email).strip().lower()

    user = db.scalar(select(User).where(User.email == normalized_email))

    if user is None or not password_hash.verify(
        payload.password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    now = datetime.now(UTC)
    expires_at = now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)

    access_token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": expires_at,
            "iat": now,
            "type": "access",
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    refresh_token = create_refresh_token(user.id)
    set_refresh_cookie(response, refresh_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": "admin" if user.is_admin else "student",
        },
    }



@router.post("/refresh", response_model=TokenResponse)
def refresh_access_token(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    refresh_token = request.cookies.get(REFRESH_COOKIE_NAME)

    if not refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token missing. Please log in again.",
        )

    try:
        payload = jwt.decode(
            refresh_token,
            JWT_SECRET_KEY,
            algorithms=[JWT_ALGORITHM],
        )

        if payload.get("type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token.",
            )

        subject = payload.get("sub")
        if subject is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token.",
            )

        user_id = int(subject)

    except (jwt.InvalidTokenError, ValueError, TypeError):
        response.delete_cookie(
            key=REFRESH_COOKIE_NAME,
            path=REFRESH_COOKIE_PATH,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Refresh token expired or invalid. Please log in again.",
        ) from None

    user = db.get(User, user_id)
    if user is None:
        response.delete_cookie(
            key=REFRESH_COOKIE_NAME,
            path=REFRESH_COOKIE_PATH,
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User account not found.",
        )

    now = datetime.now(UTC)
    access_token = jwt.encode(
        {
            "sub": str(user.id),
            "exp": now + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES),
            "iat": now,
            "type": "access",
        },
        JWT_SECRET_KEY,
        algorithm=JWT_ALGORITHM,
    )

    # Rotate the refresh token after each successful refresh.
    new_refresh_token = create_refresh_token(user.id)
    set_refresh_cookie(response, new_refresh_token)

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "email": user.email,
            "role": "admin" if user.is_admin else "student",
        },
    }


@router.post("/reset-password")
def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db),
):
    token_hash = hashlib.sha256(payload.token.encode("utf-8")).hexdigest()

    reset_record = db.scalar(
        select(PasswordResetToken).where(
            PasswordResetToken.token_hash == token_hash,
            PasswordResetToken.used_at.is_(None),
        )
    )

    if reset_record is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    # Handle timezone-aware and timezone-naive database timestamps.
    expires_at = reset_record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)

    if expires_at <= datetime.now(UTC):
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    user = db.get(User, reset_record.user_id)

    if user is None:
        raise HTTPException(
            status_code=400,
            detail="Invalid or expired reset token.",
        )

    # Hash the new password using the same Argon2 hasher as registration.
    user.password_hash = password_hash.hash(payload.new_password)

    # Make the reset token unusable after a successful reset.
    reset_record.used_at = datetime.now(UTC)

    db.commit()

    return {"message": "Password reset successfully."}



@router.post("/logout")
def logout_user(response: Response):
    response.delete_cookie(
        key=REFRESH_COOKIE_NAME,
        path=REFRESH_COOKIE_PATH,
        httponly=True,
        secure=os.getenv("ENVIRONMENT", "development").lower() == "production",
        samesite="lax",
    )
    return {"message": "Logged out successfully."}


@router.post("/forgot-password")
def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db),
):
    email = str(payload.email).strip().lower()
    user = db.scalar(select(User).where(User.email == email))

    message = {
        "message": (
            "If an account exists for this email, "
            "you will receive password-reset instructions."
        )
    }

    if user is None:
        return message

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()

    reset_record = PasswordResetToken(
        user_id=user.id,
        token_hash=token_hash,
        expires_at=(datetime.now(UTC) + timedelta(minutes=30)),
    )

    db.add(reset_record)
    db.commit()
    db.refresh(reset_record)

    frontend_url = os.getenv(
        "FRONTEND_URL",
        "http://localhost:5173",
    ).rstrip("/")

    reset_link = f"{frontend_url}/reset-password?{urlencode({'token': raw_token})}"

    try:
        send_password_reset_email(
            recipient=user.email,
            reset_link=reset_link,
        )
    except Exception:
        logger.exception("Password-reset email delivery failed")

        # Remove this unused token if delivery failed.
        db.delete(reset_record)
        db.commit()

    return message
