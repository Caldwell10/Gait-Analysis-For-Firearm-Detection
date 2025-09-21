import uuid
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from sqlalchemy import and_
from typing import Optional, List
from ..models.user import User, PasswordResetToken, UserSession, UserRole
from ..core.security import hash_password, verify_password, hash_reset_token


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Get user by email address."""
    return db.query(User).filter(User.email == email).first()


def get_user_by_id(db: Session, user_id: uuid.UUID) -> Optional[User]:
    """Get user by ID."""
    return db.query(User).filter(User.id == user_id).first()


def create_user(db: Session, email: str, password: str, role: UserRole = UserRole.SECURITY_PERSONNEL) -> User:
    """Create a new user."""
    hashed_password = hash_password(password)
    db_user = User(
        email=email,
        password_hash=hashed_password,
        role=role,
        is_active=True
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    """Authenticate user with email and password."""
    user = get_user_by_email(db, email)
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    if not user.is_active:
        return None
    return user


def update_user_last_login(db: Session, user_id: uuid.UUID) -> None:
    """Update user's last login timestamp."""
    db.query(User).filter(User.id == user_id).update(
        {"last_login": datetime.utcnow()}
    )
    db.commit()


def get_users(db: Session, skip: int = 0, limit: int = 100) -> List[User]:
    """Get list of users with pagination."""
    return db.query(User).offset(skip).limit(limit).all()


def get_users_count(db: Session) -> int:
    """Get total count of users."""
    return db.query(User).count()


def update_user_role(db: Session, user_id: uuid.UUID, role: UserRole) -> Optional[User]:
    """Update user role."""
    user = get_user_by_id(db, user_id)
    if user:
        user.role = role
        db.commit()
        db.refresh(user)
    return user


def deactivate_user(db: Session, user_id: uuid.UUID) -> Optional[User]:
    """Deactivate user (soft delete)."""
    user = get_user_by_id(db, user_id)
    if user:
        user.is_active = False
        db.commit()
        db.refresh(user)
    return user


def activate_user(db: Session, user_id: uuid.UUID) -> Optional[User]:
    """Activate user."""
    user = get_user_by_id(db, user_id)
    if user:
        user.is_active = True
        db.commit()
        db.refresh(user)
    return user


# Password reset functions
def create_password_reset_token(db: Session, user_id: uuid.UUID, token: str, expires_in_hours: int = 1) -> PasswordResetToken:
    """Create a password reset token."""
    token_hash = hash_reset_token(token)
    expires_at = datetime.utcnow() + timedelta(hours=expires_in_hours)
    
    reset_token = PasswordResetToken(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=expires_at
    )
    db.add(reset_token)
    db.commit()
    db.refresh(reset_token)
    return reset_token


def get_valid_reset_token(db: Session, user_id: uuid.UUID) -> Optional[PasswordResetToken]:
    """Get valid (unused, non-expired) reset token for user."""
    return db.query(PasswordResetToken).filter(
        and_(
            PasswordResetToken.user_id == user_id,
            PasswordResetToken.used_at.is_(None),
            PasswordResetToken.expires_at > datetime.utcnow()
        )
    ).first()


def mark_reset_token_used(db: Session, token_id: uuid.UUID) -> None:
    """Mark password reset token as used."""
    db.query(PasswordResetToken).filter(PasswordResetToken.id == token_id).update(
        {"used_at": datetime.utcnow()}
    )
    db.commit()


def update_user_password(db: Session, user_id: uuid.UUID, new_password: str) -> None:
    """Update user password."""
    hashed_password = hash_password(new_password)
    db.query(User).filter(User.id == user_id).update(
        {"password_hash": hashed_password}
    )
    db.commit()


# Session management
def create_user_session(db: Session, user_id: uuid.UUID, token_jti: str, expires_at: datetime) -> UserSession:
    """Create a user session record."""
    session = UserSession(
        user_id=user_id,
        token_jti=token_jti,
        expires_at=expires_at
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def revoke_user_session(db: Session, token_jti: str) -> None:
    """Revoke a user session."""
    db.query(UserSession).filter(UserSession.token_jti == token_jti).update(
        {"revoked_at": datetime.utcnow()}
    )
    db.commit()


def is_session_revoked(db: Session, token_jti: str) -> bool:
    """Check if session is revoked."""
    session = db.query(UserSession).filter(UserSession.token_jti == token_jti).first()
    return session is None or session.revoked_at is not None