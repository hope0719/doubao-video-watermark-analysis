"""
Configuration management for AI Video Copilot.

All configuration values are loaded from environment variables
or .env file. No secrets are ever hardcoded.
"""

from __future__ import annotations

import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BASE_DIR: Path = Path(__file__).resolve().parent
OUTPUT_DIR: Path = BASE_DIR / "outputs"
UPLOAD_DIR: Path = BASE_DIR / "uploads"
ASSETS_DIR: Path = BASE_DIR / "assets"

# Ensure runtime directories exist
OUTPUT_DIR.mkdir(exist_ok=True)
UPLOAD_DIR.mkdir(exist_ok=True)

# ---------------------------------------------------------------------------
# OpenAI / LLM Configuration
# ---------------------------------------------------------------------------
OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL: str = os.getenv(
    "OPENAI_BASE_URL",
    "https://dashscope.aliyuncs.com/compatible-mode/v1",
)
MODEL_NAME: str = os.getenv("MODEL_NAME", "qwen-plus")

# ---------------------------------------------------------------------------
# Application Settings
# ---------------------------------------------------------------------------
APP_TITLE: str = "AI Video Copilot"
APP_DESCRIPTION: str = (
    "An intelligent video editing assistant powered by LLM. "
    "Upload a video and describe what you want to do in natural language."
)
MAX_FILE_SIZE_MB: int = int(os.getenv("MAX_FILE_SIZE_MB", "500"))
SUPPORTED_VIDEO_FORMATS: list[str] = [
    ".mp4", ".avi", ".mov", ".mkv", ".webm", ".flv",
]

# ---------------------------------------------------------------------------
# Logging Configuration
# ---------------------------------------------------------------------------
LOG_FILE: str = str(BASE_DIR / "app.log")
LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO").upper()

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.FileHandler(LOG_FILE, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)

logger = logging.getLogger("ai_video_copilot")
