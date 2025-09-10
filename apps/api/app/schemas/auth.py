from datetime import datetime
from typing import Optional
from pydantic import BaseModel, EmailStr
from ..models.user import UserRole


# Request schemas (input validation)
class SignupRequest(BaseModel):
    email: EmailStr
    password: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TotpVerifyRequest(BaseModel):
    code: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    password: str


class CreateUserRequest(BaseModel):
    email: EmailStr
    password: str
    role: Optional[UserRole] = UserRole.SECURITY_PERSONNEL


class UpdateUserRoleRequest(BaseModel):
    role: UserRole


# Response schemas (output serialization)
class LoginResponse(BaseModel):
    totp_required: bool


class TotpSetupResponse(BaseModel):
    secret: str
    otpauth_url: str


class TotpVerifyResponse(BaseModel):
    verified: bool


class UserResponse(BaseModel):
    id: str
    email: str
    role: UserRole
    totp_enabled: bool
    last_login: Optional[datetime] = None
    created_at: datetime
    is_active: bool

    class Config:
        from_attributes = True


class UsersListResponse(BaseModel):
    users: list[UserResponse]
    total: int
    page: int
    per_page: int


# Token schemas
class TokenData(BaseModel):
    user_id: str
    email: str
    role: str