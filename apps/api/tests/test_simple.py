"""Simple tests to verify test infrastructure is working."""
import pytest


def test_basic_math():
    """Test basic math to verify pytest is working."""
    assert 2 + 2 == 4


def test_string_operations():
    """Test string operations."""
    assert "hello".upper() == "HELLO"


def test_list_operations():
    """Test list operations."""
    test_list = [1, 2, 3]
    test_list.append(4)
    assert len(test_list) == 4
    assert test_list[-1] == 4


class TestBasicFunctionality:
    """Test class to verify class-based tests work."""

    def test_import_app(self):
        """Test that we can import the FastAPI app."""
        from app.main import app
        assert app is not None
        assert hasattr(app, 'title')

    def test_import_models(self):
        """Test that we can import models."""
        from app.models.user import User, UserRole
        assert User is not None
        assert UserRole is not None

    def test_import_schemas(self):
        """Test that we can import schemas."""
        from app.schemas.auth import LoginRequest, SignupRequest
        assert LoginRequest is not None
        assert SignupRequest is not None

    def test_import_crud(self):
        """Test that we can import CRUD operations."""
        from app.crud.user import create_user, get_user_by_email
        assert create_user is not None
        assert get_user_by_email is not None


@pytest.mark.asyncio
async def test_async_functionality():
    """Test that async tests work."""
    async def async_add(a, b):
        return a + b

    result = await async_add(2, 3)
    assert result == 5