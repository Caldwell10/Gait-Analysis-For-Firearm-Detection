#!/usr/bin/env python3
"""
Simple test script to verify the authentication API is working.
Run this after setting up the database and starting the server.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_api_health():
    """Test if API is running."""
    try:
        response = requests.get(f"{BASE_URL}/")
        if response.status_code == 200:
            print(" API is running:", response.json())
            return True
        else:
            print(" API health check failed:", response.status_code)
            return False
    except requests.exceptions.ConnectionError:
        print(" Cannot connect to API. Make sure server is running on port 8000")
        return False

def test_admin_login():
    """Test admin login."""
    try:
        login_data = {
            "email": "wachirakibe6@gmail.com",
            "password": "admin123"
        }
        response = requests.post(f"{BASE_URL}/auth/login", json=login_data)
        if response.status_code == 200:
            print(" Admin login successful:", response.json())
            return response.cookies
        else:
            print(" Admin login failed:", response.status_code, response.text)
            return None
    except Exception as e:
        print(" Admin login error:", str(e))
        return None

def test_user_registration():
    """Test user registration."""
    try:
        user_data = {
            "email": "test@example.com",
            "password": "password123"
        }
        response = requests.post(f"{BASE_URL}/auth/signup", json=user_data)
        if response.status_code == 200:
            print(" User registration successful:", response.json())
            return True
        elif response.status_code == 400 and "already registered" in response.text:
            print("ℹ User already exists - this is fine")
            return True
        else:
            print(" User registration failed:", response.status_code, response.text)
            return False
    except Exception as e:
        print(" User registration error:", str(e))
        return False

def test_protected_endpoint(cookies):
    """Test accessing protected endpoint with authentication."""
    if not cookies:
        print(" No cookies available for protected endpoint test")
        return False
    
    try:
        response = requests.get(f"{BASE_URL}/auth/me", cookies=cookies)
        if response.status_code == 200:
            user_info = response.json()
            print(" Protected endpoint access successful:")
            print(f"   - User: {user_info['email']}")
            print(f"   - Role: {user_info['role']}")
            print(f"   - 2FA Enabled: {user_info['totp_enabled']}")
            return True
        else:
            print(" Protected endpoint access failed:", response.status_code, response.text)
            return False
    except Exception as e:
        print(" Protected endpoint error:", str(e))
        return False

def main():
    """Run all tests."""
    print("🧪 Testing Authentication API\n")
    
    # Test 1: API Health
    print("1. Testing API Health...")
    if not test_api_health():
        return
    
    print("\n2. Testing Admin Login...")
    cookies = test_admin_login()
    
    print("\n3. Testing User Registration...")
    test_user_registration()
    
    print("\n4. Testing Protected Endpoint...")
    test_protected_endpoint(cookies)
    
    print("\n Testing complete! Check results above.")
    print("\nNext steps:")
    print("- Visit http://localhost:8000/docs for API documentation")
    print("- Start your frontend: cd ../pwa && npm run dev")

if __name__ == "__main__":
    main()