from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
import uuid


class VideoUploadResponse(BaseModel):
    """Response schema for video upload"""
    message: str
    video_id: str
    filename: str  # original filename from user
    file_size: str  # human readable size
    status: str  # analysis_status from VideoRecord


class VideoMetadataResponse(BaseModel):
    """Video metadata information"""
    id: str
    filename: str
    original_filename: str
    file_size: str
    duration: Optional[str] = None
    analysis_status: str
    video_metadata: Optional[Dict[str, Any]] = None
    uploaded_by: str
    created_at: datetime
    updated_at: datetime


class VideoListResponse(BaseModel):
    """Response schema for video list"""
    videos: list[VideoMetadataResponse]
    total: int
    page: int
    per_page: int
    has_next: bool


class VideoUpdateRequest(BaseModel):
    """Request schema for updating video metadata"""
    original_filename: Optional[str] = None
    analysis_status: Optional[str] = Field(None, pattern="^(pending|processing|completed|failed)$")


class VideoAnalysisStatusUpdate(BaseModel):
    """Schema for updating analysis status"""
    status: str = Field(..., pattern="^(pending|processing|completed|failed)$")
    analysis_results: Optional[Dict[str, Any]] = None