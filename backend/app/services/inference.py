"""
Inference Service for ConnectSign AI Backend.

Loads model weights, manages feature extraction, handles uncertainty calibration,
and matches sign sequences against phrasebook templates.
"""

from __future__ import annotations

import base64
import json
import logging
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple
import numpy as np

# Self-contained ML modules
from app.ml.classifier import SignClassifier
from app.ml.feature_extractor import LandmarkFeatureExtractor

from app.core.config import settings
from app.schemas.recognition import (
    CandidatePrediction,
    DetectedSign,
    RecognitionResponse,
)
from app.services.phrase_service import PhraseService

logger = logging.getLogger("ConnectSignInference")


class ModelNotLoadedException(Exception):
    """Raised when an inference call is made before the model is loaded."""
    pass


def decode_image_frame(item: Any) -> Optional[np.ndarray]:
    """Helper to decode base64 image strings or dicts from browser webcam."""
    import cv2

    if isinstance(item, dict):
        item = item.get("image") or item.get("data") or item.get("frame")
    if not isinstance(item, str):
        return None
    if "," in item:
        item = item.split(",", 1)[1]
    try:
        raw_bytes = base64.b64decode(item)
        nparr = np.frombuffer(raw_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        logger.debug("Failed to decode frame: %s", e)
        return None


class InferenceService:
    """Singleton service for loading model artifacts and executing predictions."""

    def __init__(self, model_dir: Optional[str] = None):
        self.model_dir = model_dir or settings.MODEL_DIR
        self.classifier = None
        self.config: Dict[str, Any] = {}
        self.target_names: List[str] = []
        self.extractor = None
        self.phrase_service = PhraseService()
        self.is_ready: bool = False
        self.load_error: Optional[str] = None

    def load_model(self) -> bool:
        """Load the trained classifier, configuration, and feature extractor."""
        t0 = time.time()
        search_dirs = [
            self.model_dir,
            os.path.join(os.path.dirname(__file__), "..", "..", "models"),
            os.path.join(os.getcwd(), "models"),
        ]

        config_path = None
        model_path = None

        for d in search_dirs:
            cp = os.path.join(d, "config.json")
            mp = os.path.join(d, "best_model.joblib")
            if os.path.exists(cp) and os.path.exists(mp):
                config_path = os.path.abspath(cp)
                model_path = os.path.abspath(mp)
                break

        if not config_path or not model_path:
            self.load_error = f"Model artifacts not found in search paths: {search_dirs}"
            logger.warning(self.load_error)
            self.is_ready = False
            return False

        try:
            with open(config_path, "r", encoding="utf-8") as f:
                self.config = json.load(f)

            self.target_names = self.config.get("target_names", [])

            # Load classifier via self-contained SignClassifier
            self.classifier = SignClassifier.load(model_path)

            # Initialize self-contained LandmarkFeatureExtractor
            hand_task = None
            pose_task = None
            for d in search_dirs:
                ht = os.path.join(d, "hand_landmarker.task")
                pt = os.path.join(d, "pose_landmarker_lite.task")
                if os.path.exists(ht) and not hand_task:
                    hand_task = ht
                if os.path.exists(pt) and not pose_task:
                    pose_task = pt

            self.extractor = LandmarkFeatureExtractor(
                num_frames=self.config.get("preprocessing_config", {}).get("num_frames", 16),
                hand_model_path=hand_task or "hand_landmarker.task",
                pose_model_path=pose_task or "pose_landmarker_lite.task",
                include_temporal_summary=True,
            )

            self.phrase_service = PhraseService(self.target_names)
            self.is_ready = True
            self.load_error = None
            dur = (time.time() - t0) * 1000
            logger.info("InferenceService loaded successfully in %.1f ms (%d classes)", dur, len(self.target_names))
            return True

        except Exception as e:
            self.load_error = f"Error loading model artifacts: {str(e)}"
            logger.error(self.load_error)
            self.is_ready = False
            return False

    def predict(self, frames_data: List[Any], lang: str = "fr") -> RecognitionResponse:
        """Run real inference on webcam image frames or landmark sequence."""
        if not self.is_ready or self.classifier is None:
            raise ModelNotLoadedException("Model is not loaded. Cannot execute inference.")

        t0 = time.time()

        if not frames_data:
            return RecognitionResponse(
                signs=[],
                sequence=[],
                overallConfidence=0.0,
                level="low",
                frames=0,
                latencyMs=0,
                isUncertain=True,
                rejectionMessage="Sign not recognized. Please try again.",
            )

        # 1. Determine input format: base64 images or landmark dicts
        first_frame = frames_data[0]
        is_image_stream = isinstance(first_frame, str) or (
            isinstance(first_frame, dict) and ("image" in first_frame or "data" in first_frame)
        )

        try:
            if is_image_stream:
                decoded_frames = []
                for f_item in frames_data:
                    dec = decode_image_frame(f_item)
                    if dec is not None:
                        decoded_frames.append(dec)

                if not decoded_frames:
                    return RecognitionResponse(
                        signs=[],
                        sequence=[],
                        overallConfidence=0.0,
                        level="low",
                        frames=len(frames_data),
                        latencyMs=int((time.time() - t0) * 1000),
                        isUncertain=True,
                        rejectionMessage="Failed to decode webcam video frames.",
                    )

                features = self.extractor.extract_from_frames(decoded_frames)
            else:
                features = self.extractor.extract_from_landmark_dicts(frames_data)

        except Exception as e:
            logger.error("Feature extraction failed: %s", e)
            return RecognitionResponse(
                signs=[],
                sequence=[],
                overallConfidence=0.0,
                level="low",
                frames=len(frames_data),
                latencyMs=int((time.time() - t0) * 1000),
                isUncertain=True,
                rejectionMessage="Sign not recognized. Please try again.",
            )

        # 2. Model Prediction
        X = np.expand_dims(features, axis=0)
        probs = self.classifier.predict_proba(X)[0]

        top_indices = np.argsort(probs)[::-1]
        top1_idx = int(top_indices[0])
        top1_label = self.target_names[top1_idx]
        top1_prob = float(probs[top1_idx])

        # Top candidates
        top_candidates = []
        for i in top_indices[:3]:
            lbl = self.target_names[i]
            top_candidates.append(
                CandidatePrediction(
                    label=lbl,
                    score=float(probs[i]),
                )
            )

        # Calibrated threshold evaluation for 32-class classifier (random chance = 3.125%)
        # A confident prediction is >= 0.20; medium is >= 0.12; noise is < 0.12
        is_uncertain = top1_prob < settings.UNCERTAINTY_THRESHOLD
        if top1_prob >= 0.22:
            conf_level = "high"
        elif top1_prob >= settings.UNCERTAINTY_THRESHOLD:
            conf_level = "medium"
        else:
            conf_level = "low"
            is_uncertain = True

        latency_ms = int((time.time() - t0) * 1000)

        # Map Arabic label to frontend gloss
        top_gloss = self.phrase_service.gloss_for_arabic(top1_label) if self.phrase_service else None
        if not top_gloss and top1_label:
            top_gloss = top1_label

        detected_signs = []
        sequence = []
        if top_gloss and not is_uncertain:
            detected_signs.append(
                DetectedSign(
                    gloss=top_gloss,
                    confidence=top1_prob,
                    level=conf_level,
                    atMs=latency_ms,
                )
            )
            sequence.append(top_gloss)

        # Match against phrasebook phrases
        matched_phrases = (
            self.phrase_service.match_signs(sequence, confidence=top1_prob)
            if self.phrase_service and sequence
            else []
        )
        best_match = matched_phrases[0]["phrase"] if matched_phrases else None
        support_status = matched_phrases[0]["support_status"] if matched_phrases else "NO_MATCH"

        return RecognitionResponse(
            signs=detected_signs,
            sequence=sequence,
            overallConfidence=top1_prob if not is_uncertain else 0.0,
            level=conf_level if not is_uncertain else "low",
            frames=len(frames_data),
            latencyMs=latency_ms,
            model={"name": "BridgeSign-LSA-Landmark", "version": "0.2.0"},
            adapter="live",
            isUncertain=is_uncertain,
            rawPredictedLabel=top1_label,
            matchedPhrase=best_match,
            supportStatus=support_status,
            topCandidates=top_candidates,
            rejectionMessage="Sign not recognized. Please try again." if is_uncertain else None,
        )


inference_service = InferenceService()
