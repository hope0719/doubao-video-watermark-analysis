"""
Utility functions for AI Video Copilot.

Provides file naming, validation, and other shared helpers.
"""

from __future__ import annotations

import logging
from datetime import datetime
from pathlib import Path

from config import OUTPUT_DIR, SUPPORTED_VIDEO_FORMATS

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Filename helpers
# ---------------------------------------------------------------------------

def generate_output_filename(prefix: str, extension: str) -> str:
    """Generate a unique output filename using timestamp to avoid collisions.

    Args:
        prefix: Descriptive prefix for the file (e.g. ``"trim"``, ``"audio"``).
        extension: File extension including the dot (e.g. ``".mp4"``).

    Returns:
        Absolute path string for the new output file.

    Example:
        >>> name = generate_output_filename("trim", ".mp4")
        >>> name.endswith(".mp4")
        True
    """
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"{prefix}_{timestamp}{extension}"
    return str(OUTPUT_DIR / filename)


# ---------------------------------------------------------------------------
# Validation helpers
# ---------------------------------------------------------------------------

def validate_video_path(video_path: str) -> tuple[bool, str]:
    """Validate that a video file exists and has a supported format.

    Args:
        video_path: Filesystem path to the video file.

    Returns:
        A ``(is_valid, error_message)`` tuple.  ``error_message`` is empty
        when the path is valid.
    """
    path = Path(video_path)
    if not path.exists():
        return False, f"Video file not found: {video_path}"
    if path.suffix.lower() not in SUPPORTED_VIDEO_FORMATS:
        return False, (
            f"Unsupported video format '{path.suffix}'. "
            f"Supported formats: {', '.join(SUPPORTED_VIDEO_FORMATS)}"
        )
    return True, ""


def validate_time_range(
    start_time: float,
    end_time: float,
    duration: float,
) -> tuple[bool, str]:
    """Validate that a time range is within the video's duration.

    Args:
        start_time: Start time in seconds.
        end_time: End time in seconds.
        duration: Total video duration in seconds.

    Returns:
        A ``(is_valid, error_message)`` tuple.
    """
    if start_time < 0:
        return False, "Start time must be >= 0."
    if end_time <= start_time:
        return False, "End time must be greater than start time."
    if end_time > duration:
        return False, (
            f"End time ({end_time}s) exceeds video duration ({duration:.2f}s)."
        )
    return True, ""
