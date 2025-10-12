import logging
from typing import Optional

from ..core.config import settings
from ..core.email_utils import send_email
from ..models.user import VideoRecord

logger = logging.getLogger(__name__)


def notify_threat_detected(video: VideoRecord, analysis_results: dict) -> bool:
    recipients = settings.alert_email_recipients
    if not recipients:
        logger.debug("Alert email skipped: no recipients configured.")
        return False

    confidence = analysis_results.get("confidence_score") or analysis_results.get("threat_confidence")
    confidence_pct = None
    if confidence is not None:
        try:
            confidence_pct = float(confidence) * 100 if isinstance(confidence, (float, int)) or str(confidence).replace('.', '', 1).isdigit() else None
        except Exception:
            confidence_pct = None

    subject = f"[Thermal Gait] Threat detected: {video.original_filename}"

    link = f"{settings.frontend_base_url.rstrip('/')}/videos/detail?id={video.id}"

    body_lines = [
        "Immediate attention required.",
        "",
        f"Video: {video.original_filename}",
        f"Video ID: {video.id}",
    ]

    if confidence_pct is not None:
        body_lines.append(f"Confidence: {confidence_pct:.1f}%")

    combined_score = analysis_results.get("combined_score")
    if combined_score is not None:
        body_lines.append(f"Combined score: {combined_score}")

    body_lines.extend([
        "",
        f"View session: {link}",
        "",
        "This alert was generated automatically by the Thermal Gait Surveillance system."
    ])

    # Get GEI path if available
    gei_path = analysis_results.get("gei_path")

    sent = send_email(
        subject=subject,
        body="\n".join(body_lines),
        recipients=recipients,
        inline_image_path=gei_path
    )
    if not sent:
        logger.warning("Threat alert email could not be delivered.")
    return sent
