"""
Video processing tools for AI Video Copilot.

Each tool is a standalone module that exports:
- A function that performs the video operation
- A SCHEMA dict conforming to OpenAI Function Calling specification

The tool_registry maps tool names to their handler functions,
making it trivial to add new tools in the future.
"""

from __future__ import annotations

from collections.abc import Callable

from tools.trim_video import trim_video, SCHEMA as TRIM_VIDEO_SCHEMA
from tools.extract_audio import extract_audio, SCHEMA as EXTRACT_AUDIO_SCHEMA
from tools.video_to_gif import video_to_gif, SCHEMA as VIDEO_TO_GIF_SCHEMA
from tools.generate_video import generate_video, SCHEMA as GENERATE_VIDEO_SCHEMA

# ---------------------------------------------------------------------------
# Tool Registry: name -> handler function
# ---------------------------------------------------------------------------
tool_registry: dict[str, Callable] = {
    "trim_video": trim_video,
    "extract_audio": extract_audio,
    "video_to_gif": video_to_gif,
    "generate_video": generate_video,
}

# ---------------------------------------------------------------------------
# OpenAI Function Calling schemas
# ---------------------------------------------------------------------------
TOOL_SCHEMAS: list[dict] = [
    TRIM_VIDEO_SCHEMA,
    EXTRACT_AUDIO_SCHEMA,
    VIDEO_TO_GIF_SCHEMA,
    GENERATE_VIDEO_SCHEMA,
]

__all__ = [
    "trim_video",
    "extract_audio",
    "video_to_gif",
    "generate_video",
    "tool_registry",
    "TOOL_SCHEMAS",
]
