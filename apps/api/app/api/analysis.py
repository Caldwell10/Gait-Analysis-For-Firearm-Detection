import os
import uuid
from typing import List, Optional
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from ..core.database import get_db
from .auth import get_current_user
from ..crud import analysis as analysis_crud
from ..crud import video as video_crud
from ..models.user import User, UserRole
from ..schemas.analysis import (
    AnalysisCreateRequest,
    AnalysisUpdateRequest,
    AnalysisStatusUpdate,
    AnalysisResponse,
    AnalysisListResponse,
    AnalysisSummary,
    AnalysisStats,
    MockAnalysisResult
)

router = APIRouter(prefix="/analysis", tags=["analysis"])


@router.post("/", response_model=AnalysisResponse)
async def create_analysis(
    analysis_data: AnalysisCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a new gait analysis record

    - **video_id**: UUID of the video to analyze
    - **analysis_data**: Detailed analysis results from ML processing
    - **subject_id**: Optional subject identifier
    - **threat_detected**: Whether a threat was detected
    - Requires authentication
    - Links analysis to existing video record
    """
    try:
        video_uuid = uuid.UUID(analysis_data.video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied"
        )

    # Check if analysis already exists for this video
    existing_analysis = analysis_crud.get_analysis_by_video_id(db=db, video_id=video_uuid)
    if existing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis already exists for this video"
        )

    # Create the analysis
    analysis = analysis_crud.create_analysis(
        db=db,
        video_id=video_uuid,
        analysis_data=analysis_data.analysis_data,
        analyzed_by=current_user.id,
        confidence_score=analysis_data.confidence_score,
        threat_detected=analysis_data.threat_detected,
        threat_confidence=analysis_data.threat_confidence,
        threat_details=analysis_data.threat_details,
        algorithm_version=analysis_data.algorithm_version,
        processing_time=analysis_data.processing_time
    )

    # Update video status to completed
    video_crud.update_analysis_status(
        db=db,
        video_id=video_uuid,
        status_update=video_crud.VideoAnalysisStatusUpdate(
            status="completed",
            analysis_results=analysis_data.analysis_data
        ),
        analyzed_by=current_user.id
    )

    return AnalysisResponse(
        id=str(analysis.id),
        video_id=str(analysis.video_id),
        analysis_data=analysis.analysis_data,
        confidence_score=analysis.confidence_score,
        threat_detected=analysis.threat_detected,
        threat_confidence=analysis.threat_confidence,
        threat_details=analysis.threat_details,
        algorithm_version=analysis.algorithm_version,
        processing_time=analysis.processing_time,
        analyzed_by=str(analysis.analyzed_by),
        reviewed_by=str(analysis.reviewed_by) if analysis.reviewed_by else None,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at
    )


@router.get("/", response_model=AnalysisListResponse)
async def list_analyses(
    page: int = Query(1, ge=1, description="Page number"),
    per_page: int = Query(20, ge=1, le=100, description="Items per page"),
    threat_filter: Optional[bool] = Query(None, description="Filter by threat detection"),
    date_from: Optional[str] = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="Filter to date (YYYY-MM-DD)"),
    confidence_min: Optional[float] = Query(None, ge=0.0, le=1.0, description="Minimum confidence score"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    List analyses with pagination and filtering

    - **page**: Page number (starts at 1)
    - **per_page**: Number of items per page (max 100)
    - **threat_filter**: Filter by threat detection (true/false)
    - **date_from**: Filter analyses from this date
    - **date_to**: Filter analyses to this date
    - **confidence_min**: Minimum confidence score filter
    - Regular users see only analyses for their videos
    - Admins can see all analyses
    """
    skip = (page - 1) * per_page

    # Parse date filters
    date_from_obj = None
    date_to_obj = None

    if date_from:
        try:
            date_from_obj = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_from format. Use YYYY-MM-DD"
            )

    if date_to:
        try:
            date_to_obj = datetime.strptime(date_to, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid date_to format. Use YYYY-MM-DD"
            )

    # Determine access level
    if current_user.role == UserRole.ADMIN.value:
        # Admin can see all analyses
        analyses = analysis_crud.get_all_analyses(
            db=db,
            skip=skip,
            limit=per_page,
            threat_filter=threat_filter,
            date_from=date_from_obj,
            date_to=date_to_obj,
            confidence_min=confidence_min
        )
        total = analysis_crud.count_all_analyses(
            db=db,
            threat_filter=threat_filter,
            date_from=date_from_obj,
            date_to=date_to_obj
        )
    else:
        # Regular users see only analyses for their videos
        analyses = analysis_crud.get_analyses_by_user(
            db=db,
            user_id=current_user.id,
            skip=skip,
            limit=per_page,
            threat_filter=threat_filter,
            date_from=date_from_obj,
            date_to=date_to_obj
        )
        total = analysis_crud.count_analyses_by_user(
            db=db,
            user_id=current_user.id,
            threat_filter=threat_filter,
            date_from=date_from_obj,
            date_to=date_to_obj
        )

    # Convert to response format
    analysis_responses = [
        AnalysisResponse(
            id=str(analysis.id),
            video_id=str(analysis.video_id),
            analysis_data=analysis.analysis_data,
            confidence_score=analysis.confidence_score,
            threat_detected=analysis.threat_detected,
            threat_confidence=analysis.threat_confidence,
            threat_details=analysis.threat_details,
            algorithm_version=analysis.algorithm_version,
            processing_time=analysis.processing_time,
            analyzed_by=str(analysis.analyzed_by),
            reviewed_by=str(analysis.reviewed_by) if analysis.reviewed_by else None,
            created_at=analysis.created_at,
            updated_at=analysis.updated_at
        )
        for analysis in analyses
    ]

    has_next = skip + per_page < total

    return AnalysisListResponse(
        analyses=analysis_responses,
        total=total,
        page=page,
        per_page=per_page,
        has_next=has_next
    )


@router.get("/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get specific analysis details

    - **analysis_id**: UUID of the analysis
    - Users can only access analyses for their own videos (unless admin)
    """
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis ID format"
        )

    analysis = analysis_crud.get_analysis_by_id(db=db, analysis_id=analysis_uuid)

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    # Check access permissions (non-admins can only see their own video analyses)
    if current_user.role != UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=analysis.video_id)
        if not video or video.uploaded_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    return AnalysisResponse(
        id=str(analysis.id),
        video_id=str(analysis.video_id),
        analysis_data=analysis.analysis_data,
        confidence_score=analysis.confidence_score,
        threat_detected=analysis.threat_detected,
        threat_confidence=analysis.threat_confidence,
        threat_details=analysis.threat_details,
        algorithm_version=analysis.algorithm_version,
        processing_time=analysis.processing_time,
        analyzed_by=str(analysis.analyzed_by),
        reviewed_by=str(analysis.reviewed_by) if analysis.reviewed_by else None,
        created_at=analysis.created_at,
        updated_at=analysis.updated_at
    )


@router.patch("/{analysis_id}", response_model=AnalysisResponse)
async def update_analysis(
    analysis_id: str,
    update_data: AnalysisUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update analysis data

    - **analysis_id**: UUID of the analysis
    - Only admins or the original analyzer can update
    """
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis ID format"
        )

    analysis = analysis_crud.get_analysis_by_id(db=db, analysis_id=analysis_uuid)

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    # Check permissions
    if (current_user.role != UserRole.ADMIN.value and
        analysis.analyzed_by != current_user.id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # Update the analysis
    updated_analysis = analysis_crud.update_analysis(
        db=db,
        analysis_id=analysis_uuid,
        update_data=update_data
    )

    if not updated_analysis:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update analysis"
        )

    return AnalysisResponse(
        id=str(updated_analysis.id),
        video_id=str(updated_analysis.video_id),
        analysis_data=updated_analysis.analysis_data,
        confidence_score=updated_analysis.confidence_score,
        threat_detected=updated_analysis.threat_detected,
        threat_confidence=updated_analysis.threat_confidence,
        threat_details=updated_analysis.threat_details,
        algorithm_version=updated_analysis.algorithm_version,
        processing_time=updated_analysis.processing_time,
        analyzed_by=str(updated_analysis.analyzed_by),
        reviewed_by=str(updated_analysis.reviewed_by) if updated_analysis.reviewed_by else None,
        created_at=updated_analysis.created_at,
        updated_at=updated_analysis.updated_at
    )


@router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete an analysis record

    - **analysis_id**: UUID of the analysis
    - Only admins can delete analyses
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete analyses"
        )

    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis ID format"
        )

    analysis = analysis_crud.get_analysis_by_id(db=db, analysis_id=analysis_uuid)

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    deleted = analysis_crud.delete_analysis(db=db, analysis_id=analysis_uuid)

    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete analysis"
        )

    return {
        "message": "Analysis deleted successfully",
        "analysis_id": analysis_id
    }


@router.get("/stats/overview", response_model=AnalysisStats)
async def get_analysis_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get analysis statistics overview

    - Regular users see stats for their videos only
    - Admins see system-wide statistics
    """
    user_filter = None if current_user.role == UserRole.ADMIN.value else current_user.id

    stats = analysis_crud.get_analysis_stats(db=db, user_id=user_filter)

    return AnalysisStats(
        total_analyses=stats["total_analyses"],
        pending_analyses=0,  # TODO: Implement pending count
        completed_analyses=stats["total_analyses"],
        failed_analyses=0,  # TODO: Implement failed count
        threats_detected=stats["threats_detected"],
        average_processing_time="2.3s",  # TODO: Calculate actual average
        last_analysis_date=stats["last_analysis_date"]
    )


@router.get("/pending/queue")
async def get_pending_analyses(
    limit: int = Query(10, ge=1, le=50, description="Number of pending analyses to return"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get videos pending analysis (system/admin function)

    - **limit**: Number of pending videos to return
    - Only admins can access this endpoint
    - Used by ML processing system to get work queue
    """
    if current_user.role != UserRole.ADMIN.value:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can access pending analysis queue"
        )

    pending = analysis_crud.get_pending_analyses(db=db, limit=limit)

    return {
        "pending_analyses": pending,
        "total_pending": len(pending),
        "message": f"Found {len(pending)} videos pending analysis"
    }


@router.post("/analyze/{video_id}", response_model=dict)
async def analyze_video_ml(
    video_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Analyze video using real ML inference (Sprint 3)

    - **video_id**: UUID of the video to analyze
    - Uses trained ConvAutoencoder with 88.1% AUC performance
    - Generates GEI (Gait Energy Image) from thermal video
    - Returns real threat detection with confidence scores
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied"
        )

    # Check if analysis already exists
    existing_analysis = analysis_crud.get_analysis_by_video_id(db=db, video_id=video_uuid)
    if existing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Analysis already exists for this video"
        )

    # Update video status to processing
    video_crud.update_analysis_status(
        db=db,
        video_id=video_uuid,
        status_update=video_crud.VideoAnalysisStatusUpdate(
            status="processing",
            analysis_results=None
        ),
        analyzed_by=current_user.id
    )

    try:
        # Import ML service
        from ...ml.service import analyze_thermal_video

        # Create GEI output directory
        import os
        gei_output_dir = os.path.join(
            os.path.dirname(video.file_path),
            "gei"
        )

        # Run ML analysis
        ml_results = await analyze_thermal_video(
            video_path=video.file_path,
            output_dir=gei_output_dir
        )

        if "error" in ml_results:
            # Update video status to failed
            video_crud.update_analysis_status(
                db=db,
                video_id=video_uuid,
                status_update=video_crud.VideoAnalysisStatusUpdate(
                    status="failed",
                    analysis_results={"error": ml_results["error"]}
                ),
                analyzed_by=current_user.id
            )

            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"ML analysis failed: {ml_results['error']}"
            )

        # Create analysis record with real ML results
        analysis_data = {
            "gait_metrics": {
                "processing_method": "thermal_gei",
                "model_type": "ConvAutoencoder",
                "thermal_enhancement": "CLAHE"
            },
            "ml_results": {
                "reconstruction_error": ml_results["reconstruction_error"],
                "latent_score": ml_results["latent_score"],
                "combined_score": ml_results["combined_score"],
                "optimal_threshold": ml_results["optimal_threshold"],
                "model_performance": ml_results["model_performance"]
            },
            "processing_info": ml_results["processing_metadata"],
            "gei_path": ml_results.get("gei_file_path")
        }

        # Create the analysis with ML results
        analysis = analysis_crud.create_analysis(
            db=db,
            video_id=video_uuid,
            analysis_data=analysis_data,
            analyzed_by=current_user.id,
            confidence_score=str(ml_results["confidence_score"]),
            threat_detected=ml_results["threat_detected"],
            threat_confidence=str(ml_results["threat_confidence"]),
            threat_details={
                "threat_level": "HIGH" if ml_results["threat_detected"] else "LOW",
                "combined_score": ml_results["combined_score"],
                "threshold_exceeded": ml_results["combined_score"] >= ml_results["optimal_threshold"]
            },
            algorithm_version=ml_results["algorithm_version"],
            processing_time=ml_results["processing_time"]
        )

        # Update video with ML processing metadata
        video_crud.update_video_ml_data(
            db=db,
            video_id=video_uuid,
            gei_file_path=ml_results.get("gei_file_path"),
            processing_metadata=ml_results["processing_metadata"]
        )

        # Update video status to completed
        video_crud.update_analysis_status(
            db=db,
            video_id=video_uuid,
            status_update=video_crud.VideoAnalysisStatusUpdate(
                status="completed",
                analysis_results=analysis_data
            ),
            analyzed_by=current_user.id
        )

        return {
            "message": "Real ML analysis completed successfully",
            "analysis_id": str(analysis.id),
            "video_id": video_id,
            "threat_detected": ml_results["threat_detected"],
            "confidence_score": ml_results["confidence_score"],
            "combined_score": ml_results["combined_score"],
            "processing_time": ml_results["processing_time"],
            "model_performance": {
                "auc": "88.1%",
                "recall": "100%",
                "precision": "80%"
            }
        }

    except Exception as e:
        # Update video status to failed
        video_crud.update_analysis_status(
            db=db,
            video_id=video_uuid,
            status_update=video_crud.VideoAnalysisStatusUpdate(
                status="failed",
                analysis_results={"error": str(e)}
            ),
            analyzed_by=current_user.id
        )

        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ML analysis failed: {str(e)}"
        )


@router.post("/mock/{video_id}", response_model=dict)
async def create_mock_analysis(
    video_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create mock analysis results for demo purposes

    - **video_id**: UUID of the video to create mock analysis for
    - Creates realistic mock analysis data
    - Used for demonstration and testing
    """
    try:
        video_uuid = uuid.UUID(video_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid video ID format"
        )

    # Check if video exists and user has access
    if current_user.role == UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=video_uuid)
    else:
        video = video_crud.get_video_by_id_and_user(
            db=db,
            video_id=video_uuid,
            user_id=current_user.id
        )

    if not video:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Video not found or access denied"
        )

    # Create mock analysis data
    mock_result = MockAnalysisResult()

    analysis_data = {
        "gait_metrics": {
            "stride_length": 1.42,
            "step_frequency": 1.8,
            "velocity": 1.25,
            "asymmetry_index": 0.15
        },
        "ml_results": {
            "reconstruction_error": mock_result.metrics["reconstruction_error"],
            "latent_score": mock_result.metrics["latent_score"],
            "combined_score": mock_result.metrics["combined_score"],
            "threshold": mock_result.metrics["threshold"]
        },
        "threat_indicators": mock_result.threat_indicators,
        "processing_info": {
            "model_version": "autoencoder_v2.1",
            "processing_time": mock_result.processing_time,
            "timestamp": datetime.utcnow().isoformat()
        }
    }

    # Create the analysis
    analysis = analysis_crud.create_analysis(
        db=db,
        video_id=video_uuid,
        analysis_data=analysis_data,
        analyzed_by=current_user.id,
        confidence_score=str(mock_result.confidence),
        threat_detected=True,
        threat_confidence=str(mock_result.confidence),
        threat_details={
            "threat_level": mock_result.threat_level,
            "risk_score": mock_result.confidence,
            "detected_anomalies": mock_result.threat_indicators
        },
        algorithm_version="autoencoder_v2.1",
        processing_time=mock_result.processing_time
    )

    # Update video status
    video_crud.update_analysis_status(
        db=db,
        video_id=video_uuid,
        status_update=video_crud.VideoAnalysisStatusUpdate(
            status="completed",
            analysis_results=analysis_data
        ),
        analyzed_by=current_user.id
    )

    return {
        "message": "Mock analysis created successfully",
        "analysis_id": str(analysis.id),
        "video_id": video_id,
        "threat_level": mock_result.threat_level,
        "confidence": mock_result.confidence,
        "processing_time": mock_result.processing_time
    }


@router.get("/{analysis_id}/gei")
async def get_analysis_gei(
    analysis_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the GEI (Gait Energy Image) for an analysis

    - **analysis_id**: UUID of the analysis
    - Returns the GEI image generated during ML processing
    - Users can only access GEIs for their own video analyses (unless admin)
    """
    try:
        analysis_uuid = uuid.UUID(analysis_id)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid analysis ID format"
        )

    analysis = analysis_crud.get_analysis_by_id(db=db, analysis_id=analysis_uuid)

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    # Check access permissions
    if current_user.role != UserRole.ADMIN.value:
        video = video_crud.get_video_by_id(db=db, video_id=analysis.video_id)
        if not video or video.uploaded_by != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )

    # Get GEI path from analysis data or video record
    gei_path = None
    if analysis.analysis_data and "gei_path" in analysis.analysis_data:
        gei_path = analysis.analysis_data["gei_path"]
    else:
        # Try to get from video record
        video = video_crud.get_video_by_id(db=db, video_id=analysis.video_id)
        if video and video.gei_file_path:
            gei_path = video.gei_file_path

    if not gei_path or not os.path.exists(gei_path):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="GEI image not found"
        )

    from fastapi.responses import FileResponse
    return FileResponse(
        gei_path,
        media_type="image/png",
        filename=f"gei_{analysis_id}.png"
    )