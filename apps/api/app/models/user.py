import uuid
from sqlalchemy import Column, String, Boolean, DateTime, Text, JSON
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from enum import Enum as PyEnum
from ..core.database import Base


class UserRole(str, PyEnum):
    ADMIN = "admin"
    SECURITY_PERSONNEL = "security_personnel"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default=UserRole.SECURITY_PERSONNEL.value, nullable=False)
    
    # Status and timestamps
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    last_login = Column(DateTime(timezone=True), nullable=True)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token_hash = Column(String(255), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    used_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    token_jti = Column(String(255), unique=True, nullable=False, index=True)
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)


class VideoRecord(Base):
    __tablename__ = "video_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    filename = Column(String(255), nullable=False)
    original_filename = Column(String(255), nullable=False)
    file_path = Column(Text, nullable=False)
    file_size = Column(String(50), nullable=False)  # e.g., "15.5MB"
    duration = Column(String(20), nullable=True)  # e.g., "00:02:15"
    description = Column(Text, nullable=True)  # User description
    tags = Column(String(500), nullable=True)  # Comma-separated tags
    subject_id = Column(String(100), nullable=True)  # Subject identifier
    
    # Video metadata (JSON field for flexibility)
    video_metadata = Column(JSON, nullable=True)  # resolution, fps, format, etc.
    
    # Analysis status
    analysis_status = Column(String(50), default="pending", nullable=False)  # pending, processing, completed, failed
    analysis_results = Column(JSON, nullable=True)  # Gait analysis results
    
    # Soft delete fields
    is_deleted = Column(Boolean, default=False, nullable=False)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    deleted_by = Column(UUID(as_uuid=True), nullable=True, index=True)

    # User and timestamps
    uploaded_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    analyzed_by = Column(UUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)


class GaitAnalysis(Base):
    __tablename__ = "gait_analyses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    video_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    
    # Analysis results (JSON for flexibility)
    analysis_data = Column(JSON, nullable=False)  # Detailed gait metrics
    confidence_score = Column(String(10), nullable=True)  # e.g., "0.85" or "85%"
    
    # Detection results
    threat_detected = Column(Boolean, default=False, nullable=False)
    threat_confidence = Column(String(10), nullable=True)
    threat_details = Column(JSON, nullable=True)  # Specific threat indicators
    
    # Processing info
    algorithm_version = Column(String(20), nullable=True)
    processing_time = Column(String(20), nullable=True)  # e.g., "2.5s"
    
    # User and timestamps
    analyzed_by = Column(UUID(as_uuid=True), nullable=False, index=True)
    reviewed_by = Column(UUID(as_uuid=True), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)