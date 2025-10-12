import logging
import smtplib
from email.message import EmailMessage
from typing import Iterable

from .config import settings

logger = logging.getLogger(__name__)


def send_email(subject: str, body: str, recipients: Iterable[str]) -> bool:
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
