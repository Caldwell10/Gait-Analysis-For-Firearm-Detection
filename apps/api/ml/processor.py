from pathlib import Path
from typing import Optional, List
import numpy as np
import cv2

def _clahe(gray: np.ndarray, clip: float = 2.0, grid: int = 8) -> np.ndarray:
    clahe = cv2.createCLAHE(clipLimit=clip, tileGridSize=(grid, grid))
    return clahe.apply(gray)

def _silhouette(gray: np.ndarray) -> np.ndarray:
    # normalize → denoise → adaptive threshold → morphology
    norm = cv2.normalize(gray, None, 0, 255, cv2.NORM_MINMAX)
    blur = cv2.GaussianBlur(norm, (5,5), 0)
    
    # try larger window & lower C for thermal silhouettes
    th = cv2.adaptiveThreshold(
        blur, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY,
        blockSize=31, C=-7
    )
    
    kernel = np.ones((3,3), np.uint8)
    opened = cv2.morphologyEx(th, cv2.MORPH_OPEN, kernel, iterations=1)
    closed = cv2.morphologyEx(opened, cv2.MORPH_CLOSE, kernel, iterations=1)
    
    return closed
def gei_from_video(video_path: str, target_size: int = 64,
                   clahe_clip: float = 2.0, clahe_grid: int = 8,
                   max_frames: Optional[int] = None) -> np.ndarray:
    """Compute GEI = mean of silhouettes (float32 in [0,1])."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {video_path}")

    acc = None
    n = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY) if frame.ndim == 3 else frame
        gray = _clahe(gray, clahe_clip, clahe_grid)
        mask = _silhouette(gray).astype(np.float32) / 255.0
        mask = cv2.resize(mask, (target_size, target_size), interpolation=cv2.INTER_AREA)
        acc = mask if acc is None else (acc + mask)
        n += 1
        if max_frames is not None and n >= max_frames:
            break
    cap.release()

    if acc is None or n == 0:
        raise RuntimeError(f"No frames processed: {video_path}")
    return (acc / n).clip(0.0, 1.0)

def list_videos(root: str | Path, subdir: str) -> List[Path]:
    p = Path(root) / subdir
    if not p.exists():
        raise FileNotFoundError(f"Missing thermal folder: {p}")
    vids = [*p.rglob("*.mp4"), *p.rglob("*.avi"), *p.rglob("*.mov")]
    if len(vids) == 0:
        raise RuntimeError(f"No videos found under {p}")
    return vids
