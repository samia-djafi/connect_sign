"""
Phrasebook & Sequence Alignment Routes.
"""

from typing import Any, Dict, List
from fastapi import APIRouter
from pydantic import BaseModel, Field
from app.services.inference import inference_service

router = APIRouter(prefix="/v1", tags=["Phrases"])


class MatchRequest(BaseModel):
    """Payload representing a captured sequence of recognized gloss tokens to align."""
    signs: List[str] = Field(..., description="Ordered list of sign gloss tokens.")


@router.get("/phrases")
async def list_phrases() -> Dict[str, Any]:
    """
    Retrieve phrasebook templates and vocabulary coverage.

    Returns the complete list of predefined medical and frontline phrase templates,
    including their translations in French, Arabic, and English along with associated sign glosses.
    """
    if inference_service.phrase_service:
        return inference_service.phrase_service.list_phrases()
    return {"total_phrases": 0, "phrases": []}


@router.post("/match")
async def match_phrase(request: MatchRequest) -> Dict[str, Any]:
    """
    Match recognized gloss sequences against phrasebook templates.

    Compares input gloss tokens against known medical phrase sequences using subsequence
    and exact alignment algorithms to suggest suitable natural language sentence completions.
    """
    if inference_service.phrase_service:
        matches = inference_service.phrase_service.match_signs(request.signs)
        return {"matches": matches}
    return {"matches": []}
