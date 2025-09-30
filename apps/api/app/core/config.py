from pydantic_settings import BaseSettings
from typing import List
import os


class Settings(BaseSettings):
    # Database Configuration
    database_url: str = "postgresql://thermal_user:thermal_password@localhost:5432/thermal_gait_db"

    # Security & Authentication
    secret_key: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    jwt_secret_key: str = ""  # Backward compatibility
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    jwt_algorithm: str = "HS256"  # Backward compatibility
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
    bcrypt_rounds: int = 12

    # SMTP Configuration
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""

    # Admin User Configuration
    first_admin_email: str = os.getenv("FIRST_ADMIN_EMAIL", "admin@yourdomain.com")
    first_admin_password: str = os.getenv("FIRST_ADMIN_PASSWORD", "change-this-password")

    # CORS Settings
    cors_origins: str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000")
    allowed_origins_str: str = "http://localhost:3000,http://127.0.0.1:3000"  # Backward compatibility

    # File Upload Configuration
    upload_base_dir: str = os.getenv("UPLOAD_BASE_DIR", "uploads")
    max_file_size_mb: int = int(os.getenv("MAX_FILE_SIZE_MB", "100"))
    video_upload_dir: str = "./uploads/videos"  # Backward compatibility
    max_video_size_mb: int = 500  # Backward compatibility

    # ML Configuration will be added when needed for model training

    # Processing Configuration
    default_page_size: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
    max_page_size: int = int(os.getenv("MAX_PAGE_SIZE", "100"))
    processing_timeout_seconds: int = int(os.getenv("PROCESSING_TIMEOUT_SECONDS", "300"))

    # Development Settings
    debug: bool = os.getenv("DEBUG", "false").lower() == "true"
    log_level: str = os.getenv("LOG_LEVEL", "INFO")

    # App Metadata
    app_name: str = "Thermal Gait Surveillance API"
    version: str = "1.0.0"
    description: str = "Authentication and gait analysis API for thermal surveillance system"
    
    class Config:
        env_file = ".env"
    
    @property
    def allowed_origins(self) -> List[str]:
        """Convert comma-separated string to list."""
        return [origin.strip() for origin in self.allowed_origins_str.split(",")]


settings = Settings()