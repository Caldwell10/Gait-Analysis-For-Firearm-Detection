import asyncio
import os
import pytest
import tempfile
from pathlib import Path
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from httpx import AsyncClient
from faker import Faker

from app.main import app
from app.core.database import Base, get_db
from app.core.security import create_access_token
from app.models.user import User, UserRole
from app.core.config import settings

# Test database setup - use in-memory database for tests
TEST_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False  # Set to True for SQL debugging
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

fake = Faker()

@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()

@pytest.fixture(scope="function")
def db_session():
    """Create a fresh database session for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

@pytest.fixture(scope="function")
def override_get_db(db_session):
    """Override the get_db dependency."""
    def _override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _override_get_db
    yield
    app.dependency_overrides.clear()

@pytest.fixture
async def client(override_get_db):
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
def admin_user(db_session):
    """Create an admin user for testing."""
    from app.crud.user import create_user
    from app.schemas.auth import CreateUserRequest

    user_data = CreateUserRequest(
        email="admin@test.com",
        password="testpassword123",
        role=UserRole.ADMIN
    )
    user = create_user(db=db_session, user=user_data)
    return user

@pytest.fixture
def security_user(db_session):
    """Create a security personnel user for testing."""
    from app.crud.user import create_user
    from app.schemas.auth import CreateUserRequest

    user_data = CreateUserRequest(
        email="security@test.com",
        password="testpassword123",
        role=UserRole.SECURITY_PERSONNEL
    )
    user = create_user(db=db_session, user=user_data)
    return user

@pytest.fixture
def admin_token(admin_user):
    """Create an access token for admin user."""
    token_data = {
        "user_id": str(admin_user.id),
        "email": admin_user.email,
        "role": admin_user.role
    }
    return create_access_token(data=token_data)

@pytest.fixture
def security_token(security_user):
    """Create an access token for security personnel user."""
    token_data = {
        "user_id": str(security_user.id),
        "email": security_user.email,
        "role": security_user.role
    }
    return create_access_token(data=token_data)

@pytest.fixture
def admin_headers(admin_token):
    """Create headers with admin authorization."""
    return {"Authorization": f"Bearer {admin_token}"}

@pytest.fixture
def security_headers(security_token):
    """Create headers with security personnel authorization."""
    return {"Authorization": f"Bearer {security_token}"}

@pytest.fixture
def sample_video_file():
    """Create a temporary video file for testing."""
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as temp_file:
        # Write minimal MP4 header for testing
        temp_file.write(b'\x00\x00\x00\x20ftypmp42')
        temp_file.write(b'\x00' * 1024)  # 1KB of data
        temp_file.flush()
        yield temp_file.name

    # Cleanup
    try:
        os.unlink(temp_file.name)
    except FileNotFoundError:
        pass

@pytest.fixture
def invalid_file():
    """Create a temporary invalid file for testing."""
    with tempfile.NamedTemporaryFile(suffix=".txt", delete=False) as temp_file:
        temp_file.write(b'This is not a video file')
        temp_file.flush()
        yield temp_file.name

    # Cleanup
    try:
        os.unlink(temp_file.name)
    except FileNotFoundError:
        pass

@pytest.fixture
def uploaded_video(db_session, security_user):
    """Create a sample uploaded video record."""
    from app.models.user import VideoRecord
    import uuid

    video = VideoRecord(
        id=uuid.uuid4(),
        filename="test_video.mp4",
        original_filename="original_test.mp4",
        file_path="/uploads/videos/test/path.mp4",
        file_size="1.5MB",
        uploaded_by=security_user.id,
        analysis_status="pending",
        description="Test video for analysis"
    )
    db_session.add(video)
    db_session.commit()
    db_session.refresh(video)
    return video

@pytest.fixture
def sample_analysis(db_session, uploaded_video, security_user):
    """Create a sample analysis record."""
    from app.models.user import GaitAnalysis
    import uuid

    analysis = GaitAnalysis(
        id=uuid.uuid4(),
        video_id=uploaded_video.id,
        analysis_data={
            "reconstruction_error": 0.15,
            "latent_score": 0.82,
            "combined_score": 0.179
        },
        confidence_score="92%",
        threat_detected=True,
        threat_confidence="85%",
        threat_details={
            "threat_level": "HIGH",
            "indicators": ["abnormal gait pattern"]
        },
        algorithm_version="v1.0",
        processing_time="2.3s",
        analyzed_by=security_user.id
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)
    return analysis

@pytest.fixture
def temp_upload_dir():
    """Create a temporary upload directory for testing."""
    with tempfile.TemporaryDirectory() as temp_dir:
        uploads_dir = Path(temp_dir) / "uploads"
        uploads_dir.mkdir(exist_ok=True)

        # Override the upload directory in settings
        original_upload_dir = getattr(settings, 'UPLOAD_BASE_DIR', None)
        settings.UPLOAD_BASE_DIR = uploads_dir

        yield uploads_dir

        # Restore original setting
        if original_upload_dir:
            settings.UPLOAD_BASE_DIR = original_upload_dir

# Helper functions for tests
def create_test_user_data(role=UserRole.SECURITY_PERSONNEL):
    """Create test user data."""
    return {
        "email": fake.email(),
        "password": "testpassword123",
        "role": role.value if hasattr(role, 'value') else role
    }

def create_test_video_data():
    """Create test video data."""
    return {
        "description": fake.text(max_nb_chars=200),
        "tags": f"{fake.word()},{fake.word()},{fake.word()}",
        "subject_id": fake.uuid4()
    }

def create_test_analysis_data():
    """Create test analysis data."""
    return {
        "analysis_data": {
            "reconstruction_error": fake.pyfloat(min_value=0, max_value=1),
            "latent_score": fake.pyfloat(min_value=0, max_value=1),
            "combined_score": fake.pyfloat(min_value=0, max_value=1)
        },
        "confidence_score": f"{fake.random_int(min=60, max=99)}%",
        "threat_detected": fake.boolean(),
        "threat_confidence": f"{fake.random_int(min=50, max=95)}%",
        "algorithm_version": f"v{fake.random_int(min=1, max=5)}.{fake.random_int(min=0, max=9)}",
        "processing_time": f"{fake.pyfloat(min_value=1, max_value=10):.1f}s"
    }