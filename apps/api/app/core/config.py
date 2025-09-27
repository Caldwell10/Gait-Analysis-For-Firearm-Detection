from pydantic_settings import BaseSettings
from typing import List


class Settings(BaseSettings):
    database_url: str = "postgresql://thermal_user:thermal_password@localhost:5432/thermal_gait_db"
    
    # Security
    jwt_secret_key: str = ""
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    bcrypt_rounds: int = 12
    
    # SMTP
    smtp_server: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    
    # Admin setup
    first_admin_email: str = "wachirakibe6@gmail.com"
    first_admin_password: str = "admin123"
    
    # CORS settings
    allowed_origins_str: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    # Video storage for gait analysis
    video_upload_dir: str = "./uploads/videos"
    max_video_size_mb: int = 500
    
    # App metadata
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