"""
OAuth Configuration for Google and GitHub authentication
"""
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config

# Load environment variables
config = Config('.env')

# OAuth configuration
oauth = OAuth()

# Google OAuth
oauth.register(
    name='google',
    client_id=config('GOOGLE_CLIENT_ID', default=''),
    client_secret=config('GOOGLE_CLIENT_SECRET', default=''),
    server_metadata_url='https://accounts.google.com/.well-known/openid-configuration',
    client_kwargs={
        'scope': 'openid email profile'
    }
)

# GitHub OAuth
oauth.register(
    name='github',
    client_id=config('GITHUB_CLIENT_ID', default=''),
    client_secret=config('GITHUB_CLIENT_SECRET', default=''),
    authorize_url='https://github.com/login/oauth/authorize',
    authorize_params=None,
    access_token_url='https://github.com/login/oauth/access_token',
    access_token_params=None,
    refresh_token_url=None,
    redirect_uri=None,
    client_kwargs={'scope': 'user:email'},
)
