"""
Video frame sampling and resizing module for Algerian Sign Language models.
ConnectSign self-contained ML module.
"""

import os
from typing import List, Optional, Tuple
import cv2
import numpy as np


class FrameSampler:
    """
    Sample a fixed number of frames uniformly across a video duration,
    resizing and normalizing them consistently for model consumption.
    """

    def __init__(
        self,
        num_frames: int = 16,
        target_size: Optional[Tuple[int, int]] = (64, 64),
        normalize: bool = True,
        grayscale: bool = False,
    ):
        if num_frames <= 0:
            raise ValueError(f"num_frames must be positive, got {num_frames}")
        self.num_frames = num_frames
        self.target_size = target_size
        self.normalize = normalize
        self.grayscale = grayscale

    def compute_frame_indices(self, total_frames: int) -> np.ndarray:
        """
        Compute deterministic uniform frame indices across the sequence duration.

        Args:
            total_frames: Total number of frames available in the source sequence.

        Returns:
            np.ndarray: Array of integer indices of length self.num_frames.
        """
        if total_frames <= 0:
            raise ValueError(f"total_frames must be > 0, got {total_frames}")

        if total_frames == 1:
            return np.zeros(self.num_frames, dtype=int)

        if total_frames >= self.num_frames:
            return np.linspace(0, total_frames - 1, num=self.num_frames, dtype=int)
        else:
            return np.pad(
                np.arange(total_frames),
                (0, self.num_frames - total_frames),
                mode="edge",
            )

    def sample_from_frames(self, frames: List[np.ndarray]) -> np.ndarray:
        """
        Sample uniformly from a pre-loaded list of numpy image frames,
        applying target sizing, optional grayscale conversion, and pixel normalization.

        Args:
            frames: List of input numpy BGR/RGB image arrays.

        Returns:
            np.ndarray: 4D tensor with shape (num_frames, height, width, channels).
        """
        if not frames:
            raise ValueError("No frames provided to sample_from_frames")

        indices = self.compute_frame_indices(len(frames))
        sampled = [frames[idx] for idx in indices]

        processed = []
        for f in sampled:
            if self.grayscale and len(f.shape) == 3:
                f = cv2.cvtColor(f, cv2.COLOR_BGR2GRAY)
                f = np.expand_dims(f, axis=-1)
            if self.target_size is not None:
                tw, th = self.target_size
                f = cv2.resize(f, (tw, th), interpolation=cv2.INTER_AREA)
                if self.grayscale and len(f.shape) == 2:
                    f = np.expand_dims(f, axis=-1)
            processed.append(f)

        tensor = np.stack(processed, axis=0)
        if self.normalize:
            tensor = tensor.astype(np.float32) / 255.0
        return tensor
