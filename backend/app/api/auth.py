import uuid
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from typing import List
from ..core.database import get_db
from ..core.security import (
    create_access_token, decode_access_token,
    generate_password_reset_token, verify_reset_token
)
from ..core.oauth import oauth
from ..core.config import settings
from ..schemas.auth import (
    SignupRequest, LoginRequest, LoginResponse,
    ForgotPasswordRequest, ResetPasswordRequest, UserResponse,
    CreateUserRequest, UpdateUserRoleRequest, UsersListResponse, TokenData
)
from ..models.user import User, UserRole
from ..crud.user import (
    get_user_by_email, create_user, authenticate_user, update_user_last_login,
    get_users, get_users_count, update_user_role, activate_user, deactivate_user,
    get_user_by_id, create_password_reset_token, get_valid_reset_token,
    mark_reset_token_used, update_user_password, create_user_session,
    revoke_user_session, is_session_revoked, get_user_by_oauth, create_oauth_user
)

router = APIRouter(prefix="/auth", tags=["authentication"])


# Dependency to get current user from JWT token
async def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Get current authenticated user from JWT token in cookies or Authorization header."""
    # Try cookie first (for same-origin requests)
    token = request.cookies.get("access_token")

    # If no cookie, try Authorization header (for cross-origin requests)
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            token = auth_header.split(" ")[1]

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
        httponly=False,  # Temporarily disable HttpOnly for debugging
        secure=False,  # Set to False for localhost development
        samesite="lax",
        path="/",  # Explicitly set path
        domain=None  # Allow cross-origin requests in development
    )
    
    return LoginResponse(message="Login successful", access_token=token)


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
        last_login=current_user.last_login,
        created_at=current_user.created_at,
        is_active=current_user.is_active
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
            last_login=updated_user.last_login,
            created_at=updated_user.created_at,
            is_active=updated_user.is_active
        )
    
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid user ID format"
        )

# OAuth Endpoints
@router.get("/oauth/{provider}/login")
async def oauth_login(provider: str, request: Request):
    """Initiate OAuth flow for Google or GitHub"""
    if provider not in ['google', 'github']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}"
        )

    # Redirect URI for OAuth callback
    redirect_uri = request.url_for('oauth_callback', provider=provider)

    return await oauth.create_client(provider).authorize_redirect(request, redirect_uri)


@router.get("/oauth/{provider}/callback")
async def oauth_callback(provider: str, request: Request, db: Session = Depends(get_db)):
    """Handle OAuth callback from Google or GitHub"""
    if provider not in ['google', 'github']:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported OAuth provider: {provider}"
        )

    try:
        # Get OAuth token
        token = await oauth.create_client(provider).authorize_access_token(request)

        # Get user info from provider
        if provider == 'google':
            user_info = token.get('userinfo')
            if not user_info:
                user_info = await oauth.google.userinfo(token=token)
            oauth_id = user_info['sub']
            email = user_info['email']
        elif provider == 'github':
            user_info = await oauth.github.get('user', token=token)
            user_data = user_info.json()
            oauth_id = str(user_data['id'])
            email = user_data.get('email')

            # GitHub might not return email if private
            if not email:
                emails = await oauth.github.get('user/emails', token=token)
                email_data = emails.json()
                primary_email = next((e for e in email_data if e['primary']), None)
                if primary_email:
                    email = primary_email['email']
                else:
                    raise HTTPException(
                        status_code=status.HTTP_400_BAD_REQUEST,
                        detail="Could not retrieve email from GitHub"
                    )

        # Check if user exists by OAuth credentials
        user = get_user_by_oauth(db, provider, oauth_id)

        if not user:
            # Check if email already exists (user might have created account with password)
            user = get_user_by_email(db, email)

            if user:
                # Link OAuth to existing account
                user.oauth_provider = provider
                user.oauth_id = oauth_id
                db.commit()
                db.refresh(user)
            else:
                # Create new OAuth user
                user = create_oauth_user(db, email, provider, oauth_id)

        # Update last login
        update_user_last_login(db, user.id)

        # Create JWT token
        token_data = {
            "user_id": str(user.id),
            "email": user.email,
            "role": user.role,
            "jti": str(uuid.uuid4())
        }

        access_token = create_access_token(token_data)
        expires_at = datetime.utcnow() + timedelta(minutes=15)

        # Store session in database
        create_user_session(db, user.id, token_data["jti"], expires_at)

        # Prepare redirect response to frontend callback handler
        redirect_url = f"{settings.frontend_oauth_redirect_url}?provider={provider}&token={access_token}"
        redirect_response = RedirectResponse(url=redirect_url, status_code=303)

        # Set cookie on redirect response for same-origin clients (optional in dev)
        redirect_response.set_cookie(
            key="access_token",
            value=access_token,
            max_age=900,  # 15 minutes
            httponly=False,
            secure=False,  # Set to False for localhost development
            samesite="lax",
            path="/",
            domain=None
        )

        return redirect_response

    except Exception as e:
        print(f"OAuth error for {provider}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"OAuth authentication failed: {str(e)}"
        )
