"""
ML Service for Real-time Gait Analysis and Threat Detection
Integrates ConvAutoencoder model with FastAPI for production inference
"""
import os
import time
import logging
import torch
import numpy as np
import cv2
from pathlib import Path
from typing import Dict, Optional, Tuple
from sklearn.metrics.pairwise import euclidean_distances

from .model import ConvAutoencoder
from .processor import gei_from_video
from .utils import device_auto, load_yaml

# Configure logging for calibration
logger = logging.getLogger(__name__)

# Configurable threshold via environment variable (default: 0.50 calibrated for UCLM data)
ML_THREAT_THRESHOLD = float(os.getenv("ML_THREAT_THRESHOLD", "0.50"))


class GaitAnalysisService:
    """Singleton service for ML inference"""

    _instance = None
    _initialized = False

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        if not self._initialized:
            self.device = None
            self.model = None
            self.config = None
            self.threshold = ML_THREAT_THRESHOLD  # Configurable via ML_THREAT_THRESHOLD env var
            self._latent_mean = None
            self._latent_cov_inv = None
            type(self)._initialized = True
            logger.info(f"ML Service initialized with threshold={self.threshold} (set ML_THREAT_THRESHOLD env var to adjust)")

    def load_model(self, model_path: Optional[str] = None, config_path: Optional[str] = None):
        """Load trained model and configuration"""
        if self.model is not None:
            print("⚡ Model already loaded - using cached instance")
            return

        # Set default paths
        ml_dir = Path(__file__).parent
        if model_path is None:
            model_path = ml_dir / "models" / "autoencoder.pt"
        if config_path is None:
            config_path = ml_dir / "config.yaml"

        # Load configuration
        print(f"📋 Loading config from: {config_path}")
        self.config = load_yaml(str(config_path))

        # Initialize device
        self.device = device_auto()

        # Initialize model architecture
        model_config = self.config['model']
        self.model = ConvAutoencoder(
            latent_dim=model_config['latent_dim'],
            base_channels=model_config['base_channels'],
            dropout=model_config['dropout']
        )

        # Load trained weights
        print(f"🔧 Loading model weights from: {model_path}")
        checkpoint = torch.load(model_path, map_location=self.device)

        # Handle different checkpoint formats
        if isinstance(checkpoint, dict) and 'model_state_dict' in checkpoint:
            self.model.load_state_dict(checkpoint['model_state_dict'])
            # Load latent statistics if available
            if 'latent_mean' in checkpoint:
                self._latent_mean = checkpoint['latent_mean'].to(self.device)
            if 'latent_cov_inv' in checkpoint:
                self._latent_cov_inv = checkpoint['latent_cov_inv'].to(self.device)
        else:
            # Direct state dict
            self.model.load_state_dict(checkpoint)

        self.model.to(self.device)
        self.model.eval()

        print(f"✅ Model loaded successfully on {self.device}")
        print(f"📊 Model architecture: latent_dim={model_config['latent_dim']}, base_channels={model_config['base_channels']}")

    def _compute_reconstruction_error(self, gei_tensor: torch.Tensor) -> float:
        """Compute per-sample reconstruction error"""
        with torch.no_grad():
            recon = self.model(gei_tensor)
            error = torch.mean((recon - gei_tensor) ** 2, dim=[1, 2, 3])
            return float(error.item())

    def _compute_latent_distance(self, gei_tensor: torch.Tensor) -> float:
        """Compute Mahalanobis distance in latent space"""
        with torch.no_grad():
            # Get latent representation
            z = self.model.encoder(gei_tensor)  # (1, latent_dim)

            # If we don't have precomputed statistics, use simple Euclidean distance from origin
            if self._latent_mean is None or self._latent_cov_inv is None:
                # Fallback: L2 distance from zero vector (normalized)
                distance = torch.norm(z, p=2, dim=1)
                return float(distance.item())

            # Mahalanobis distance: sqrt((z - μ)^T Σ^-1 (z - μ))
            diff = z - self._latent_mean
            mahal_dist = torch.sqrt(torch.sum(diff @ self._latent_cov_inv * diff, dim=1))
            return float(mahal_dist.item())

    def analyze_video(self, video_path: str, save_gei: bool = True) -> Dict:
        """
        Main analysis pipeline: Video → GEI → Anomaly Detection

        Args:
            video_path: Path to thermal video file
            save_gei: Whether to save GEI image to disk (default: True)

        Returns:
            Dictionary with analysis results
        """
        start_time = time.time()

        # Ensure model is loaded
        if self.model is None:
            self.load_model()

        try:
            # Step 1: Generate GEI from video
            print(f"🎥 Processing video: {video_path}")
            gei_array = gei_from_video(
                video_path=video_path,
                target_size=self.config['data']['image_size'],
                clahe_clip=self.config['processing']['clahe_clip'],
                clahe_grid=self.config['processing']['clahe_grid']
            )

            # Save GEI image to disk for visualization
            gei_path = None
            if save_gei:
                gei_path = self._save_gei_image(video_path, gei_array)

            # Step 2: Prepare tensor for model (add batch and channel dims)
            gei_tensor = torch.from_numpy(gei_array).float()
            gei_tensor = gei_tensor.unsqueeze(0).unsqueeze(0)  # (1, 1, 64, 64)
            gei_tensor = gei_tensor.to(self.device)

            # Step 3: Compute anomaly scores
            recon_error = self._compute_reconstruction_error(gei_tensor)
            latent_score = self._compute_latent_distance(gei_tensor)

            # Step 4: Combined score (as per training methodology)
            combined_score = 0.5 * recon_error + 0.5 * latent_score

            # === CALIBRATION LOG: Raw scores for threshold tuning ===
            logger.warning(
                "CALIBRATION | video=%s | recon_error=%.6f | latent_score=%.6f | "
                "combined_score=%.6f | threshold=%.6f | delta=%.6f",
                Path(video_path).name,
                recon_error,
                latent_score,
                combined_score,
                self.threshold,
                combined_score - self.threshold
            )

            # Step 5: Threat detection
            threat_detected = combined_score >= self.threshold

            # Step 6: Calculate confidence
            # Confidence is how far we are from threshold (normalized)
            distance_from_threshold = abs(combined_score - self.threshold)
            confidence = min(0.5 + distance_from_threshold * 2.0, 0.99)  # Scale to [0.5, 0.99]

            processing_time = time.time() - start_time

            # Prepare results
            results = {
                "threat_detected": bool(threat_detected),
                "confidence_score": round(float(confidence), 3),
                "threat_confidence": round(float(confidence if threat_detected else 1 - confidence), 3),
                "combined_score": round(float(combined_score), 3),
                "reconstruction_error": round(float(recon_error), 3),
                "latent_score": round(float(latent_score), 3),
                "threshold": self.threshold,
                "processing_time": f"{processing_time:.2f}s",
                "algorithm_version": "ConvAutoencoder_v1.0_thermal_adapted",
                "model_config": {
                    "latent_dim": self.config['model']['latent_dim'],
                    "base_channels": self.config['model']['base_channels'],
                    "image_size": self.config['data']['image_size']
                },
                "gei_generated": True,
                "gei_path": gei_path,
                "device": str(self.device)
            }

            threat_status = "THREAT DETECTED" if threat_detected else "NORMAL"
            print(f"✅ Analysis complete: {threat_status} (confidence: {confidence:.3f}, time: {processing_time:.2f}s)")

            return results

        except Exception as e:
            print(f"❌ Analysis failed: {str(e)}")
            raise RuntimeError(f"ML analysis failed: {str(e)}")

    def _save_gei_image(self, video_path: str, gei_array: np.ndarray) -> Optional[str]:
        """
        Save GEI array as PNG image in the same directory as the video

        Args:
            video_path: Original video file path
            gei_array: GEI numpy array (float32 in [0,1])

        Returns:
            Path to saved GEI image or None if save failed
        """
        try:
            video_path_obj = Path(video_path)
            video_dir = video_path_obj.parent

            # Create gei subdirectory if it doesn't exist
            gei_dir = video_dir / "gei"
            gei_dir.mkdir(exist_ok=True)

            # Convert GEI from [0,1] float to [0,255] uint8 for image saving
            gei_image = (gei_array * 255).astype(np.uint8)

            # Apply colormap for better visualization (turbo is good for thermal data)
            gei_colored = cv2.applyColorMap(gei_image, cv2.COLORMAP_TURBO)

            # Save both grayscale and colored versions
            gei_gray_path = gei_dir / "gei_grayscale.png"
            gei_color_path = gei_dir / "gei.png"

            cv2.imwrite(str(gei_gray_path), gei_image)
            cv2.imwrite(str(gei_color_path), gei_colored)

            print(f"💾 GEI images saved: {gei_color_path}")
            return str(gei_color_path)

        except Exception as e:
            print(f"⚠️ Failed to save GEI image: {e}")
            return None


# Global service instance
_ml_service = None


def get_ml_service() -> GaitAnalysisService:
    """Get or create global ML service instance"""
    global _ml_service
    if _ml_service is None:
        _ml_service = GaitAnalysisService()
        _ml_service.load_model()  # Pre-load model at startup
    return _ml_service


def analyze_video_sync(video_path: str) -> Dict:
    """
    Synchronous wrapper for video analysis
    Use this in background tasks
    """
    service = get_ml_service()
    return service.analyze_video(video_path)
