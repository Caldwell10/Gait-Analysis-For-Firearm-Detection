import uuid
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, desc, func

from ..models.user import VideoRecord
from ..schemas.video import VideoUpdateRequest, VideoAnalysisStatusUpdate


def create_video_record(
    db: Session,
    filename: str,
    original_filename: str,
    file_path: str,
    file_size: str,
    uploaded_by: uuid.UUID,
    video_metadata: Optional[Dict[str, Any]] = None,
    video_id: Optional[uuid.UUID] = None
) -> VideoRecord:
    """
    Create a new video record in the database

    Args:
        db: Database session
        filename: Generated filename on server
        original_filename: Original filename from user
        file_path: Full path to stored file
        file_size: Human-readable file size (e.g., "15.5MB")
        uploaded_by: UUID of the user who uploaded
        video_metadata: Optional metadata dictionary

    Returns:
        Created VideoRecord instance
    """
    video_record = VideoRecord(
        id=video_id,
        filename=filename,
        original_filename=original_filename,
        file_path=file_path,
        file_size=file_size,
        video_metadata=video_metadata or {},
        analysis_status="pending",
        uploaded_by=uploaded_by
    )

    db.add(video_record)
    db.commit()
    db.refresh(video_record)
    return video_record


def get_video_by_id(db: Session, video_id: uuid.UUID) -> Optional[VideoRecord]:
    """
    Get a video record by ID

    Args:
        db: Database session
        video_id: UUID of the video

    Returns:
        VideoRecord if found, None otherwise
    """
    return db.query(VideoRecord).filter(VideoRecord.id == video_id).first()


def get_video_by_id_and_user(
    db: Session,
    video_id: uuid.UUID,
    user_id: uuid.UUID
) -> Optional[VideoRecord]:
    """
    Get a video record by ID, ensuring it belongs to the specified user

    Args:
        db: Database session
        video_id: UUID of the video
        user_id: UUID of the user

    Returns:
        VideoRecord if found and belongs to user, None otherwise
    """
    return db.query(VideoRecord).filter(
        and_(
            VideoRecord.id == video_id,
            VideoRecord.uploaded_by == user_id
        )
    ).first()


def get_videos_by_user(
    db: Session,
    user_id: uuid.UUID,
    skip: int = 0,
    limit: int = 20,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    include_deleted: bool = False
) -> List[VideoRecord]:
    """
    Get videos uploaded by a specific user with pagination

    Args:
        db: Database session
        user_id: UUID of the user
        skip: Number of records to skip
        limit: Maximum number of records to return
        status_filter: Optional status filter
        search: Optional search term for filename
        include_deleted: Include soft-deleted videos

    Returns:
        List of VideoRecord instances
    """
    query = db.query(VideoRecord).filter(VideoRecord.uploaded_by == user_id)

    # Filter out deleted videos unless specifically requested
    if not include_deleted:
        query = query.filter(VideoRecord.is_deleted == False)

    if status_filter:
        query = query.filter(VideoRecord.analysis_status == status_filter)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                VideoRecord.original_filename.ilike(search_term),
                VideoRecord.description.ilike(search_term),
                VideoRecord.tags.ilike(search_term)
            )
        )

    return query.order_by(desc(VideoRecord.created_at)).offset(skip).limit(limit).all()


def get_all_videos(
    db: Session,
    skip: int = 0,
    limit: int = 20,
    status_filter: Optional[str] = None,
    user_filter: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    include_deleted: bool = False
) -> List[VideoRecord]:
    """
    Get all videos with pagination (admin function)

    Args:
        db: Database session
        skip: Number of records to skip
        limit: Maximum number of records to return
        status_filter: Optional status filter
        user_filter: Optional user filter
        search: Optional search term for filename
        include_deleted: Include soft-deleted videos

    Returns:
        List of VideoRecord instances
    """
    query = db.query(VideoRecord)

    # Filter out deleted videos unless specifically requested
    if not include_deleted:
        query = query.filter(VideoRecord.is_deleted == False)

    if status_filter:
        query = query.filter(VideoRecord.analysis_status == status_filter)

    if user_filter:
        query = query.filter(VideoRecord.uploaded_by == user_filter)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                VideoRecord.original_filename.ilike(search_term),
                VideoRecord.description.ilike(search_term),
                VideoRecord.tags.ilike(search_term)
            )
        )

    return query.order_by(desc(VideoRecord.created_at)).offset(skip).limit(limit).all()


def count_videos_by_user(
    db: Session,
    user_id: uuid.UUID,
    status_filter: Optional[str] = None,
    search: Optional[str] = None,
    include_deleted: bool = False
) -> int:
    """
    Count videos uploaded by a specific user

    Args:
        db: Database session
        user_id: UUID of the user
        status_filter: Optional status filter
        search: Optional search term for filename
        include_deleted: Include soft-deleted videos

    Returns:
        Number of videos
    """
    query = db.query(VideoRecord).filter(VideoRecord.uploaded_by == user_id)

    # Filter out deleted videos unless specifically requested
    if not include_deleted:
        query = query.filter(VideoRecord.is_deleted == False)

    if status_filter:
        query = query.filter(VideoRecord.analysis_status == status_filter)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                VideoRecord.original_filename.ilike(search_term),
                VideoRecord.description.ilike(search_term),
                VideoRecord.tags.ilike(search_term)
            )
        )

    return query.count()


def count_all_videos(
    db: Session,
    status_filter: Optional[str] = None,
    user_filter: Optional[uuid.UUID] = None,
    search: Optional[str] = None,
    include_deleted: bool = False
) -> int:
    """
    Count all videos (admin function)

    Args:
        db: Database session
        status_filter: Optional status filter
        user_filter: Optional user filter
        search: Optional search term for filename
        include_deleted: Include soft-deleted videos

    Returns:
        Number of videos
    """
    query = db.query(VideoRecord)

    # Filter out deleted videos unless specifically requested
    if not include_deleted:
        query = query.filter(VideoRecord.is_deleted == False)

    if status_filter:
        query = query.filter(VideoRecord.analysis_status == status_filter)

    if user_filter:
        query = query.filter(VideoRecord.uploaded_by == user_filter)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            or_(
                VideoRecord.original_filename.ilike(search_term),
                VideoRecord.description.ilike(search_term),
                VideoRecord.tags.ilike(search_term)
            )
        )

    return query.count()


def update_video_metadata(
    db: Session,
    video_id: uuid.UUID,
    update_data: VideoUpdateRequest
) -> Optional[VideoRecord]:
    """
    Update video metadata

    Args:
        db: Database session
        video_id: UUID of the video
        update_data: Update data

    Returns:
        Updated VideoRecord if found, None otherwise
    """
    video = db.query(VideoRecord).filter(VideoRecord.id == video_id).first()

    if not video:
        return None

    update_dict = update_data.dict(exclude_unset=True)

    for field, value in update_dict.items():
        setattr(video, field, value)

    db.commit()
    db.refresh(video)
    return video


def update_analysis_status(
    db: Session,
    video_id: uuid.UUID,
    status_update: VideoAnalysisStatusUpdate,
    analyzed_by: Optional[uuid.UUID] = None
) -> Optional[VideoRecord]:
    """
    Update video analysis status and results

    Args:
        db: Database session
        video_id: UUID of the video
        status_update: Status update data
        analyzed_by: UUID of user performing analysis

    Returns:
        Updated VideoRecord if found, None otherwise
    """
    video = db.query(VideoRecord).filter(VideoRecord.id == video_id).first()

    if not video:
        return None

    video.analysis_status = status_update.status

    if status_update.analysis_results:
        video.analysis_results = status_update.analysis_results

    if analyzed_by:
        video.analyzed_by = analyzed_by

    db.commit()
    db.refresh(video)
    return video


def soft_delete_video(db: Session, video_id: uuid.UUID, deleted_by: Optional[uuid.UUID] = None) -> bool:
    """
    Soft delete a video record (mark as inactive/deleted)

    Args:
        db: Database session
        video_id: UUID of the video
        deleted_by: UUID of user performing deletion

    Returns:
        True if deleted, False if not found
    """
    video = db.query(VideoRecord).filter(VideoRecord.id == video_id).first()

    if not video:
        return False

    video.is_deleted = True
    video.deleted_at = func.now()
    if deleted_by:
        video.deleted_by = deleted_by

    db.commit()
    return True


def hard_delete_video(db: Session, video_id: uuid.UUID) -> bool:
    """
    Hard delete a video record from database

    Args:
        db: Database session
        video_id: UUID of the video

    Returns:
        True if deleted, False if not found
    """
    video = db.query(VideoRecord).filter(VideoRecord.id == video_id).first()

    if not video:
        return False

    db.delete(video)
    db.commit()
    return True


def get_videos_for_analysis(db: Session, limit: int = 10) -> List[VideoRecord]:
    """
    Get videos that are pending analysis

    Args:
        db: Database session
        limit: Maximum number of videos to return

    Returns:
        List of VideoRecord instances with pending status
    """
    return db.query(VideoRecord).filter(
        VideoRecord.analysis_status == "pending"
    ).order_by(VideoRecord.created_at).limit(limit).all()


def update_video_ml_data(
    db: Session,
    video_id: uuid.UUID,
    gei_file_path: Optional[str] = None,
    processing_metadata: Optional[Dict[str, Any]] = None
) -> Optional[VideoRecord]:
    """
    Update video record with ML processing data

    Args:
        db: Database session
        video_id: UUID of the video
        gei_file_path: Path to generated GEI image
        processing_metadata: ML processing metadata

    Returns:
        Updated VideoRecord if found, None otherwise
    """
    video = db.query(VideoRecord).filter(VideoRecord.id == video_id).first()

    if not video:
        return None

    if gei_file_path is not None:
        video.gei_file_path = gei_file_path

    if processing_metadata is not None:
        video.processing_metadata = processing_metadata

    db.commit()
    db.refresh(video)
    return video