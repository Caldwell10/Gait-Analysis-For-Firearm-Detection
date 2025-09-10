
"""
Development server runner for the authentication API.
This script helps start the server with proper settings.
"""

import uvicorn
import os
import sys

def main():
    """Run the development server."""
    print(" Starting Thermal Gait Surveillance API...")
    print(" Server will be available at: http://localhost:8000")
    print(" API docs will be available at: http://localhost:8000/docs")
    print(" Press CTRL+C to stop the server\n")
    
    try:
        uvicorn.run(
            "app.main:app",
            host="127.0.0.1",
            port=8000,
            reload=True,
            reload_dirs=["app"],
            log_level="info"
        )
    except KeyboardInterrupt:
        print("\n Server stopped by user")
    except Exception as e:
        print(f" Server error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()