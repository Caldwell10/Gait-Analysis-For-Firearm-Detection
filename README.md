
# Thermal Gait Surveillance System

A comprehensive security surveillance system that uses thermal gait analysis to detect concealed firearms. This Progressive Web Application (PWA) combines advanced machine learning with modern web technologies to provide real-time threat assessment capabilities.

## 🎯 Overview

The Thermal Gait Surveillance System analyzes thermal video footage to identify potential security threats through gait pattern recognition. Using a trained autoencoder model with **88.1% AUC performance**, the system can detect concealed firearms with **100% recall rate** and **80% precision**.

### Key Features

- **Real-time Threat Detection**: Upload thermal videos and get instant analysis results
- **High Accuracy ML Model**: 88.1% AUC with 100% recall rate for threat detection
- **Progressive Web App**: Works across devices with offline capabilities
- **Role-based Access Control**: Admin and Security Personnel user roles
- **Comprehensive Video Management**: Upload, analyze, and manage thermal video files
- **RESTful API**: Complete backend API with OpenAPI documentation

## 🏗️ Architecture

### Technology Stack

**Frontend (PWA)**
- Next.js 14 with App Router
- TypeScript
- Tailwind CSS
- React Hook Form + Zod validation
- Progressive Web App capabilities

**Backend (API)**
- FastAPI (Python)
- PostgreSQL database
- JWT authentication with HttpOnly cookies
- SQLAlchemy ORM
- Pydantic data validation

**Machine Learning**
- PyTorch autoencoder model (2.4MB)
- Thermal video processing pipeline
- Gait Energy Image (GEI) generation
- CLAHE enhancement for thermal data

### Project Structure

```
├── apps/
│   ├── pwa/                 # Next.js Progressive Web App
│   │   ├── app/            # App Router pages
│   │   ├── src/            # Components and utilities
│   │   └── public/         # Static assets
│   └── api/                # FastAPI Backend
│       ├── app/            # FastAPI application
│       ├── tests/          # Test suite
│       └── requirements.txt # Python dependencies
├── thermal-env/            # Python virtual environment
└── README.md              # This file
```

## 🚀 Getting Started

### Prerequisites

- **Python 3.8+** with pip
- **Node.js 18+** with npm
- **PostgreSQL** database
- **Git** for version control

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd Gait-Analysis-For-Firearm-Detection
   ```

2. **Set up Python virtual environment**
   ```bash
   python3 -m venv thermal-env
   source thermal-env/bin/activate  # On Windows: thermal-env\Scripts\activate
   ```

3. **Install backend dependencies**
   ```bash
   cd apps/api
   pip install -r requirements.txt
   ```

4. **Install frontend dependencies**
   ```bash
   cd ../pwa
   npm install
   ```

5. **Set up environment variables**
   ```bash
   # Copy example environment files
   cp .env.example .env.local  # Frontend
   cp ../api/.env.example ../api/.env  # Backend

   # Configure your database URL and other settings
   ```

### Running the Application

1. **Start the backend server**
   ```bash
   cd apps/api
   source ../../thermal-env/bin/activate
   python run_server.py
   ```
   Backend will be available at: http://localhost:8000
  


2. **Start the frontend development server**
   ```bash
   cd apps/pwa
   npm run dev
   ```
   Frontend will be available at: http://localhost:3000

## 🔐 Authentication

### User Roles
- **Admin**: Full system access, user management, system configuration
- **Security Personnel**: Video upload, analysis viewing, limited management

## 🎮 Usage

### Upload and Analyze Videos

1. **Login** to the system using your credentials
2. **Navigate** to the Upload section from the dashboard
3. **Select** a thermal video file (MP4, AVI, MOV - max 100MB)
4. **Upload** and wait for processing
5. **View Results** with threat assessment and confidence scores

### Dashboard Features

- **System Overview**: Total videos, processing status, completion rates
- **Recent Activity**: Latest uploaded videos and analysis results
- **Quick Actions**: Direct access to upload and video management
- **Real-time Status**: Live updates on processing progress

### Video Management

- **List View**: Browse all uploaded videos with filtering options
- **Details View**: Comprehensive video information and analysis results
- **Status Tracking**: Monitor processing stages (Pending → Processing → Completed)
- **Export Options**: Download results and generate reports

## 🧠 Machine Learning Model

### Model Performance
- **AUC**: 88.1% (95% CI: [0.784, 0.963])
- **Recall**: 100% (perfect threat detection rate)
- **Precision**: 80%
- **Model Size**: 2.4MB (production-ready)
- **Processing Time**: ~2.3 seconds per video

### Processing Pipeline
1. **Video Input**: Thermal video files (.mp4, .avi, .mov)
2. **CLAHE Enhancement**: Contrast Limited Adaptive Histogram Equalization
3. **Silhouette Extraction**: Adaptive thresholding for gait isolation
4. **GEI Generation**: Gait Energy Image creation from video sequence
5. **ML Inference**: Autoencoder-based anomaly detection
6. **Threat Assessment**: Combined scoring with optimal threshold (0.179)

### Model Architecture
- **Type**: Convolutional Autoencoder
- **Latent Dimension**: 32
- **Base Channels**: 24
- **Input Size**: 64x64 thermal images
- **Training Dataset**: 60 thermal samples (32 concealed, 28 normal)

## 📡 API Documentation

### Authentication Endpoints
- `POST /auth/login` - User authentication
- `POST /auth/signup` - New user registration
- `GET /auth/me` - Get current user info
- `POST /auth/logout` - User logout

### Video Management Endpoints
- `POST /api/videos/upload` - Upload thermal video
- `GET /api/videos` - List videos with pagination
- `GET /api/videos/{id}` - Get specific video details
- `PATCH /api/videos/{id}` - Update video metadata
- `DELETE /api/videos/{id}` - Delete video (soft delete)
- `GET /api/videos/{id}/stream` - Stream video with range support

### Analysis Endpoints
- `POST /api/analysis` - Create analysis record
- `GET /api/analysis/{id}` - Get analysis results
- `GET /api/analysis` - List analyses with filtering
- `PATCH /api/analysis/{id}` - Update analysis data
- `GET /api/analysis/stats` - System statistics

**Interactive API Documentation**: http://localhost:8000/docs

## 🗄️ Database Schema

### Key Models

**Users**
- Authentication and role management
- Admin and Security Personnel roles
- Session tracking and security features

**VideoRecord**
- File metadata and storage information
- Processing status and analysis linking
- User ownership and access control
- Soft delete with audit trail

**GaitAnalysis**
- ML model results and confidence scores
- Threat detection flags and details
- Processing metadata and timing
- Analysis versioning and review status

## 🔧 Configuration

### Backend Configuration (`apps/api/app/core/config.py`)
```python
# Database
DATABASE_URL = "postgresql://thermal_user:thermal_password@localhost:5432/thermal_gait_db"

# Security
JWT_SECRET_KEY = "your-secret-key"
ACCESS_TOKEN_EXPIRE_MINUTES = 15

# File Storage
VIDEO_UPLOAD_DIR = "./uploads/videos"
MAX_VIDEO_SIZE_MB = 100

# CORS
ALLOWED_ORIGINS = ["http://localhost:3000", "http://127.0.0.1:3000"]
```

### Frontend Configuration
```bash
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME="Thermal Gait Surveillance"
```

## 🧪 Testing

### Backend Tests
```bash
cd apps/api
python -m pytest tests/ -v
```

### Frontend Tests
```bash
cd apps/pwa
npm test
```




