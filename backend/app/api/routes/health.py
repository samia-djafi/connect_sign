"""
Health & Readiness Check Endpoints.
"""

import time
from fastapi import APIRouter
from app.core.config import settings
from app.schemas.recognition import HealthResponse
from app.services.inference import inference_service

router = APIRouter(tags=["Health"])


@router.get("/health", response_model=HealthResponse)
@router.get("/", response_model=HealthResponse)
async def check_health() -> HealthResponse:
    """
    Health and readiness probe endpoint.

    Evaluates backend service status, model checkpoint readiness, and active vocabulary classes.
    Returns status 'ok' when the ML inference pipeline is fully initialized and 'degraded' otherwise.
    """
    model_loaded = inference_service.is_ready
    active_count = len(inference_service.target_names) if model_loaded else 0

    return HealthResponse(
        status="ok" if model_loaded else "degraded",
        service="ConnectSign AI Recognition API",
        version=settings.VERSION,
        model_loaded=model_loaded,
        model_name="BridgeSign-LSA-Landmark-SVM" if model_loaded else None,
        active_vocabulary_classes=active_count,
        device=settings.DEVICE,
        timestamp=time.time(),
    )
