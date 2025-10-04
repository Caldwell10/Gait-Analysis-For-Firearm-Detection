from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime
import uuid


class AnalysisCreateRequest(BaseModel):
    """Request schema for creating a new analysis"""
    video_id: str = Field(..., description="UUID of the video to analyze")
    subject_id: Optional[str] = Field(None, description="Optional subject identifier")
    analysis_data: Dict[str, Any] = Field(..., description="Analysis data from ML processing")
    confidence_score: Optional[str] = Field(None, description="Overall confidence score")
    threat_detected: bool = Field(False, description="Whether a threat was detected")
    threat_confidence: Optional[str] = Field(None, description="Threat detection confidence")
    threat_details: Optional[Dict[str, Any]] = Field(None, description="Detailed threat information")
    algorithm_version: Optional[str] = Field(None, description="ML algorithm version used")
    processing_time: Optional[str] = Field(None, description="Processing time (e.g., '2.5s')")


class AnalysisUpdateRequest(BaseModel):
    """Request schema for updating analysis data"""
    analysis_data: Optional[Dict[str, Any]] = None
    confidence_score: Optional[str] = None
    threat_detected: Optional[bool] = None
    threat_confidence: Optional[str] = None
    threat_details: Optional[Dict[str, Any]] = None
    algorithm_version: Optional[str] = None
    processing_time: Optional[str] = None


class AnalysisStatusUpdate(BaseModel):
    """Schema for updating analysis processing status"""
    status: str = Field(..., pattern="^(pending|processing|completed|failed)$")
    analysis_data: Optional[Dict[str, Any]] = None
    error_message: Optional[str] = None


class AnalysisResponse(BaseModel):
    """Response schema for analysis data"""
    id: str
    video_id: str
    analysis_data: Dict[str, Any]
    confidence_score: Optional[str] = None
    threat_detected: bool
    threat_confidence: Optional[str] = None
    threat_details: Optional[Dict[str, Any]] = None
    algorithm_version: Optional[str] = None
    processing_time: Optional[str] = None
    analyzed_by: str
    reviewed_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime


class AnalysisListResponse(BaseModel):
    """Response schema for analysis list with pagination"""
    analyses: List[AnalysisResponse]
    total: int
    page: int
    per_page: int
    has_next: bool


class AnalysisSummary(BaseModel):
    """Summary schema for dashboard/overview"""
    id: str
    video_id: str
    video_filename: Optional[str] = None
    subject_id: Optional[str] = None
    threat_detected: bool
    threat_level: Optional[str] = None  # HIGH, MEDIUM, LOW
    confidence_score: Optional[str] = None
    processing_time: Optional[str] = None
    analyzed_by: str
    created_at: datetime


class AnalysisStats(BaseModel):
    """Statistics schema for analysis overview"""
    total_analyses: int
    pending_analyses: int
    completed_analyses: int
    failed_analyses: int
    threats_detected: int
    average_processing_time: Optional[str] = None
    last_analysis_date: Optional[datetime] = None


class ThreatDetectionResult(BaseModel):
    """Schema for threat detection results"""
    threat_detected: bool
    confidence: float = Field(..., ge=0.0, le=1.0)
    threat_level: str = Field(..., pattern="^(LOW|MEDIUM|HIGH|CRITICAL)$")
    details: Dict[str, Any]
    recommendations: List[str]


class MockAnalysisResult(BaseModel):
    """Mock analysis result for demo purposes"""
    threat_level: str = "HIGH"
    confidence: float = 0.92
    processing_time: str = "2.3s"
    metrics: Dict[str, float] = {
        "reconstruction_error": 0.15,
        "latent_score": 0.82,
        "combined_score": 0.179,
        "threshold": 0.179
    }
    gei_placeholder: str = "/assets/sample-gei.png"
    threat_indicators: List[str] = [
        "Abnormal gait pattern detected",
        "Concealed object influence on movement",
        "Asymmetric weight distribution"
    ]