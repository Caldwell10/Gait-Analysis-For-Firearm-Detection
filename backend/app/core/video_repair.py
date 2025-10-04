"""
Video repair utility for fixing thermal videos with corrupted metadata
"""
import subprocess
import json
import os
import logging
from pathlib import Path

logger = logging.getLogger(__name__)


def check_video_has_dimensions(video_path: str) -> tuple[bool, dict]:
    """
    Check if a video file has valid dimensions (width/height > 0)

    Returns:
        tuple: (has_valid_dimensions: bool, metadata: dict)
    """
    try:
        # Use ffprobe to get video metadata
        cmd = [
            'ffprobe',
            '-v', 'quiet',
            '-print_format', 'json',
            '-show_format',
            '-show_streams',
            video_path
        ]

        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        probe = json.loads(result.stdout)

        video_stream = next((stream for stream in probe['streams'] if stream['codec_type'] == 'video'), None)

        if not video_stream:
            logger.warning(f"No video stream found in {video_path}")
            return False, {}

        width = int(video_stream.get('width', 0))
        height = int(video_stream.get('height', 0))

        metadata = {
            'width': width,
            'height': height,
            'codec': video_stream.get('codec_name', 'unknown'),
            'duration': float(probe['format'].get('duration', 0)),
            'size': int(probe['format'].get('size', 0))
        }

        has_dimensions = width > 0 and height > 0

        if not has_dimensions:
            logger.warning(f"Video {video_path} has invalid dimensions: {width}x{height}")

        return has_dimensions, metadata

    except Exception as e:
        logger.error(f"Error probing video {video_path}: {e}")
        return False, {}


def repair_video(input_path: str, output_path: str = None) -> tuple[bool, str]:
    """
    Repair a video file by re-encoding with proper metadata

    Args:
        input_path: Path to the corrupted video file
        output_path: Path for the repaired video (optional, defaults to input_path with _repaired suffix)

    Returns:
        tuple: (success: bool, output_path: str)
    """
    try:
        # Generate output path if not provided
        if output_path is None:
            input_file = Path(input_path)
            output_path = str(input_file.parent / f"{input_file.stem}_repaired{input_file.suffix}")

        logger.info(f"Repairing video: {input_path} -> {output_path}")

        # Build FFmpeg command
        cmd = [
            'ffmpeg',
            '-i', input_path,
            '-vcodec', 'libx264',
            '-preset', 'fast',
            '-crf', '22',
            '-pix_fmt', 'yuv420p',
            '-movflags', 'faststart',
            '-y',  # Overwrite output
            output_path
        ]

        # Run FFmpeg command
        result = subprocess.run(cmd, capture_output=True, text=True)

        if result.returncode != 0:
            raise Exception(f"FFmpeg failed: {result.stderr}")

        # Verify the repaired video has valid dimensions
        has_dimensions, metadata = check_video_has_dimensions(output_path)

        if not has_dimensions:
            logger.error(f"Repair failed: output video still has invalid dimensions")
            if os.path.exists(output_path):
                os.remove(output_path)
            return False, ""

        logger.info(f"Video repaired successfully: {metadata['width']}x{metadata['height']}")
        return True, output_path

    except Exception as e:
        logger.error(f"Error repairing video: {e}")
        if output_path and os.path.exists(output_path):
            os.remove(output_path)
        return False, ""


def repair_if_needed(video_path: str) -> tuple[bool, str, bool]:
    """
    Check if video needs repair and repair if necessary

    Args:
        video_path: Path to the video file

    Returns:
        tuple: (needs_repair: bool, final_path: str, repaired: bool)
    """
    has_dimensions, metadata = check_video_has_dimensions(video_path)

    if has_dimensions:
        logger.info(f"Video {video_path} has valid dimensions: {metadata['width']}x{metadata['height']}")
        return False, video_path, False

    logger.info(f"Video {video_path} needs repair - missing dimensions")

    # Attempt repair
    success, repaired_path = repair_video(video_path)

    if success:
        # Replace original with repaired version
        try:
            os.remove(video_path)
            os.rename(repaired_path, video_path)
            logger.info(f"Original video replaced with repaired version")
            return True, video_path, True
        except Exception as e:
            logger.error(f"Error replacing original video: {e}")
            return True, repaired_path, True
    else:
        logger.error(f"Failed to repair video: {video_path}")
        return True, video_path, False
