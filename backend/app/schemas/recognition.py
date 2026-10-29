"""
Pydantic Schemas for ConnectSign Recognition API.
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class NormalizedLandmark(BaseModel):
    """Normalized MediaPipe 3D coordinate (x, y normalized to [0, 1], z depth relative)."""
    x: float
    y: float
    z: Optional[float] = 0.0


class LandmarkFrame(BaseModel):
    """Single captured frame containing timestamp and detected hands/pose landmark points."""
    t: Optional[int] = 0
    hands: Optional[List[List[NormalizedLandmark]]] = []
    pose: Optional[List[NormalizedLandmark]] = []


class RecognitionRequest(BaseModel):
    """Inference request payload containing video frames or serialized landmark arrays."""
    frames: List[Any] = Field(
        ...,
        max_length=120,
        description="Array of webcam frames (base64 image strings) or LandmarkFrame dictionaries (max 120 frames).",
    )
    lang: Optional[str] = Field(
        "fr",
        max_length=10,
        description="Spoken language context for sentence mapping ('fr', 'ar', 'en').",
    )


class DetectedSign(BaseModel):
    """Recognized sign token with associated confidence metrics."""
    gloss: str = Field(..., description="Canonical gloss token matching frontend vocabulary.")
    confidence: float = Field(..., description="Normalized confidence probability (0.0 to 1.0).")
    level: str = Field(..., description="Confidence tier: 'high', 'medium', or 'low'.")
    atMs: int = Field(0, description="Elapsed latency timestamp in milliseconds.")


class CandidatePrediction(BaseModel):
    """Model classification prediction candidate with multilingual meaning lookups."""
    label: str
    score: float
    meaning_en: Optional[str] = None
    meaning_fr: Optional[str] = None


class RecognitionResponse(BaseModel):
    signs: List[DetectedSign] = Field(default_factory=list)
    sequence: List[str] = Field(default_factory=list)
    overallConfidence: float = 0.0
    level: str = "low"
    frames: int = 0
    latencyMs: int = 0
    model: Dict[str, str] = Field(
        default_factory=lambda: {"name": "ConnectSign-LSA-Landmark", "version": "0.2.0"}
    )
    adapter: str = "live"
    isUncertain: bool = True
    rawPredictedLabel: Optional[str] = None
    matchedPhrase: Optional[Dict[str, Any]] = None
    supportStatus: str = "NO_MATCH"
    topCandidates: List[CandidatePrediction] = Field(default_factory=list)
    rejectionMessage: Optional[str] = None


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    model_loaded: bool
    model_name: Optional[str] = None
    active_vocabulary_classes: int = 0
    device: str
    timestamp: float
