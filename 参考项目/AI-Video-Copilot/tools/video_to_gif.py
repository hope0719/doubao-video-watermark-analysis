"""
Video to GIF Tool

Converts a segment of a video into an animated GIF.
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
        "name": "video_to_gif",
        "description": (
            "Convert a segment of a video into an animated GIF image. "
            "Use this tool when the user wants to create a GIF from a video, "
            "convert a video clip to GIF format, or make an animated image "
            "from a portion of a video."
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
                        "The start time (in seconds) of the segment to convert. "
                        "Must be >= 0."
                    ),
                },
                "end_time": {
                    "type": "number",
                    "description": (
                        "The end time (in seconds) of the segment to convert. "
                        "Must be greater than start_time and not exceed the "
                        "video duration."
                    ),
                },
                "fps": {
                    "type": "integer",
                    "description": (
                        "Frames per second for the output GIF. "
                        "Higher values produce smoother animation but larger "
                        "file sizes. Typical range: 10-24. Default is 10."
                    ),
                    "default": 10,
                },
            },
            "required": ["video_path", "start_time", "end_time"],
        },
    },
}


# ---------------------------------------------------------------------------
# Tool implementation
# ---------------------------------------------------------------------------

def video_to_gif(
    video_path: str,
    start_time: float,
    end_time: float,
    fps: int = 10,
) -> dict:
    """Convert a video segment to an animated GIF.

    Args:
        video_path: Absolute path to the input video file.
        start_time: Start time of the segment in seconds (>= 0).
        end_time: End time of the segment in seconds (> start_time).
        fps: Frames per second for the GIF (default ``10``).

    Returns:
        A dict with keys:
        - ``success`` (bool): Whether the operation succeeded.
        - ``message`` (str): Human-readable result description.
        - ``output_path`` (str | None): Path to the output GIF on success.
    """
    t0 = time.time()
    logger.info("video_to_gif called: path=%s, start=%s, end=%s, fps=%s",
                video_path, start_time, end_time, fps)

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

        output_path = generate_output_filename("gif", ".gif")
        subclip = clip.subclip(start_time, end_time)
        subclip.write_gif(
            output_path,
            fps=fps,
            logger=None,
        )

        elapsed = time.time() - t0
        logger.info("video_to_gif completed in %.2fs -> %s", elapsed, output_path)
        return {
            "success": True,
            "message": (
                f"Successfully created GIF from {start_time}s to {end_time}s. "
                f"Output saved to {output_path}"
            ),
            "output_path": output_path,
        }

    except Exception as exc:
        logger.exception("video_to_gif failed with unexpected error")
        return {
            "success": False,
            "message": f"Error creating GIF: {exc}",
            "output_path": None,
        }
    finally:
        if clip is not None:
            try:
                clip.close()
            except Exception:
                pass
