"""
Extract Audio Tool

Extracts the audio track from a video file and saves it as an MP3.
"""

import time
import logging
from moviepy.editor import VideoFileClip

from utils import generate_output_filename, validate_video_path

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# OpenAI Function Calling schema
# ---------------------------------------------------------------------------
SCHEMA: dict = {
    "type": "function",
    "function": {
        "name": "extract_audio",
        "description": (
            "Extract the audio track from a video file and save it as an MP3 "
            "file. Use this tool when the user wants to get the audio from a "
            "video, separate the sound/music/speech from a video, or convert "
            "video audio to an audio-only format."
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
                "bitrate": {
                    "type": "string",
                    "description": (
                        "Audio bitrate for the output MP3 file. "
                        "Higher values produce better quality but larger files. "
                        "Common values: '128k' (default), '192k', '256k', '320k'."
                    ),
                    "default": "192k",
                },
            },
            "required": ["video_path"],
        },
    },
}


# ---------------------------------------------------------------------------
# Tool implementation
# ---------------------------------------------------------------------------

def extract_audio(
    video_path: str,
    bitrate: str = "192k",
) -> dict:
    """Extract audio from a video and save as MP3.

    Args:
        video_path: Absolute path to the input video file.
        bitrate: Audio bitrate for the output (default ``"192k"``).

    Returns:
        A dict with keys:
        - ``success`` (bool): Whether the operation succeeded.
        - ``message`` (str): Human-readable result description.
        - ``output_path`` (str | None): Path to the output MP3 on success.
    """
    t0 = time.time()
    logger.info("extract_audio called: path=%s, bitrate=%s", video_path, bitrate)

    # --- Validate input file ---
    valid, err = validate_video_path(video_path)
    if not valid:
        logger.error("Validation failed: %s", err)
        return {"success": False, "message": err, "output_path": None}

    clip = None
    try:
        clip = VideoFileClip(video_path)

        if clip.audio is None:
            msg = "The video does not contain an audio track."
            logger.error(msg)
            return {"success": False, "message": msg, "output_path": None}

        output_path = generate_output_filename("audio", ".mp3")
        clip.audio.write_audiofile(
            output_path,
            bitrate=bitrate,
            logger=None,
        )

        elapsed = time.time() - t0
        logger.info("extract_audio completed in %.2fs -> %s", elapsed, output_path)
        return {
            "success": True,
            "message": f"Successfully extracted audio from video. Output saved to {output_path}",
            "output_path": output_path,
        }

    except Exception as exc:
        logger.exception("extract_audio failed with unexpected error")
        return {
            "success": False,
            "message": f"Error extracting audio: {exc}",
            "output_path": None,
        }
    finally:
        if clip is not None:
            try:
                clip.close()
            except Exception:
                pass
