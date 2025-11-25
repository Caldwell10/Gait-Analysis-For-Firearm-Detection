import os
import uuid
import shutil
import json
import mimetypes
import logging
from pathlib import Path
from typing import Optional, Dict, Any, Tuple, List
from fastapi import UploadFile, HTTPException
from fastapi.responses import FileResponse, StreamingResponse
import magic
import cv2
import numpy as np
from .config import settings

# File validation settings
ALLOWED_VIDEO_TYPES = {
    "video/mp4": ".mp4",
    "video/avi": ".avi",
    "video/x-msvideo": ".avi",
    "video/quicktime": ".mov"
}

ALLOWED_EXTENSIONS = [".mp4", ".avi", ".mov"]
MAX_FILE_SIZE = settings.max_file_size_mb * 1024 * 1024  # Convert MB to bytes

# Base upload directory
UPLOAD_BASE_DIR = Path(settings.upload_base_dir)

logger = logging.getLogger(__name__)
STRICT_THERMAL_VALIDATION = os.getenv("STRICT_THERMAL_VALIDATION", "false").lower() == "true"
THERMAL_VALIDATION_THRESHOLD = float(os.getenv("THERMAL_VALIDATION_THRESHOLD", "0.6"))


class FileValidationError(Exception):
    """Custom exception for file validation errors"""
    pass


def validate_thermal_video(file_path: str, *, sample_frames: int = 12) -> None:
    """
    Ensure uploaded video exhibits thermal (pseudo-grayscale) characteristics.

    Args:
        file_path: Path to uploaded video on disk.
        sample_frames: Number of frames to inspect.

    Raises:
        FileValidationError: If video cannot be read or appears to be regular RGB footage.
    """
    logger.info("Thermal validation start: %s", file_path)
    cap = cv2.VideoCapture(file_path)
    if not cap.isOpened():
        cap.release()
        raise FileValidationError("Uploaded video could not be opened for validation.")

    frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    frame_count = frame_count if frame_count > 0 else -1
    step = max((frame_count // sample_frames) if frame_count > 0 else 1, 1)

    checked = 0
    non_thermal = 0
    thermal_like = 0
    uncertain = 0
    sample_debug: List[dict] = []
    max_colorfulness = 0.0
    sum_colorfulness = 0.0
    sum_saturation = 0.0
    frames_with_metrics = 0

    try:
        frame_index = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            if frame_index % step != 0:
                frame_index += 1
                continue

            checked += 1

            # Single-channel images are considered thermal
            if frame.ndim == 2 or (frame.ndim == 3 and frame.shape[2] == 1):
                frame_index += 1
                if checked >= sample_frames:
                    break
                continue

            if frame.ndim == 3 and frame.shape[2] >= 3:
                frame_bgr = frame if frame.shape[2] == 3 else cv2.cvtColor(frame, cv2.COLOR_BGRA2BGR)
                if frame_bgr.size > 320 * 240 * frame_bgr.shape[2]:
                    frame_bgr = cv2.resize(frame_bgr, (320, 240))

                frame_float = frame_bgr.astype(np.float32)
                hsv = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2HSV)
                saturation = hsv[..., 1].astype(np.float32) / 255.0
                hue = hsv[..., 0].astype(np.float32) / 180.0

                channel_spread = np.max(frame_float, axis=2) - np.min(frame_float, axis=2)
                colorful_ratio = float(np.mean(channel_spread > 12.0))
                mean_channel_spread = float(np.mean(channel_spread))
                mean_saturation = float(np.mean(saturation))
                hue_std = float(np.std(hue))

                gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY).astype(np.float32)
                mean_diff = float(np.mean(np.abs(frame_float - gray[..., None])))

                # Hasler-Süsstrunk colorfulness metric helps catch truly RGB footage
                rg = frame_float[..., 2] - frame_float[..., 1]
                yb = 0.5 * (frame_float[..., 2] + frame_float[..., 1]) - frame_float[..., 0]
                colorfulness = float(
                    np.sqrt(np.var(rg) + np.var(yb))
                    + 0.3 * np.sqrt(np.mean(rg) ** 2 + np.mean(yb) ** 2)
                )

                # Detect false-color thermal palettes (ironbow, rainbow, etc.)
                # Key characteristics:
                # 1. Thermal colormaps use warm-to-cool gradient (purple->blue->yellow->orange->red)
                # 2. Very limited unique saturation values (colormap is predefined)
                # 3. Hue values cluster in specific thermal colormap ranges
                hue_values = hsv[..., 0].flatten()
                sat_values = hsv[..., 1].flatten()

                # Check for thermal colormap characteristics
                unique_hues = len(np.unique(np.round(hue_values / 5) * 5))  # 5-degree bins
                unique_sats = len(np.unique(np.round(sat_values / 10) * 10))  # 10-unit bins

                # Thermal colormaps have very limited saturation variety (predefined palette)
                # and hues cluster in warm/cool ranges
                hue_histogram = np.histogram(hue_values, bins=18, range=(0, 180))[0]
                dominant_hue_bins = np.sum(hue_histogram > (len(hue_values) * 0.05))  # Bins with >5% pixels

                # False-color thermal: limited saturation variety + clustered hues + high saturation overall
                is_false_color_thermal = (
                    unique_sats < 15  # Very limited saturation values (colormap)
                    and dominant_hue_bins <= 6  # Colors cluster in few hue ranges
                    and mean_saturation > 0.4  # Thermal colormaps are saturated
                    and hue_std < 0.25  # Hues cluster together
                )

                frames_with_metrics += 1
                max_colorfulness = max(max_colorfulness, colorfulness)
                sum_colorfulness += colorfulness
                sum_saturation += mean_saturation

                # Thermal detection - grayscale OR confirmed false-color thermal
                looks_thermal = (
                    # Grayscale thermal (low saturation, low colorfulness)
                    (mean_saturation < 0.20 and colorfulness < 30.0 and mean_channel_spread < 12.0)
                    or (mean_saturation < 0.25 and colorfulness < 40.0 and hue_std < 0.10 and mean_diff < 10.0)
                    # Confirmed false-color thermal palette
                    or is_false_color_thermal
                )

                # RGB detection - natural scenes have varied saturation and wide hue distribution
                # Key: RGB has many different saturation levels (shadows, highlights, objects)
                clearly_rgb = (
                    not is_false_color_thermal
                    and unique_sats > 20  # Natural scenes have varied saturation
                    and (
                        (mean_saturation > 0.25 and colorfulness > 40.0)
                        or (colorful_ratio > 0.35 and mean_channel_spread > 20.0)
                        or (dominant_hue_bins > 8)  # Colors spread across many hue ranges
                    )
                )

                if looks_thermal:
                    thermal_like += 1
                    decision = "thermal"
                elif clearly_rgb:
                    non_thermal += 1
                    decision = "rgb"
                    if non_thermal >= max(1, checked // 2 + 1):
                        break
                else:
                    # Ambiguous frames are tracked separately for balanced scoring
                    uncertain += 1
                    decision = "uncertain"

                # keep a few samples for debugging
                if len(sample_debug) < 10:
                    sample_debug.append({
                        "frame": frame_index,
                        "hue_std": round(hue_std, 4),
                        "sat_mean": round(mean_saturation, 4),
                        "colorful_ratio": round(colorful_ratio, 4),
                        "channel_spread": round(mean_channel_spread, 2),
                        "mean_diff": round(mean_diff, 2),
                        "colorfulness": round(colorfulness, 2),
                        "unique_hues": unique_hues,
                        "unique_sats": unique_sats,
                        "dominant_hue_bins": int(dominant_hue_bins),
                        "is_false_color": is_false_color_thermal,
                        "decision": decision
                    })

            frame_index += 1
            if checked >= sample_frames:
                break
    finally:
        cap.release()

    if checked == 0:
        raise FileValidationError("Uploaded video did not contain any readable frames.")

    # Calculate ratios for balanced scoring
    thermal_ratio = thermal_like / checked
    rgb_ratio = non_thermal / checked
    uncertain_ratio = uncertain / checked

    avg_colorfulness = (sum_colorfulness / frames_with_metrics) if frames_with_metrics else 0.0
    avg_saturation = (sum_saturation / frames_with_metrics) if frames_with_metrics else 0.0

    # Log validation summary for debugging
    logger.info(
        "Thermal validation summary: checked=%d thermal=%d rgb=%d uncertain=%d "
        "thermal_ratio=%.3f rgb_ratio=%.3f uncertain_ratio=%.3f "
        "avg_colorfulness=%.2f avg_saturation=%.3f max_colorfulness=%.2f samples=%s",
        checked, thermal_like, non_thermal, uncertain, thermal_ratio, rgb_ratio, uncertain_ratio,
        avg_colorfulness, avg_saturation, max_colorfulness, sample_debug
    )

    # Rejection criteria - must have clear thermal characteristics
    rejection_msg = (
        "Uploaded video appears to be standard color footage. "
        "Please provide thermal imagery captured by a thermal camera."
    )

    # CRITICAL: If no frames look thermal, reject immediately
    if thermal_ratio == 0 and checked > 0:
        logger.warning("Hard block: zero thermal frames detected (thermal_ratio=0)")
        raise FileValidationError(rejection_msg)

    # Hard block: obviously RGB footage (any RGB detected + colorful)
    if rgb_ratio > 0.3 and avg_colorfulness > 45.0:
        logger.warning("Hard block: rgb_ratio=%.3f > 0.3 and avg_colorfulness=%.2f > 45",
                      rgb_ratio, avg_colorfulness)
        raise FileValidationError(rejection_msg)

    # Hard block: mostly uncertain with no clear thermal (suspicious)
    if uncertain_ratio > 0.5 and thermal_ratio < 0.3:
        logger.warning("Hard block: uncertain_ratio=%.3f > 0.5 and thermal_ratio=%.3f < 0.3",
                      uncertain_ratio, thermal_ratio)
        raise FileValidationError(rejection_msg)

    # Hard block: high saturation without being confirmed thermal colormap
    if avg_saturation > 0.35 and thermal_ratio < 0.5:
        logger.warning("Hard block: avg_saturation=%.3f > 0.35 and thermal_ratio=%.3f < 0.5",
                      avg_saturation, thermal_ratio)
        raise FileValidationError(rejection_msg)

    # Balanced block: any RGB detected and few thermal
    if rgb_ratio > 0.2 and thermal_ratio < 0.4:
        if STRICT_THERMAL_VALIDATION:
            logger.warning("Strict mode block: rgb_ratio=%.3f, thermal_ratio=%.3f", rgb_ratio, thermal_ratio)
            raise FileValidationError(rejection_msg)
        logger.warning("Non-strict mode: allowing borderline video. rgb_ratio=%.3f, thermal_ratio=%.3f",
                      rgb_ratio, thermal_ratio)

    # Log successful validation
    logger.info("Thermal validation passed: thermal_ratio=%.3f, rgb_ratio=%.3f", thermal_ratio, rgb_ratio)


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
            f"Maximum allowed: {settings.max_file_size_mb}MB"
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
) -> Tuple[str, Dict[str, Any], str]:
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

        return str(file_path), metadata, str(metadata_path)

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


def get_file_info(file_path: Path) -> Optional[Dict[str, Any]]:
    """
    Get detailed file information

    Args:
        file_path: Path to the file

    Returns:
        Dictionary with file information or None if not found
    """
    if not file_path.exists():
        return None

    try:
        stat = file_path.stat()

        # Get MIME type
        mime_type, _ = mimetypes.guess_type(str(file_path))
        if not mime_type:
            # Fallback to magic detection
            with open(file_path, 'rb') as f:
                chunk = f.read(2048)
                mime_type = magic.from_buffer(chunk, mime=True)

        return {
            "filename": file_path.name,
            "size_bytes": stat.st_size,
            "size_human": format_file_size(stat.st_size),
            "mime_type": mime_type,
            "created_at": stat.st_ctime,
            "modified_at": stat.st_mtime,
            "is_readable": os.access(file_path, os.R_OK),
            "extension": file_path.suffix.lower()
        }
    except Exception:
        return None


def format_file_size(size_bytes: int) -> str:
    """
    Format file size in human readable format

    Args:
        size_bytes: Size in bytes

    Returns:
        Human readable size string
    """
    if size_bytes < 1024:
        return f"{size_bytes}B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f}KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f}MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f}GB"


def create_file_response(file_path: Path, filename: Optional[str] = None) -> FileResponse:
    """
    Create a secure file response with proper headers

    Args:
        file_path: Path to the file
        filename: Optional custom filename for download

    Returns:
        FileResponse object with proper headers
    """
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "application/octet-stream"

    # Use provided filename or file's actual name
    download_filename = filename or file_path.name

    return FileResponse(
        path=str(file_path),
        media_type=mime_type,
        filename=download_filename,
        headers={
            "Content-Disposition": f"attachment; filename={download_filename}",
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0"
        }
    )


def create_streaming_response(file_path: Path, range_header: Optional[str] = None) -> StreamingResponse:
    """
    Create a streaming response for video files with range support

    Args:
        file_path: Path to the video file
        range_header: Optional range header for partial content

    Returns:
        StreamingResponse for video streaming
    """
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")

    file_size = file_path.stat().st_size

    # Get MIME type
    mime_type, _ = mimetypes.guess_type(str(file_path))
    if not mime_type:
        mime_type = "video/mp4"  # Default for video files

    # Handle range requests
    start = 0
    end = file_size - 1

    range_start = None
    range_end = None

    if range_header:
        range_match = range_header.replace('bytes=', '').split('-')
        if len(range_match) == 2:
            if range_match[0]:
                try:
                    range_start = int(range_match[0])
                except ValueError:
                    raise HTTPException(status_code=416, detail="Invalid range start")
            if range_match[1]:
                try:
                    range_end = int(range_match[1])
                except ValueError:
                    raise HTTPException(status_code=416, detail="Invalid range end")

    if range_start is not None:
        start = range_start

    if range_end is not None:
        end = range_end

    # Validate range
    if start >= file_size:
        raise HTTPException(
            status_code=416,
            detail="Requested range not satisfiable",
            headers={'Content-Range': f'bytes */{file_size}'}
        )

    if end >= file_size or range_end is None:
        end = file_size - 1

    if end < start:
        end = file_size - 1

    content_length = end - start + 1

    def file_generator():
        with open(file_path, 'rb') as file:
            file.seek(start)
            remaining = content_length
            while remaining > 0:
                chunk_size = min(8192, remaining)  # 8KB chunks
                chunk = file.read(chunk_size)
                if not chunk:
                    break
                remaining -= len(chunk)
                yield chunk

    headers = {
        'Content-Range': f'bytes {start}-{end}/{file_size}',
        'Accept-Ranges': 'bytes',
        'Content-Length': str(content_length),
        'Cache-Control': 'no-cache'
    }

    status_code = 206 if range_header else 200

    return StreamingResponse(
        file_generator(),
        status_code=status_code,
        headers=headers,
        media_type=mime_type
    )


def get_directory_size(directory_path: Path) -> int:
    """
    Calculate total size of directory and subdirectories

    Args:
        directory_path: Path to directory

    Returns:
        Total size in bytes
    """
    total_size = 0
    try:
        for dirpath, dirnames, filenames in os.walk(directory_path):
            for filename in filenames:
                file_path = Path(dirpath) / filename
                try:
                    total_size += file_path.stat().st_size
                except (OSError, FileNotFoundError):
                    continue
    except (OSError, FileNotFoundError):
        pass

    return total_size


def get_storage_stats() -> Dict[str, Any]:
    """
    Get storage statistics for the upload directory

    Returns:
        Dictionary with storage statistics
    """
    try:
        # Get total directory size
        total_size = get_directory_size(UPLOAD_BASE_DIR)

        # Count files and directories
        video_count = 0
        user_count = 0

        videos_dir = UPLOAD_BASE_DIR / "videos"
        if videos_dir.exists():
            # Count users (directories in videos/)
            user_dirs = [d for d in videos_dir.iterdir() if d.is_dir()]
            user_count = len(user_dirs)

            # Count videos (subdirectories in user directories)
            for user_dir in user_dirs:
                video_dirs = [d for d in user_dir.iterdir() if d.is_dir()]
                video_count += len(video_dirs)

        # Get available disk space
        disk_usage = shutil.disk_usage(UPLOAD_BASE_DIR)

        return {
            "total_storage_used": total_size,
            "total_storage_used_human": format_file_size(total_size),
            "video_count": video_count,
            "user_count": user_count,
            "disk_total": disk_usage.total,
            "disk_total_human": format_file_size(disk_usage.total),
            "disk_used": disk_usage.used,
            "disk_used_human": format_file_size(disk_usage.used),
            "disk_free": disk_usage.free,
            "disk_free_human": format_file_size(disk_usage.free),
            "upload_directory": str(UPLOAD_BASE_DIR)
        }
    except Exception as e:
        return {
            "error": f"Failed to get storage stats: {str(e)}",
            "total_storage_used": 0,
            "video_count": 0,
            "user_count": 0
        }


def cleanup_orphaned_files() -> Dict[str, Any]:
    """
    Find and optionally remove orphaned files (files without database records)

    Returns:
        Dictionary with cleanup results
    """
    orphaned_files = []
    orphaned_size = 0

    try:
        videos_dir = UPLOAD_BASE_DIR / "videos"
        if not videos_dir.exists():
            return {"orphaned_files": [], "total_size": 0, "message": "No videos directory"}

        # Scan all video directories
        for user_dir in videos_dir.iterdir():
            if not user_dir.is_dir():
                continue

            for video_dir in user_dir.iterdir():
                if not video_dir.is_dir():
                    continue

                # Check if this video directory has files
                files_in_dir = list(video_dir.iterdir())
                if files_in_dir:
                    dir_size = get_directory_size(video_dir)
                    orphaned_files.append({
                        "path": str(video_dir),
                        "user_id": user_dir.name,
                        "video_id": video_dir.name,
                        "file_count": len(files_in_dir),
                        "size_bytes": dir_size,
                        "size_human": format_file_size(dir_size)
                    })
                    orphaned_size += dir_size

        return {
            "orphaned_files": orphaned_files,
            "total_files": len(orphaned_files),
            "total_size": orphaned_size,
            "total_size_human": format_file_size(orphaned_size),
            "message": f"Found {len(orphaned_files)} potentially orphaned directories"
        }

    except Exception as e:
        return {
            "error": f"Failed to scan for orphaned files: {str(e)}",
            "orphaned_files": [],
            "total_size": 0
        }
