# Authentication Backend Setup Instructions

## Prerequisites
- Python 3.8+
- PostgreSQL database
- Virtual environment (recommended)

## 1. Database Setup

### Install PostgreSQL (if not already installed)
```bash
# macOS (using Homebrew)
brew install postgresql
brew services start postgresql

# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql

# Windows: Download from https://www.postgresql.org/download/windows/
```

### Create Database and User
```sql
# Connect to PostgreSQL as superuser
psql -U postgres

# Create database and user
CREATE DATABASE thermal_gait_db;
CREATE USER thermal_user WITH PASSWORD 'thermal_password';
GRANT ALL PRIVILEGES ON DATABASE thermal_gait_db TO thermal_user;

# Exit psql
\q
```

### Test Database Connection
```bash
psql -U thermal_user -d thermal_gait_db -h localhost
# Enter password: thermal_password
# Should connect successfully, then \q to exit
```

## 2. Backend Setup

### Create Virtual Environment
```bash
cd apps/api

# Create virtual environment
python -m venv venv

# Activate virtual environment
# macOS/Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate
```

### Install Dependencies
```bash
pip install -r requirements.txt
```

## 3. Start the API Server

```bash
# Make sure you're in apps/api directory and venv is activated
uvicorn app.main:app --reload --port 8000
```

You should see:
```
🚀 Starting Thermal Gait Surveillance API...
📊 Database tables created
👑 Created first admin user: wachirakibe6@gmail.com
📈 Found X existing users
✅ API startup complete!
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
```

## 4. Test the API

### Check API Status
```bash
curl http://localhost:8000/
# Should return: {"message": "Thermal Gait Surveillance API", "version": "1.0.0", "status": "online"}
```

### Check API Documentation
Open in browser: http://localhost:8000/docs

### Test Admin Login
```bash
curl -X POST "http://localhost:8000/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "wachirakibe6@gmail.com", "password": "admin123"}' \
  -c cookies.txt
```

### Test User Registration
```bash
curl -X POST "http://localhost:8000/auth/signup" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

## 5. Frontend Integration

Your existing PWA frontend (apps/pwa) should work immediately:
```bash
# In another terminal, start the frontend
cd apps/pwa
npm run dev
```

The frontend at http://localhost:3000 will connect to the backend at http://localhost:8000

## First Admin User
- **Email**: wachirakibe6@gmail.com  
- **Password**: admin123
- **Role**: admin

⚠️ **Change the admin password immediately after first login!**

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
brew services list | grep postgresql  # macOS
systemctl status postgresql          # Linux

# Check if user can connect
psql -U thermal_user -d thermal_gait_db -h localhost
```

### Python/Dependencies Issues
```bash
# Make sure virtual environment is activated
which python  # should show path with 'venv'

# Reinstall dependencies
pip install -r requirements.txt --force-reinstall
```

### Port Already in Use
```bash
# Kill process on port 8000
lsof -ti:8000 | xargs kill -9
```