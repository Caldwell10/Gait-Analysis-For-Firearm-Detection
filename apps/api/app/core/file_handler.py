import os
import uuid
import shutil
import json
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
from fastapi import UploadFile, HTTPException
import magic

# File validation settings
ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/avi": ".avi",
    "video/x-msvideo": ".avi",
    "video/quicktime": ".mov"
}

ALLOWED_EXTENSIONS = [".mp4", ".avi", ".mov"]
MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB

# Base upload directory
UPLOAD_BASE_DIR = Path("uploads")


class FileValidationError(Exception):
    """Custom exception for file validation errors"""
    pass


def validate_video_file(file: UploadFile) -> None:
    """
    Validate uploaded video file for type, size, and security

    Args:
        file: The uploaded file object

    Raises:
        FileValidationError: If validation fails
    """
    if not file.filename:
        raise FileValidationError("No filename provided")

    # Check file extension
    file_ext = Path(file.filename).suffix.lower()
    if file_ext not in ALLOWED_EXTENSIONS:
        raise FileValidationError(
            f"Invalid file extension '{file_ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
        )

    # Reset file pointer to beginning for content validation
    file.file.seek(0)

    # Read first chunk for magic number validation
    chunk = file.file.read(2048)
    file.file.seek(0)  # Reset for later use

    if not chunk:
        raise FileValidationError("File appears to be empty")

    # Validate MIME type using python-magic
    try:
        mime_type = magic.from_buffer(chunk, mime=True)
        if mime_type not in ALLOWED_VIDEO_TYPES:
            raise FileValidationError(
                f"Invalid file type '{mime_type}'. Expected video file."
            )
    except Exception as e:
        raise FileValidationError(f"Could not determine file type: {str(e)}")


def get_file_size_mb(file: UploadFile) -> Tuple[int, str]:
    """
    Get file size in bytes and human-readable format

    Args:
        file: The uploaded file object

    Returns:
        Tuple of (size_in_bytes, human_readable_size)

    Raises:
        FileValidationError: If file is too large
    """
    # Get file size
    file.file.seek(0, 2)  # Seek to end
    size_bytes = file.file.tell()
    file.file.seek(0)  # Reset to beginning

    if size_bytes > MAX_FILE_SIZE:
        raise FileValidationError(
            f"File too large ({size_bytes / 1024 / 1024:.1f}MB). "
            f"Maximum allowed: {MAX_FILE_SIZE / 1024 / 1024}MB"
        )

    # Convert to human readable
    if size_bytes < 1024:
        size_str = f"{size_bytes}B"
    elif size_bytes < 1024 * 1024:
        size_str = f"{size_bytes / 1024:.1f}KB"
    else:
        size_str = f"{size_bytes / 1024 / 1024:.1f}MB"

    return size_bytes, size_str


def create_user_video_directory(user_id: str, video_id: str) -> Path:
    """
    Create directory structure for user's video

    Args:
        user_id: UUID string of the user
        video_id: UUID string of the video

    Returns:
        Path to the video directory
    """
    video_dir = UPLOAD_BASE_DIR / "videos" / str(user_id) / str(video_id)
    video_dir.mkdir(parents=True, exist_ok=True)
    return video_dir


def save_uploaded_file(
    file: UploadFile,
    user_id: str,
    video_id: str,
    original_filename: str
) -> Tuple[str, Dict[str, Any]]:
    """
    Save uploaded file to disk with proper organization

    Args:
        file: The uploaded file object
        user_id: UUID string of the user
        video_id: UUID string of the video
        original_filename: Original filename from user

    Returns:
        Tuple of (file_path, metadata_dict)

    Raises:
        HTTPException: If file save fails
    """
    try:
        # Create directory structure
        video_dir = create_user_video_directory(user_id, video_id)

        # Determine file extension
        file_ext = Path(original_filename).suffix.lower()

        # Create final filename and path
        final_filename = f"original{file_ext}"
        file_path = video_dir / final_filename

        # Save file to disk
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        # Create metadata
        size_bytes, size_str = get_file_size_mb(file)
        metadata = {
            "original_filename": original_filename,
            "file_extension": file_ext,
            "content_type": file.content_type,
            "size_bytes": size_bytes,
            "size_human": size_str,
            "upload_timestamp": str(uuid.uuid4()),  # Simple timestamp ID
        }

        # Save metadata file
        metadata_path = video_dir / "metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)

        return str(file_path), metadata

    except Exception as e:
        # Clean up any partial files
        try:
            if 'video_dir' in locals() and video_dir.exists():
                shutil.rmtree(video_dir)
        except:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to save file: {str(e)}"
        )


def delete_video_files(user_id: str, video_id: str) -> bool:
    """
    Delete all files associated with a video

    Args:
        user_id: UUID string of the user
        video_id: UUID string of the video

    Returns:
        True if deletion successful, False otherwise
    """
    try:
        video_dir = UPLOAD_BASE_DIR / "videos" / str(user_id) / str(video_id)
        if video_dir.exists():
            shutil.rmtree(video_dir)
        return True
    except Exception:
        return False


def get_video_file_path(user_id: str, video_id: str, filename: str = "original") -> Optional[Path]:
    """
    Get the path to a video file

    Args:
        user_id: UUID string of the user
        video_id: UUID string of the video
        filename: Base filename (without extension)

    Returns:
        Path object if file exists, None otherwise
    """
    video_dir = UPLOAD_BASE_DIR / "videos" / str(user_id) / str(video_id)

    # Look for file with any allowed extension
    for ext in ALLOWED_EXTENSIONS:
        file_path = video_dir / f"{filename}{ext}"
        if file_path.exists():
            return file_path

    return None