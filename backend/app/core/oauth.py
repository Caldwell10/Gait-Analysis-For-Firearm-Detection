"""
OAuth configuration module for Google and GitHub authentication.
"""
from authlib.integrations.starlette_client import OAuth
from .config import settings

# OAuth configuration
oauth = OAuth()

# Google OAuth
oauth.register(
    name='google',
    client_id=settings.google_client_id,
    client_secret=settings.google_client_secret,
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# GitHub OAuth
oauth.register(
    name='github',
    client_id=settings.github_client_id,
    client_secret=settings.github_client_secret,
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    refresh_token_url=None,
    redirect_uri=None,
    api_base_url='https://api.github.com/',
    client_kwargs={'scope': 'user:email'},
)
