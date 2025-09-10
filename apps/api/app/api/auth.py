import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.security import (
    create_access_token, decode_access_token, verify_totp, 
    generate_totp_uri, generate_password_reset_token, verify_reset_token
)
from ..schemas.auth import (
    SignupRequest, LoginRequest, LoginResponse, TotpSetupResponse, 
    TotpVerifyRequest, TotpVerifyResponse, ForgotPasswordRequest,
    ResetPasswordRequest, UserResponse, CreateUserRequest, 
    UpdateUserRoleRequest, UsersListResponse, TokenData
)
from ..models.user import User, UserRole
from ..crud.user import (
    get_user_by_email, create_user, authenticate_user, update_user_last_login,
    setup_user_totp, enable_user_totp, get_users, get_users_count,
    update_user_role, activate_user, deactivate_user, get_user_by_id,
    create_password_reset_token, get_valid_reset_token, mark_reset_token_used,
    update_user_password, create_user_session, revoke_user_session, is_session_revoked
)

router = APIRouter(prefix="/auth", tags=["authentication"])


# Dependency to get current user from JWT token
async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Get current authenticated user from JWT token in cookies."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated"
        )
    
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        token_jti = payload.get("jti")
        
        if not user_id or not token_jti:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        
        # Check if session is revoked
        if is_session_revoked(db, token_jti):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Session revoked"
            )
        
        user = get_user_by_id(db, uuid.UUID(user_id))
        if not user or not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found or inactive"
            )
        
        return user
    
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


# Dependency to require admin role
async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Require admin role for endpoint access."""
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user


@router.post("/signup")
async def signup(user_data: SignupRequest, db: Session = Depends(get_db)):
    """Register a new user (always creates security_personnel)."""
    # Check if user already exists
    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    # Create user with security_personnel role
    create_user(db, user_data.email, user_data.password, UserRole.SECURITY_PERSONNEL)
    return {"message": "User registered successfully"}


@router.post("/login", response_model=LoginResponse)
async def login(user_data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    """Authenticate user with email and password."""
    user = authenticate_user(db, user_data.email, user_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid credentials"
        )
    
    # Skip 2FA for now - complete login immediately
    update_user_last_login(db, user.id)
    
    token_data = {
        "user_id": str(user.id),
        "email": user.email,
        "role": user.role,
        "jti": str(uuid.uuid4())
    }
    
    token = create_access_token(token_data)
    expires_at = datetime.utcnow() + timedelta(minutes=15)
    
    # Store session in database
    create_user_session(db, user.id, token_data["jti"], expires_at)
    
    response.set_cookie(
        key="access_token",
        value=token,
        max_age=900,  # 15 minutes
        httponly=True,
        secure=False,  # Set to False for localhost development
        samesite="lax"
    )
    
    return LoginResponse(totp_required=False)


@router.post("/logout")
async def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """Logout user and revoke session."""
    token = request.cookies.get("access_token")
    if token:
        try:
            payload = decode_access_token(token)
            token_jti = payload.get("jti")
            if token_jti:
                revoke_user_session(db, token_jti)
        except:
            pass  # Token might be invalid, but still clear cookies
    
    response.delete_cookie("access_token")
    response.delete_cookie("temp_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def get_current_user_info(current_user: User = Depends(get_current_user)):
    """Get current user information."""
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        role=UserRole(current_user.role),  # Convert string to enum
        totp_enabled=current_user.totp_enabled,
        last_login=current_user.last_login,
        created_at=current_user.created_at,
        is_active=current_user.is_active
    )


@router.post("/totp/setup", response_model=TotpSetupResponse)
async def setup_totp(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Setup TOTP 2FA for user."""
    secret = setup_user_totp(db, current_user.id)
    otpauth_url = generate_totp_uri(secret, current_user.email)
    
    return TotpSetupResponse(
        secret=secret,
        otpauth_url=otpauth_url
    )


@router.post("/totp/verify", response_model=TotpVerifyResponse)
async def verify_totp_code(
    totp_data: TotpVerifyRequest, 
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Verify TOTP code and complete authentication."""
    # Get temp token from 2FA login or current user token
    temp_token = request.cookies.get("temp_token")
    access_token = request.cookies.get("access_token")
    
    token = temp_token or access_token
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No authentication token found"
        )
    
    try:
        payload = decode_access_token(token)
        user_id = payload.get("user_id")
        user = get_user_by_id(db, uuid.UUID(user_id))
        
        if not user or not user.totp_secret:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="TOTP not set up for user"
            )
        
        # Verify TOTP code
        if not verify_totp(user.totp_secret, totp_data.code):
            return TotpVerifyResponse(verified=False)
        
        # If this is first-time setup, enable TOTP
        if not user.totp_enabled:
            enable_user_totp(db, user.id)
        
        # If this was a temp token from login, create full session
        if temp_token:
            update_user_last_login(db, user.id)
            
            token_data = {
                "user_id": str(user.id),
                "email": user.email,
                "role": user.role,
                "jti": str(uuid.uuid4())
            }
            
            new_token = create_access_token(token_data)
            expires_at = datetime.utcnow() + timedelta(minutes=15)
            
            # Store session
            create_user_session(db, user.id, token_data["jti"], expires_at)
            
            response.set_cookie(
                key="access_token",
                value=new_token,
                max_age=900,
                httponly=True,
                secure=True,
                samesite="lax"
            )
            response.delete_cookie("temp_token")
        
        return TotpVerifyResponse(verified=True)
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token or verification failed"
        )


@router.post("/forgot-password")
async def forgot_password(request_data: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Request password reset (always returns success to prevent email enumeration)."""
    user = get_user_by_email(db, request_data.email)
    
    if user and user.is_active:
        # Generate reset token and store it
        reset_token = generate_password_reset_token()
        create_password_reset_token(db, user.id, reset_token)
        
        # TODO: Send email with reset_token
        # For now, we'll just log it (in production, send email)
        print(f"Password reset token for {user.email}: {reset_token}")
    
    # Always return success to prevent email enumeration
    return {"message": "If the email exists, a reset link has been sent"}


@router.post("/reset-password")
async def reset_password(request_data: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Reset password with token."""
    # This is a simplified implementation - in production you'd hash the token
    # and search by hash, but for now we'll search by email from token data
    
    # TODO: Implement proper token validation and user lookup
    # For now, return error as this needs email integration
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Password reset requires email integration"
    )


# Admin-only endpoints
@router.get("/users", response_model=UsersListResponse)
async def list_users(
    page: int = 1,
    per_page: int = 20,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """List all users (admin only)."""
    skip = (page - 1) * per_page
    users = get_users(db, skip=skip, limit=per_page)
    total = get_users_count(db)
    
    user_responses = [
        UserResponse(
            id=str(user.id),
            email=user.email,
            role=user.role,
            totp_enabled=user.totp_enabled,
            last_login=user.last_login,
            created_at=user.created_at,
            is_active=user.is_active
        )
        for user in users
    ]
    
    return UsersListResponse(
        users=user_responses,
        total=total,
        page=page,
        per_page=per_page
    )


@router.post("/users", response_model=UserResponse)
async def create_new_user(
    user_data: CreateUserRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Create new user (admin only)."""
    if get_user_by_email(db, user_data.email):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )
    
    new_user = create_user(db, user_data.email, user_data.password, user_data.role)
    
    return UserResponse(
        id=str(new_user.id),
        email=new_user.email,
        role=new_user.role,
        totp_enabled=new_user.totp_enabled,
        last_login=new_user.last_login,
        created_at=new_user.created_at,
        is_active=new_user.is_active
    )


@router.put("/users/{user_id}/role", response_model=UserResponse)
async def update_user_role_endpoint(
    user_id: str,
    role_data: UpdateUserRoleRequest,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Update user role (admin only)."""
    try:
        user_uuid = uuid.UUID(user_id)
        updated_user = update_user_role(db, user_uuid, role_data.role)
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            id=str(updated_user.id),
            email=updated_user.email,
            role=updated_user.role,
            totp_enabled=updated_user.totp_enabled,
            last_login=updated_user.last_login,
            created_at=updated_user.created_at,
            is_active=updated_user.is_active
        )
    
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )


@router.put("/users/{user_id}/active", response_model=UserResponse)
async def toggle_user_active_status(
    user_id: str,
    activate: bool,
    admin_user: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Activate or deactivate user (admin only)."""
    try:
        user_uuid = uuid.UUID(user_id)
        
        if activate:
            updated_user = activate_user(db, user_uuid)
        else:
            updated_user = deactivate_user(db, user_uuid)
        
        if not updated_user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="User not found"
            )
        
        return UserResponse(
            id=str(updated_user.id),
            email=updated_user.email,
            role=updated_user.role,
            totp_enabled=updated_user.totp_enabled,
            last_login=updated_user.last_login,
            created_at=updated_user.created_at,
            is_active=updated_user.is_active
        )
    
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )