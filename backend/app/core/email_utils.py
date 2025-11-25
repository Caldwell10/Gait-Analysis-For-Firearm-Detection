import logging
import smtplib
from email.message import EmailMessage
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.image import MIMEImage
from typing import Iterable, Optional
from pathlib import Path

from .config import settings

logger = logging.getLogger(__name__)


def send_email(subject: str, body: str, recipients: Iterable[str], inline_image_path: Optional[str] = None) -> bool:
    recipients = [addr.strip() for addr in recipients if addr and addr.strip()]
    if not recipients:
        logger.debug("No recipients provided for email; skipping send.")
        return False

    server_host = settings.smtp_server
    server_port = settings.smtp_port
    username = settings.smtp_username
    password = settings.smtp_password
    use_tls = settings.smtp_use_tls
    sender = settings.smtp_sender or username or "no-reply@localhost"

    if not server_host or not server_port:
        logger.warning("SMTP server configuration missing; cannot send email.")
        return False

    # Create message with inline image if provided
    if inline_image_path and Path(inline_image_path).exists():
        message = MIMEMultipart("related")
        message["Subject"] = subject
        message["From"] = sender
        message["To"] = ", ".join(recipients)

        # Add text body with reference to inline image
        html_body = f"""<html>
<body>
<pre style="font-family: monospace; font-size: 14px;">{body}</pre>

<hr style="margin: 20px 0; border: none; border-top: 1px solid #ccc;">

<h3 style="color: #333;">GEI (Gait Energy Image) Visualization</h3>
<p style="color: #666; font-size: 12px;">
Technical visualization of the gait pattern analyzed by the ML model.
Brighter areas indicate higher motion energy during the gait cycle.
</p>
<img src="cid:gei_image" style="max-width: 400px; border: 2px solid #333; border-radius: 8px;">
</body>
</html>"""

        html_part = MIMEText(html_body, "html")
        message.attach(html_part)

        # Attach inline image
        try:
            with open(inline_image_path, "rb") as img_file:
                img_data = img_file.read()
                img = MIMEImage(img_data, name=Path(inline_image_path).name)
                img.add_header("Content-ID", "<gei_image>")
                img.add_header("Content-Disposition", "inline", filename=Path(inline_image_path).name)
                message.attach(img)
                logger.info("GEI image attached to email: %s", inline_image_path)
        except Exception as e:
            logger.warning("Failed to attach GEI image to email: %s", e)
    else:
        # Plain text email without image
        message = EmailMessage()
        message["Subject"] = subject
        message["From"] = sender
        message["To"] = ", ".join(recipients)
        message.set_content(body)

    try:
        with smtplib.SMTP(server_host, server_port, timeout=10) as smtp:
            if use_tls:
                smtp.starttls()
            if username and password:
                smtp.login(username, password)
            smtp.send_message(message)
        logger.info("Alert email sent to %s", ", ".join(recipients))
        return True
    except Exception as exc:
        logger.error("Failed to send email: %s", exc)
        return False
