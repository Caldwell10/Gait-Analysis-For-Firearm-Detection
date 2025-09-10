from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
from .core.config import settings
from .core.database import create_tables
from .api.auth import router as auth_router
from .crud.user import get_users_count, create_user
from .models.user import UserRole
from .core.database import SessionLocal


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(" Starting Thermal Gait Surveillance API...")
    
    # Create database tables
    create_tables()
    print(" Database tables created")
    
    # Create first admin user
    db = SessionLocal()
    try:
        user_count = get_users_count(db)
        if user_count == 0:
            create_user(
                db, 
                settings.first_admin_email, 
                settings.first_admin_password, 
                UserRole.ADMIN
            )
            print(f" Created first admin user: {settings.first_admin_email}")
        else:
            print(f" Found {user_count} existing users")
    finally:
        db.close()
    
    print(" API startup complete!")
    
    yield
    
    # Shutdown
    print(" Shutting down API...")


# Create FastAPI application
app = FastAPI(
    title=settings.app_name,
    version=settings.version,
    description=settings.description,
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)


@app.get("/")
async def root():
    """API health check endpoint."""
    return {
        "message": "Thermal Gait Surveillance API",
        "version": settings.version,
        "status": "online"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint for monitoring."""
    return {"status": "healthy", "timestamp": "2024-01-01T00:00:00Z"}