import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status, Request
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session

from ..core.database import get_db
from .auth import get_current_user
from ..core.file_handler import (
    validate_video_file,
    get_file_size_mb,
    save_uploaded_file,
    delete_video_files,
    FileValidationError,
    get_video_file_path,
    create_file_response,
    create_streaming_response,
    get_file_info,
    get_storage_stats,
    cleanup_orphaned_files
)
from ..crud import video as video_crud
from ..models.user import User, VideoRecord, UserRole
from ..schemas.video import (
    VideoUploadResponse,
    VideoMetadataResponse,
    VideoListResponse,
    VideoUpdateRequest,
    VideoAnalysisStatusUpdate
)

router = APIRouter(prefix="/videos", tags=["videos"])


@router.post("/upload", response_model=VideoUploadResponse)
async def upload_video(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Upload a thermal video file for gait analysis

    - **file**: Video file (.mp4, .avi, .mov) - max 100MB
    - Requires authentication
    - Creates VideoRecord and stores file securely
    """
    try:
        # Validate the uploaded file
        validate_video_file(file)

        # Get file size information
        size_bytes, size_str = get_file_size_mb(file)

        # Generate unique video ID
        video_id = uuid.uuid4()

        # Save file to disk
        file_path, metadata = save_uploaded_file(
            file=file,
            user_id=str(current_user.id),
            video_id=str(video_id),
            original_filename=file.filename
        )

        # Create database record
        video_record = video_crud.create_video_record(
            db=db,
            filename=f"original{metadata['file_extension']}",
            original_filename=file.filename,
            file_path=file_path,
            file_size=size_str,
            uploaded_by=current_user.id,
            video_metadata=metadata
        )

        return VideoUploadResponse(
            message="Video uploaded successfully",
            video_id=str(video_record.id),
            filename=video_record.original_filename,
            file_size=video_record.file_size,
            status=video_record.analysis_status
        )

    except FileValidationError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        # Clean up any partial uploads
        try:
            delete_video_files(str(current_user.id), str(video_id))
        except:
            pass

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload video: {str(e)}"
        )


@router.get("/", response_model=VideoListResponse)
async def list_videos(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    status: Optional[str] = Query(None, description="Filter by analysis status"),
    search: Optional[str] = Query(None, description="Search in filename, description, or tags"),
    include_deleted: bool = Query(False, description="Include soft-deleted videos"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List videos with pagination

    - **page**: Page number (starts at 1)
    - **per_page**: Number of items per page (max 100)
    - **status**: Optional filter by analysis status
    - **search**: Optional search in filename, description, or tags
    - **include_deleted**: Include soft-deleted videos (default: false)
    - Regular users see only their videos
    - Admins can see all videos
    """
    skip = (page - 1) * per_page

    # Determine access level
    if current_user.role == UserRole.ADMIN.value:
        # Admin can see all videos
        videos = video_crud.get_all_videos(
            db=db,
            skip=skip,
            limit=per_page,
            status_filter=status,
            search=search,
            include_deleted=include_deleted
        )
        total = video_crud.count_all_videos(
            db=db,
            status_filter=status,
            search=search,
            include_deleted=include_deleted
        )
    else:
        # Regular users see only their videos
        videos = video_crud.get_videos_by_user(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=per_page,
            status_filter=status,
            search=search,
            include_deleted=include_deleted
        )
        total = video_crud.count_videos_by_user(
            db=db,
            user_id=current_user.id,
            status_filter=status,
            search=search,
            include_deleted=include_deleted
        )

    # Convert to response format
    video_responses = [
        VideoMetadataResponse(
            id=str(video.id),
            filename=video.filename,
            original_filename=video.original_filename,
            file_size=video.file_size,
            duration=video.duration,
            description=video.description,
            tags=video.tags,
            subject_id=video.subject_id,
            analysis_status=video.analysis_status,
            video_metadata=video.video_metadata,
            is_deleted=video.is_deleted,
            uploaded_by=str(video.uploaded_by),
            created_at=video.created_at,
            updated_at=video.updated_at
        )
        for video in videos
    ]

    has_next = skip + per_page < total

    return VideoListResponse(
        videos=video_responses,
        total=total,
        page=page,
        per_page=per_page,
        has_next=has_next
    )


@router.get("/{video_id}", response_model=VideoMetadataResponse)
async def get_video(
    video_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get specific video details

    - **video_id**: UUID of the video
    - Users can only access their own videos (unless admin)
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check access permissions
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    return VideoMetadataResponse(
        id=str(video.id),
        filename=video.filename,
        original_filename=video.original_filename,
        file_size=video.file_size,
        duration=video.duration,
        description=video.description,
        tags=video.tags,
        subject_id=video.subject_id,
        analysis_status=video.analysis_status,
        video_metadata=video.video_metadata,
        is_deleted=video.is_deleted,
        uploaded_by=str(video.uploaded_by),
        created_at=video.created_at,
        updated_at=video.updated_at
    )


@router.patch("/{video_id}", response_model=VideoMetadataResponse)
async def update_video(
    video_id: str,
    update_data: VideoUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update video metadata

    - **video_id**: UUID of the video
    - Users can only update their own videos (unless admin)
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    # Update the video
    updated_video = video_crud.update_video_metadata(
        db=db,
        video_id=video_uuid,
        update_data=update_data
    )

    if not updated_video:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update video"
        )

    return VideoMetadataResponse(
        id=str(updated_video.id),
        filename=updated_video.filename,
        original_filename=updated_video.original_filename,
        file_size=updated_video.file_size,
        duration=updated_video.duration,
        description=updated_video.description,
        tags=updated_video.tags,
        subject_id=updated_video.subject_id,
        analysis_status=updated_video.analysis_status,
        video_metadata=updated_video.video_metadata,
        is_deleted=updated_video.is_deleted,
        uploaded_by=str(updated_video.uploaded_by),
        created_at=updated_video.created_at,
        updated_at=updated_video.updated_at
    )


@router.delete("/{video_id}")
async def delete_video(
    video_id: str,
    hard_delete: bool = Query(False, description="Permanently delete (default: soft delete)"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a video and its associated files

    - **video_id**: UUID of the video
    - **hard_delete**: If true, permanently delete; otherwise soft delete (default: false)
    - Users can only delete their own videos
    - Admins can delete any video
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    if hard_delete:
        # Delete files from disk
        file_deleted = delete_video_files(
            user_id=str(video.uploaded_by),
            video_id=str(video.id)
        )

        # Delete database record
        db_deleted = video_crud.hard_delete_video(db=db, video_id=video_uuid)

        if not db_deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete video from database"
            )

        return {
            "message": "Video permanently deleted",
            "video_id": video_id,
            "files_deleted": file_deleted
        }
    else:
        # Soft delete
        db_deleted = video_crud.soft_delete_video(
            db=db,
            video_id=video_uuid,
            deleted_by=current_user.id
        )

        if not db_deleted:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to delete video from database"
            )

        return {
            "message": "Video soft deleted successfully",
            "video_id": video_id,
            "files_deleted": False
        }


@router.patch("/{video_id}/status", response_model=VideoMetadataResponse)
async def update_analysis_status(
    video_id: str,
    status_update: VideoAnalysisStatusUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update video analysis status (admin/system function)

    - **video_id**: UUID of the video
    - **status**: New analysis status
    - **analysis_results**: Optional analysis results data
    - Typically used by ML processing system
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    video = video_crud.get_video_by_id(db=db, video_id=video_uuid)

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found"
        )

    # Update status
    updated_video = video_crud.update_analysis_status(
        db=db,
        video_id=video_uuid,
        status_update=status_update,
        analyzed_by=current_user.id
    )

    if not updated_video:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update analysis status"
        )

    return VideoMetadataResponse(
        id=str(updated_video.id),
        filename=updated_video.filename,
        original_filename=updated_video.original_filename,
        file_size=updated_video.file_size,
        duration=updated_video.duration,
        description=updated_video.description,
        tags=updated_video.tags,
        subject_id=updated_video.subject_id,
        analysis_status=updated_video.analysis_status,
        video_metadata=updated_video.video_metadata,
        is_deleted=updated_video.is_deleted,
        uploaded_by=str(updated_video.uploaded_by),
        created_at=updated_video.created_at,
        updated_at=updated_video.updated_at
    )

@router.get("/{video_id}/download")
async def download_video(
    video_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Download video file with secure access control

    - **video_id**: UUID of the video
    - Users can only download their own videos (unless admin)
    - Returns file with proper headers for download
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied"
        )

    # Get the actual file path
    file_path = get_video_file_path(
        user_id=str(video.uploaded_by),
        video_id=str(video.id)
    )

    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found on disk"
        )

    # Create secure file response
    return create_file_response(
        file_path=file_path,
        filename=video.original_filename
    )


@router.get("/{video_id}/stream")
async def stream_video(
    video_id: str,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Stream video file with range support for video players

    - **video_id**: UUID of the video
    - Supports HTTP range requests for efficient video streaming
    - Users can only stream their own videos (unless admin)
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied"
        )

    # Get the actual file path
    file_path = get_video_file_path(
        user_id=str(video.uploaded_by),
        video_id=str(video.id)
    )

    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found on disk"
        )

    # Get range header for partial content requests
    range_header = request.headers.get('range')

    # Create streaming response
    return create_streaming_response(
        file_path=file_path,
        range_header=range_header
    )


@router.get("/{video_id}/info")
async def get_video_file_info(
    video_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed file information for a video

    - **video_id**: UUID of the video
    - Returns file metadata, size, MIME type, etc.
    - Users can only access info for their own videos (unless admin)
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied"
        )

    # Get the actual file path
    file_path = get_video_file_path(
        user_id=str(video.uploaded_by),
        video_id=str(video.id)
    )

    if not file_path:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video file not found on disk"
        )

    # Get detailed file information
    file_info = get_file_info(file_path)
    if not file_info:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve file information"
        )

    return {
        "video_id": video_id,
        "database_info": {
            "original_filename": video.original_filename,
            "file_size": video.file_size,
            "analysis_status": video.analysis_status,
            "created_at": video.created_at,
            "updated_at": video.updated_at
        },
        "file_info": file_info,
        "file_path": str(file_path)
    }


@router.get("/storage/stats")
async def get_storage_statistics(
    current_user: User = Depends(get_current_user)
):
    """
    Get storage usage statistics

    - Only admins can access storage statistics
    - Returns disk usage, file counts, and storage information
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access storage statistics"
        )

    stats = get_storage_stats()
    return {
        "storage_statistics": stats,
        "timestamp": "2024-01-01T00:00:00Z"
    }


@router.post("/storage/cleanup")
async def cleanup_storage(
    execute: bool = Query(False, description="Actually perform cleanup (default: dry run)"),
    current_user: User = Depends(get_current_user)
):
    """
    Clean up orphaned files and storage

    - **execute**: Set to true to actually perform cleanup (default: false for dry run)
    - Only admins can perform storage cleanup
    - Returns list of files that would be/were cleaned up
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can perform storage cleanup"
        )

    # Get orphaned files
    cleanup_results = cleanup_orphaned_files()

    if execute:
        # TODO: Implement actual cleanup (requires database cross-reference)
        # For now, just return what would be cleaned up
        cleanup_results["action"] = "Dry run only - actual cleanup not implemented yet"
        cleanup_results["executed"] = False
    else:
        cleanup_results["action"] = "Dry run - no files were actually deleted"
        cleanup_results["executed"] = False

    return {
        "cleanup_results": cleanup_results,
        "timestamp": "2024-01-01T00:00:00Z"
    }
