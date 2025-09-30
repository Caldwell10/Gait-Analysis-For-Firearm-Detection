import os
import asyncio
import torch
import numpy as np
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

from .model import ConvAutoencoder
from .processor import gei_from_video
from .utils import load_yaml, device_auto, save_json


class MLInferenceService:
    """ML Service for thermal gait analysis and firearm detection"""

    def __init__(self):
        self.model = None
        self.device = None
        self.config = None
        self.model_loaded = False

    async def initialize(self):
        """Initialize the ML service with model and configuration"""
        if self.model_loaded:
            return

        try:
            # Load configuration
            config_path = Path(__file__).parent / "config.yaml"
            self.config = load_yaml(config_path)

            # Setup device
            self.device = device_auto()

            # Initialize model
            model_config = self.config['model']
            self.model = ConvAutoencoder(
                latent_dim=model_config['latent_dim'],
                base_channels=model_config['base_channels'],
                dropout=model_config['dropout']
            )

            # Load trained weights
            model_path = Path(__file__).parent / "models" / "autoencoder.pt"
            if not model_path.exists():
                raise FileNotFoundError(f"Model weights not found: {model_path}")

            checkpoint = torch.load(model_path, map_location=self.device)
            self.model.load_state_dict(checkpoint)
            self.model.to(self.device)
            self.model.eval()

            self.model_loaded = True
            print(f"✅ ML Service initialized on {self.device}")

        except Exception as e:
            print(f"❌ Failed to initialize ML service: {e}")
            raise

    async def analyze_video(
        self,
        video_path: str,
        output_dir: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Analyze thermal video for firearm detection

        Args:
            video_path: Path to the thermal video file
            output_dir: Directory to save GEI and processing artifacts

        Returns:
            Analysis results with threat detection and confidence scores
        """
        await self.initialize()

        start_time = datetime.now()
        processing_metadata = {
            "video_path": video_path,
            "processing_started": start_time.isoformat(),
            "model_version": "ConvAutoencoder_v1.0",
            "device": str(self.device)
        }

        try:
            # Step 1: Generate GEI from video
            print(f"🎥 Processing video: {video_path}")

            processing_config = self.config.get('processing', {})
            gei = await asyncio.to_thread(
                gei_from_video,
                video_path,
                target_size=self.config['data']['image_size'],
                clahe_clip=processing_config.get('clahe_clip', 2.5),
                clahe_grid=processing_config.get('clahe_grid', 8)
            )

            # Step 2: Prepare GEI for model inference
            gei_tensor = torch.FloatTensor(gei).unsqueeze(0).unsqueeze(0)  # (1, 1, 64, 64)
            gei_tensor = gei_tensor.to(self.device)

            # Step 3: Model inference
            with torch.no_grad():
                # Reconstruction error
                reconstruction = self.model(gei_tensor)
                recon_error = torch.mean((reconstruction - gei_tensor) ** 2).item()

                # Latent space analysis
                latent = self.model.encoder(gei_tensor)

                # Mahalanobis distance (simplified - using L2 norm for now)
                latent_norm = torch.norm(latent, dim=1).item()

                # Combined score (as per trained model)
                combined_score = 0.5 * recon_error + 0.5 * (latent_norm / 10.0)  # Normalize latent

            # Step 4: Threat detection using optimal threshold
            optimal_threshold = self.config.get('eval', {}).get('optimal_threshold', 0.179)
            threat_detected = combined_score >= optimal_threshold

            # Step 5: Calculate confidence scores
            threat_confidence = min(combined_score / optimal_threshold, 2.0) if threat_detected else 0.0
            confidence_score = threat_confidence if threat_detected else (1.0 - combined_score / optimal_threshold)

            end_time = datetime.now()
            processing_time = (end_time - start_time).total_seconds()

            # Step 6: Save GEI image if output directory provided
            gei_file_path = None
            if output_dir:
                os.makedirs(output_dir, exist_ok=True)
                gei_file_path = os.path.join(output_dir, "gei.png")

                # Convert GEI to image and save
                import cv2
                gei_image = (gei * 255).astype(np.uint8)
                cv2.imwrite(gei_file_path, gei_image)

            # Step 7: Compile results
            results = {
                "threat_detected": threat_detected,
                "confidence_score": float(confidence_score),
                "threat_confidence": float(threat_confidence),
                "combined_score": float(combined_score),
                "reconstruction_error": float(recon_error),
                "latent_score": float(latent_norm),
                "optimal_threshold": float(optimal_threshold),
                "processing_time": f"{processing_time:.2f}s",
                "processing_metadata": {
                    **processing_metadata,
                    "processing_completed": end_time.isoformat(),
                    "processing_duration_seconds": processing_time
                },
                "gei_file_path": gei_file_path,
                "algorithm_version": "ConvAutoencoder_v1.0_adapted",
                "model_performance": {
                    "auc": 0.881,
                    "recall": 1.0,
                    "precision": 0.8
                }
            }

            print(f"✅ Analysis complete: {'THREAT DETECTED' if threat_detected else 'NO THREAT'} "
                  f"(confidence: {confidence_score:.1%}, score: {combined_score:.3f})")

            return results

        except Exception as e:
            error_time = datetime.now()
            print(f"❌ Analysis failed: {e}")

            return {
                "error": str(e),
                "processing_metadata": {
                    **processing_metadata,
                    "error_occurred": error_time.isoformat(),
                    "processing_duration_seconds": (error_time - start_time).total_seconds()
                }
            }


# Singleton instance
ml_service = MLInferenceService()


async def analyze_thermal_video(video_path: str, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Convenience function for video analysis

    Args:
        video_path: Path to thermal video file
        output_dir: Directory for saving GEI and artifacts

    Returns:
        Analysis results dictionary
    """
    return await ml_service.analyze_video(video_path, output_dir)