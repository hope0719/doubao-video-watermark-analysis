"""
Generate Video Tool (Doubao Seedance)

Uses the Volcengine Ark platform's Seedance model to generate
a short video clip from a natural-language description.

The Volcengine Ark API uses a RESTful async workflow:
  POST /contents/generations/tasks  -> submit task
  GET  /contents/generations/tasks/{id}  -> poll status
  On "succeeded", download video_url from the response.

API Reference:
  https://www.volcengine.com/docs/82379/1520757
"""

from __future__ import annotations

import os
import time
import logging

import requests

from utils import generate_output_filename

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (loaded from environment at import time)
# ---------------------------------------------------------------------------
_VOLC_API_KEY: str = os.getenv("VOLC_API_KEY", "")
_VOLC_BASE_URL: str = os.getenv(
    "VOLC_BASE_URL",
    "https://ark.cn-beijing.volces.com/api/v3",
)
_VOLC_MODEL_ID: str = os.getenv(
    "VOLC_MODEL_ID",
    "doubao-seedance-1-5-pro-251215",
)

# Polling configuration
_POLL_INTERVAL: int = 3       # seconds between poll attempts
_MAX_POLL_SECONDS: int = 300  # max total wait time


def update_volc_config(
    api_key: str = "",
    base_url: str = "",
    model_id: str = "",
) -> None:
    """Update Volcengine configuration at runtime (called from UI).

    Only non-empty values are applied; empty strings are ignored.
    """
    global _VOLC_API_KEY, _VOLC_BASE_URL, _VOLC_MODEL_ID
    if api_key and api_key.strip():
        _VOLC_API_KEY = api_key.strip()
    if base_url and base_url.strip():
        _VOLC_BASE_URL = base_url.strip()
    if model_id and model_id.strip():
        _VOLC_MODEL_ID = model_id.strip()

# ---------------------------------------------------------------------------
# OpenAI Function Calling schema
# ---------------------------------------------------------------------------
SCHEMA: dict = {
    "type": "function",
    "function": {
        "name": "generate_video",
        "description": (
            "Generate a short AI video from a text description using the "
            "Doubao Seedance model. Use this tool when the user wants to "
            "create a new video from a text prompt, generate an AI video "
            "clip, or produce a video based on a scene description. The "
            "user provides a natural-language description of the desired "
            "video content, and the model generates a short video clip."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prompt": {
                    "type": "string",
                    "description": (
                        "A detailed natural-language description of the video "
                        "to generate. The more specific and vivid the "
                        "description, the better the result. Example: 'A cat "
                        "playing piano in a cozy living room with warm "
                        "lighting'."
                    ),
                },
                "resolution": {
                    "type": "string",
                    "description": (
                        "Output video resolution. Supported values: '480p', "
                        "'720p', '1080p'. Default is '720p'."
                    ),
                    "default": "720p",
                    "enum": ["480p", "720p", "1080p"],
                },
                "duration": {
                    "type": "integer",
                    "description": (
                        "Duration of the generated video in seconds. "
                        "Supported range: 1-10. Default is 5."
                    ),
                    "default": 5,
                },
            },
            "required": ["prompt"],
        },
    },
}


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_headers() -> dict:
    """Return HTTP headers for Volcengine Ark API requests."""
    return {
        "Authorization": f"Bearer {_VOLC_API_KEY}",
        "Content-Type": "application/json",
    }


def _build_text_prompt(prompt: str, resolution: str, duration: int) -> str:
    """Build the text prompt with embedded parameters.

    The Seedance API expects resolution and duration as inline parameters
    appended to the text prompt, e.g.:
        "A cat playing piano  --resolution 720p  --duration 5"
    """
    return f"{prompt}  --resolution {resolution}  --duration {duration}"


def _submit_task(prompt: str, resolution: str, duration: int) -> str:
    """Submit a video generation task and return the task ID.

    Raises:
        RuntimeError: If the API returns an error or no task ID.
    """
    text_prompt = _build_text_prompt(prompt, resolution, duration)
    url = f"{_VOLC_BASE_URL}/contents/generations/tasks"

    logger.info("Submitting video generation task: model=%s, prompt='%s'",
                _VOLC_MODEL_ID, text_prompt[:80])

    body = {
        "model": _VOLC_MODEL_ID,
        "content": [{"type": "text", "text": text_prompt}],
    }

    try:
        resp = requests.post(url, headers=_get_headers(), json=body, timeout=30)
        resp.raise_for_status()
        data = resp.json()
    except requests.HTTPError as exc:
        error_body = ""
        if exc.response is not None:
            try:
                error_body = exc.response.json()
            except Exception:
                error_body = exc.response.text
        logger.error("Submit task failed (HTTP %s): %s",
                     exc.response.status_code if exc.response else "?", error_body)
        raise RuntimeError(
            f"Failed to submit video generation task "
            f"(HTTP {exc.response.status_code if exc.response else '?'}): {error_body}"
        )
    except Exception as exc:
        logger.error("Submit task failed: %s", exc)
        raise RuntimeError(f"Failed to submit video generation task: {exc}")

    task_id = data.get("id", "") if isinstance(data, dict) else ""
    if not task_id:
        raise RuntimeError(f"API did not return a task ID. Response: {data}")

    logger.info("Task submitted successfully, ID: %s", task_id)
    return task_id


def _poll_task(task_id: str) -> str:
    """Poll the task until it completes and return the video URL.

    Raises:
        RuntimeError: If the task fails or times out.
    """
    url = f"{_VOLC_BASE_URL}/contents/generations/tasks/{task_id}"
    elapsed = 0

    while elapsed < _MAX_POLL_SECONDS:
        time.sleep(_POLL_INTERVAL)
        elapsed += _POLL_INTERVAL

        try:
            resp = requests.get(url, headers=_get_headers(), timeout=30)
            resp.raise_for_status()
            data = resp.json()
        except requests.RequestException as exc:
            logger.warning("Poll request failed (%ds elapsed): %s", elapsed, exc)
            continue

        if not isinstance(data, dict):
            logger.warning("Unexpected poll response type: %s", type(data))
            continue

        status = data.get("status", "")
        logger.info("Task %s status: %s (%ds elapsed)", task_id, status, elapsed)

        if status == "succeeded":
            # Try multiple response paths for video_url
            video_url = ""
            if isinstance(data.get("content"), dict):
                video_url = data["content"].get("video_url", "")
            if not video_url and isinstance(data.get("data"), dict):
                video_url = data["data"].get("video_url", "")
            if not video_url:
                raise RuntimeError(
                    f"Task succeeded but no video_url found. Response: {data}"
                )
            return video_url

        if status in ("failed", "cancelled"):
            error_msg = data.get("error", {})
            if isinstance(error_msg, dict):
                error_msg = error_msg.get("message", "Unknown error")
            raise RuntimeError(f"Task {task_id} {status}: {error_msg}")

        # status is "queued" or "running" -> keep polling

    raise RuntimeError(
        f"Task {task_id} did not complete within {_MAX_POLL_SECONDS} seconds."
    )


def _download_video(video_url: str, output_path: str) -> None:
    """Download the generated video to the local file system.

    Raises:
        RuntimeError: If the download fails.
    """
    logger.info("Downloading video from %s ...", video_url[:80])
    resp = requests.get(video_url, timeout=120)
    resp.raise_for_status()

    with open(output_path, "wb") as f:
        f.write(resp.content)

    file_size_mb = len(resp.content) / (1024 * 1024)
    logger.info("Video downloaded: %.2f MB -> %s", file_size_mb, output_path)


# ---------------------------------------------------------------------------
# Tool implementation
# ---------------------------------------------------------------------------

def generate_video(
    prompt: str,
    resolution: str = "720p",
    duration: int = 5,
) -> dict:
    """Generate a short AI video from a text prompt using Doubao Seedance.

    Args:
        prompt: Natural-language description of the desired video.
        resolution: Output resolution, one of ``"480p"``, ``"720p"``,
            ``"1080p"`` (default ``"720p"``).
        duration: Video duration in seconds, 1-10 (default ``5``).

    Returns:
        A dict with keys:
        - ``success`` (bool): Whether the operation succeeded.
        - ``message`` (str): Human-readable result description.
        - ``output_path`` (str | None): Path to the output MP4 on success.
    """
    t0 = time.time()
    logger.info("generate_video called: prompt='%s', resolution=%s, duration=%s",
                prompt[:60], resolution, duration)

    # --- Guard: API key ---
    if not _VOLC_API_KEY:
        msg = (
            "Volcengine API Key is not configured. "
            "Please enter your Volcengine API Key in the settings panel above."
        )
        logger.error(msg)
        return {"success": False, "message": msg, "output_path": None}

    # --- Validate parameters ---
    if not prompt or not prompt.strip():
        return {
            "success": False,
            "message": "Prompt cannot be empty.",
            "output_path": None,
        }
    if duration < 1 or duration > 10:
        return {
            "success": False,
            "message": "Duration must be between 1 and 10 seconds.",
            "output_path": None,
        }
    if resolution not in ("480p", "720p", "1080p"):
        return {
            "success": False,
            "message": f"Unsupported resolution '{resolution}'. Use 480p, 720p, or 1080p.",
            "output_path": None,
        }

    try:
        # Step 1: Submit task
        task_id = _submit_task(prompt, resolution, duration)

        # Step 2: Poll until complete
        video_url = _poll_task(task_id)

        # Step 3: Download video
        output_path = generate_output_filename("generated", ".mp4")
        _download_video(video_url, output_path)

        elapsed = time.time() - t0
        logger.info("generate_video completed in %.2fs -> %s", elapsed, output_path)
        return {
            "success": True,
            "message": (
                f"Successfully generated a {duration}s {resolution} video. "
                f"Output saved to {output_path}"
            ),
            "output_path": output_path,
        }

    except requests.RequestException as exc:
        logger.exception("Network error during video generation")
        return {
            "success": False,
            "message": f"Network error during video generation: {exc}",
            "output_path": None,
        }
    except Exception as exc:
        logger.exception("Video generation failed")
        return {
            "success": False,
            "message": f"Error generating video: {exc}",
            "output_path": None,
        }
