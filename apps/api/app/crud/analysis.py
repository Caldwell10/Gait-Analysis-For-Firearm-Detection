import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func
from datetime import datetime

from ..models.user import GaitAnalysis, VideoRecord
from ..schemas.analysis import (
    AnalysisCreateRequest,
    AnalysisUpdateRequest,
    AnalysisStatusUpdate
)


def create_analysis(
    db: Session,
    video_id: uuid.UUID,
    analysis_data: Dict[str, Any],
    analyzed_by: uuid.UUID,
    subject_id: Optional[str] = None,
    confidence_score: Optional[str] = None,
    threat_detected: bool = False,
    threat_confidence: Optional[str] = None,
    threat_details: Optional[Dict[str, Any]] = None,
    algorithm_version: Optional[str] = None,
    processing_time: Optional[str] = None
) -> GaitAnalysis:
    """
    Create a new gait analysis record

    Args:
        db: Database session
        video_id: UUID of the associated video
        analysis_data: Detailed analysis results
        analyzed_by: UUID of the user/system performing analysis
        subject_id: Optional subject identifier
        confidence_score: Overall confidence score
        threat_detected: Whether a threat was detected
        threat_confidence: Threat detection confidence
        threat_details: Detailed threat information
        algorithm_version: ML algorithm version
        processing_time: Time taken for processing

    Returns:
        Created GaitAnalysis instance
    """
    analysis = GaitAnalysis(
        video_id=video_id,
        analysis_data=analysis_data,
        confidence_score=confidence_score,
        threat_detected=threat_detected,
        threat_confidence=threat_confidence,
        threat_details=threat_details or {},
        algorithm_version=algorithm_version,
        processing_time=processing_time,
        analyzed_by=analyzed_by
    )

    db.add(analysis)
    db.commit()
    db.refresh(analysis)
    return analysis


def get_analysis_by_id(db: Session, analysis_id: uuid.UUID) -> Optional[GaitAnalysis]:
    """
    Get an analysis record by ID

    Args:
        db: Database session
        analysis_id: UUID of the analysis

    Returns:
        GaitAnalysis if found, None otherwise
    """
    return db.query(GaitAnalysis).filter(GaitAnalysis.id == analysis_id).first()


def get_analysis_by_video_id(db: Session, video_id: uuid.UUID) -> Optional[GaitAnalysis]:
    """
    Get analysis record for a specific video

    Args:
        db: Database session
        video_id: UUID of the video

    Returns:
        GaitAnalysis if found, None otherwise
    """
    return db.query(GaitAnalysis).filter(GaitAnalysis.video_id == video_id).first()


def get_analyses_by_user(
    db: Session,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    threat_filter: Optional[bool] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> List[GaitAnalysis]:
    """
    Get analyses for videos uploaded by a specific user

    Args:
        db: Database session
        user_id: UUID of the user
        skip: Number of records to skip
        limit: Maximum number of records to return
        threat_filter: Filter by threat detection (True/False/None)
        date_from: Filter analyses from this date
        date_to: Filter analyses to this date

    Returns:
        List of GaitAnalysis instances
    """
    query = db.query(GaitAnalysis).join(VideoRecord).filter(
        VideoRecord.uploaded_by == user_id
    )

    if threat_filter is not None:
        query = query.filter(GaitAnalysis.threat_detected == threat_filter)

    if date_from:
        query = query.filter(GaitAnalysis.created_at >= date_from)

    if date_to:
        query = query.filter(GaitAnalysis.created_at <= date_to)

    return query.order_by(desc(GaitAnalysis.created_at)).offset(skip).limit(limit).all()


def get_all_analyses(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    threat_filter: Optional[bool] = None,
    user_filter: Optional[uuid.UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    confidence_min: Optional[float] = None
) -> List[GaitAnalysis]:
    """
    Get all analyses with filtering (admin function)

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        threat_filter: Filter by threat detection
        user_filter: Filter by user who uploaded the video
        date_from: Filter analyses from this date
        date_to: Filter analyses to this date
        confidence_min: Minimum confidence score filter

    Returns:
        List of GaitAnalysis instances
    """
    query = db.query(GaitAnalysis).join(VideoRecord)

    if threat_filter is not None:
        query = query.filter(GaitAnalysis.threat_detected == threat_filter)

    if user_filter:
        query = query.filter(VideoRecord.uploaded_by == user_filter)

    if date_from:
        query = query.filter(GaitAnalysis.created_at >= date_from)

    if date_to:
        query = query.filter(GaitAnalysis.created_at <= date_to)

    if confidence_min is not None:
        # Convert string confidence to float for comparison
        query = query.filter(
            func.cast(GaitAnalysis.confidence_score, db.Float) >= confidence_min
        )

    return query.order_by(desc(GaitAnalysis.created_at)).offset(skip).limit(limit).all()


def count_analyses_by_user(
    db: Session,
    user_id: uuid.UUID,
    threat_filter: Optional[bool] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> int:
    """
    Count analyses for videos uploaded by a specific user

    Args:
        db: Database session
        user_id: UUID of the user
        threat_filter: Filter by threat detection
        date_from: Filter analyses from this date
        date_to: Filter analyses to this date

    Returns:
        Number of analyses
    """
    query = db.query(GaitAnalysis).join(VideoRecord).filter(
        VideoRecord.uploaded_by == user_id
    )

    if threat_filter is not None:
        query = query.filter(GaitAnalysis.threat_detected == threat_filter)

    if date_from:
        query = query.filter(GaitAnalysis.created_at >= date_from)

    if date_to:
        query = query.filter(GaitAnalysis.created_at <= date_to)

    return query.count()


def count_all_analyses(
    db: Session,
    threat_filter: Optional[bool] = None,
    user_filter: Optional[uuid.UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None
) -> int:
    """
    Count all analyses with filtering (admin function)

    Args:
        db: Database session
        threat_filter: Filter by threat detection
        user_filter: Filter by user who uploaded the video
        date_from: Filter analyses from this date
        date_to: Filter analyses to this date

    Returns:
        Number of analyses
    """
    query = db.query(GaitAnalysis).join(VideoRecord)

    if threat_filter is not None:
        query = query.filter(GaitAnalysis.threat_detected == threat_filter)

    if user_filter:
        query = query.filter(VideoRecord.uploaded_by == user_filter)

    if date_from:
        query = query.filter(GaitAnalysis.created_at >= date_from)

    if date_to:
        query = query.filter(GaitAnalysis.created_at <= date_to)

    return query.count()


def update_analysis(
    db: Session,
    analysis_id: uuid.UUID,
    update_data: AnalysisUpdateRequest
) -> Optional[GaitAnalysis]:
    """
    Update analysis data

    Args:
        db: Database session
        analysis_id: UUID of the analysis
        update_data: Update data

    Returns:
        Updated GaitAnalysis if found, None otherwise
    """
    analysis = db.query(GaitAnalysis).filter(GaitAnalysis.id == analysis_id).first()

    if not analysis:
        return None

    update_dict = update_data.dict(exclude_unset=True)

    for field, value in update_dict.items():
        setattr(analysis, field, value)

    db.commit()
    db.refresh(analysis)
    return analysis


def update_analysis_status(
    db: Session,
    analysis_id: uuid.UUID,
    status_update: AnalysisStatusUpdate,
    reviewed_by: Optional[uuid.UUID] = None
) -> Optional[GaitAnalysis]:
    """
    Update analysis processing status

    Args:
        db: Database session
        analysis_id: UUID of the analysis
        status_update: Status update data
        reviewed_by: UUID of user reviewing the analysis

    Returns:
        Updated GaitAnalysis if found, None otherwise
    """
    analysis = db.query(GaitAnalysis).filter(GaitAnalysis.id == analysis_id).first()

    if not analysis:
        return None

    if status_update.analysis_data:
        analysis.analysis_data = status_update.analysis_data

    if reviewed_by:
        analysis.reviewed_by = reviewed_by

    db.commit()
    db.refresh(analysis)
    return analysis


def delete_analysis(db: Session, analysis_id: uuid.UUID) -> bool:
    """
    Delete an analysis record

    Args:
        db: Database session
        analysis_id: UUID of the analysis

    Returns:
        True if deleted, False if not found
    """
    analysis = db.query(GaitAnalysis).filter(GaitAnalysis.id == analysis_id).first()

    if not analysis:
        return False

    db.delete(analysis)
    db.commit()
    return True


def get_analysis_stats(db: Session, user_id: Optional[uuid.UUID] = None) -> Dict[str, Any]:
    """
    Get analysis statistics

    Args:
        db: Database session
        user_id: Optional user filter (for user-specific stats)

    Returns:
        Dictionary with analysis statistics
    """
    base_query = db.query(GaitAnalysis)

    if user_id:
        base_query = base_query.join(VideoRecord).filter(
            VideoRecord.uploaded_by == user_id
        )

    total_analyses = base_query.count()
    threats_detected = base_query.filter(GaitAnalysis.threat_detected == True).count()

    # Get latest analysis
    latest_analysis = base_query.order_by(desc(GaitAnalysis.created_at)).first()

    return {
        "total_analyses": total_analyses,
        "threats_detected": threats_detected,
        "threat_percentage": round((threats_detected / total_analyses * 100), 2) if total_analyses > 0 else 0,
        "last_analysis_date": latest_analysis.created_at if latest_analysis else None,
        "safe_analyses": total_analyses - threats_detected
    }


def get_pending_analyses(db: Session, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Get videos that need analysis

    Args:
        db: Database session
        limit: Maximum number of videos to return

    Returns:
        List of video records pending analysis
    """
    videos = db.query(VideoRecord).filter(
        VideoRecord.analysis_status == "pending"
    ).order_by(VideoRecord.created_at).limit(limit).all()

    return [
        {
            "video_id": str(video.id),
            "filename": video.original_filename,
            "uploaded_by": str(video.uploaded_by),
            "created_at": video.created_at
        }
        for video in videos
    ]