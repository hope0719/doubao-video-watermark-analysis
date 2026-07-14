"""
Trim Video Tool

Cuts a video clip between specified start and end times.
Outputs an MP4 file to the configured outputs directory.
"""

import time
import logging
from moviepy.editor import VideoFileClip

from utils import generate_output_filename, validate_video_path, validate_time_range

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI Function Calling schema
# ---------------------------------------------------------------------------
SCHEMA: dict = {
    "type": "function",
    "function": {
        "name": "trim_video",
        "description": (
            "Trim (cut) a video to extract a clip between two time points. "
            "Use this tool when the user wants to cut a specific segment from "
            "a video, extract a portion of a video, or keep only a certain "
            "time range of a video."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "video_path": {
                    "type": "string",
                    "description": (
                        "The absolute file system path to the input video file. "
                        "This should be the path of the video the user uploaded."
                    ),
                },
                "start_time": {
                    "type": "number",
                    "description": (
                        "The start time of the clip in seconds. "
                        "Must be >= 0 and less than end_time. "
                        "Example: 10 means the clip starts at the 10-second mark."
                    ),
                },
                "end_time": {
                    "type": "number",
                    "description": (
                        "The end time of the clip in seconds. "
                        "Must be greater than start_time and must not exceed "
                        "the total duration of the video. "
                        "Example: 20 means the clip ends at the 20-second mark."
                    ),
                },
            },
            "required": ["video_path", "start_time", "end_time"],
        },
    },
}


# ---------------------------------------------------------------------------
# Tool implementation
# ---------------------------------------------------------------------------

def trim_video(
    video_path: str,
    start_time: float,
    end_time: float,
) -> dict:
    """Trim a video to extract a clip between start_time and end_time.

    Args:
        video_path: Absolute path to the input video file.
        start_time: Start time of the clip in seconds (>= 0).
        end_time: End time of the clip in seconds (> start_time).

    Returns:
        A dict with keys:
        - ``success`` (bool): Whether the operation succeeded.
        - ``message`` (str): Human-readable result description.
        - ``output_path`` (str | None): Path to the output MP4 on success.
    """
    t0 = time.time()
    logger.info("trim_video called: path=%s, start=%s, end=%s",
                video_path, start_time, end_time)

    # --- Validate input file ---
    valid, err = validate_video_path(video_path)
    if not valid:
        logger.error("Validation failed: %s", err)
        return {"success": False, "message": err, "output_path": None}

    clip = None
    try:
        clip = VideoFileClip(video_path)

        # --- Validate time range ---
        valid, err = validate_time_range(start_time, end_time, clip.duration)
        if not valid:
            logger.error("Time validation failed: %s", err)
            return {"success": False, "message": err, "output_path": None}

        output_path = generate_output_filename("trim", ".mp4")
        subclip = clip.subclip(start_time, end_time)
        subclip.write_videofile(
            output_path,
            codec="libx264",
            audio_codec="aac",
            logger=None,          # suppress moviepy progress bars
        )

        elapsed = time.time() - t0
        logger.info("trim_video completed in %.2fs -> %s", elapsed, output_path)
        return {
            "success": True,
            "message": (
                f"Successfully trimmed video from {start_time}s to {end_time}s. "
                f"Output saved to {output_path}"
            ),
            "output_path": output_path,
        }

    except Exception as exc:
        logger.exception("trim_video failed with unexpected error")
        return {
            "success": False,
            "message": f"Error trimming video: {exc}",
            "output_path": None,
        }
    finally:
        if clip is not None:
            try:
                clip.close()
            except Exception:
                pass
