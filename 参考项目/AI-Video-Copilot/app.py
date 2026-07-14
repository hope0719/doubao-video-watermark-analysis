"""
Gradio Web UI for AI Video Copilot.

Provides a modern, polished Blocks-based interface with:
- Custom CSS theme with gradient header and card-style panels
- Tabbed interface (Edit Video / Generate Video / Import from URL)
- Douyin/TikTok video import by URL
- Example prompts for quick start
- Real-time status updates during processing
- Auto-switching result display (video / audio / GIF)

Run with:
    python app.py
"""

from __future__ import annotations

import re
import shutil
import logging
import subprocess
from pathlib import Path

import gradio as gr

from config import (
    APP_TITLE,
    APP_DESCRIPTION,
    UPLOAD_DIR,
    OUTPUT_DIR,
    MAX_FILE_SIZE_MB,
    SUPPORTED_VIDEO_FORMATS,
)
from agent_core import process_message, create_session
from tools.generate_video import update_volc_config

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Custom CSS
# ---------------------------------------------------------------------------
CUSTOM_CSS = """
/* === Global === */
.gradio-container {
    max-width: 1280px !important;
    margin: 0 auto !important;
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
}

/* === Animated Header Banner === */
.header-banner {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
    background-size: 200% 200%;
    animation: gradientShift 8s ease infinite;
    border-radius: 16px;
    padding: 32px 40px;
    margin-bottom: 24px;
    color: white;
    box-shadow: 0 8px 32px rgba(102, 126, 234, 0.3);
    position: relative;
    overflow: hidden;
}
.header-banner::before {
    content: '';
    position: absolute;
    top: -50%;
    right: -50%;
    width: 200%;
    height: 200%;
    background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
    animation: shimmer 6s linear infinite;
}
@keyframes gradientShift {
    0%, 100% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
}
@keyframes shimmer {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
}
.header-banner h1 {
    font-size: 2.1em;
    font-weight: 800;
    margin: 0 0 8px 0;
    letter-spacing: -0.5px;
    position: relative;
    text-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.header-banner p {
    font-size: 1.05em;
    opacity: 0.92;
    margin: 0;
    line-height: 1.6;
    position: relative;
}

/* === Cards === */
.card {
    background: #ffffff;
    border-radius: 14px;
    border: 1px solid #e8ecf0;
    padding: 20px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}
.card:hover {
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
}

/* === Tab styling === */
.tab-nav button {
    font-weight: 600 !important;
    font-size: 0.95em !important;
    padding: 10px 24px !important;
    border-radius: 8px 8px 0 0 !important;
    transition: all 0.25s ease !important;
}
.tab-nav button.selected {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3) !important;
}
.tab-nav button:not(.selected):hover {
    background: #f0f4ff !important;
}

/* === Chatbot === */
#chatbot {
    border-radius: 14px !important;
    border: 1px solid #e8ecf0 !important;
    transition: box-shadow 0.3s ease !important;
}
#chatbot:focus-within {
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.15) !important;
}
#chatbot .message {
    border-radius: 12px !important;
    animation: fadeInUp 0.3s ease;
}
@keyframes fadeInUp {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}

/* === Buttons === */
.primary-btn {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    border: none !important;
    border-radius: 10px !important;
    font-weight: 600 !important;
    letter-spacing: 0.3px;
    transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25) !important;
}
.primary-btn:hover {
    transform: translateY(-2px) !important;
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4) !important;
}
.primary-btn:active {
    transform: translateY(0) !important;
}

/* === Example buttons === */
.example-btn {
    border-radius: 20px !important;
    border: 1px solid #d0d5dd !important;
    background: #f8f9fa !important;
    font-size: 0.85em !important;
    padding: 6px 16px !important;
    transition: all 0.25s ease !important;
}
.example-btn:hover {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%) !important;
    color: white !important;
    border-color: #667eea !important;
    transform: translateY(-1px) !important;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.25) !important;
}

/* === Status indicator with animations === */
.status-box {
    border-radius: 12px !important;
    padding: 14px 18px !important;
    font-size: 0.9em;
    transition: all 0.3s ease;
}
.status-waiting {
    background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
    border-left: 4px solid #667eea;
}
.status-processing {
    background: linear-gradient(135deg, #fff7ed 0%, #fff3e0 100%);
    border-left: 4px solid #f59e0b;
    position: relative;
}
.status-processing::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    margin-right: 8px;
    border-radius: 50%;
    background: #f59e0b;
    animation: pulse 1.2s ease-in-out infinite;
}
@keyframes pulse {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(0.85); }
}
.status-success {
    background: linear-gradient(135deg, #f0fdf4 0%, #e8faf0 100%);
    border-left: 4px solid #22c55e;
    animation: successPop 0.4s ease;
}
@keyframes successPop {
    0% { transform: scale(0.98); }
    50% { transform: scale(1.02); }
    100% { transform: scale(1); }
}
.status-error {
    background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
    border-left: 4px solid #ef4444;
    animation: shake 0.4s ease;
}
@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-4px); }
    75% { transform: translateX(4px); }
}

/* === Video info badge === */
.video-info-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 0.82em;
    font-weight: 600;
    margin: 8px 0;
    animation: fadeInUp 0.3s ease;
}
.video-info-badge .info-icon {
    font-size: 1.1em;
}

/* === Section headers === */
.section-title {
    font-size: 1.1em;
    font-weight: 700;
    color: #1f2937;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.section-title .icon {
    font-size: 1.2em;
}

/* === Footer === */
.footer {
    text-align: center;
    padding: 24px 20px;
    color: #9ca3af;
    font-size: 0.85em;
    border-top: 1px solid #e8ecf0;
    margin-top: 32px;
    transition: color 0.2s;
}
.footer:hover {
    color: #6b7280;
}
.footer a {
    color: #667eea;
    text-decoration: none;
    font-weight: 500;
    transition: color 0.2s;
}
.footer a:hover {
    color: #764ba2;
    text-decoration: underline;
}

/* === Upload area === */
.upload-area {
    border-radius: 14px !important;
    border: 2px dashed #d0d5dd !important;
    transition: all 0.3s ease !important;
}
.upload-area:hover {
    border-color: #667eea !important;
    background: rgba(102, 126, 234, 0.03) !important;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.08) !important;
}

/* === Tool badges === */
.tool-badge {
    display: inline-block;
    background: linear-gradient(135deg, #f0f4ff 0%, #e8edff 100%);
    color: #667eea;
    padding: 4px 12px;
    border-radius: 14px;
    font-size: 0.8em;
    font-weight: 600;
    margin: 3px 4px 3px 0;
    transition: all 0.2s ease;
    border: 1px solid rgba(102, 126, 234, 0.15);
}
.tool-badge:hover {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    transform: translateY(-1px);
}

/* === URL import section === */
.url-import-box {
    background: linear-gradient(135deg, #f8f9fa 0%, #e8ecf0 100%);
    border-radius: 14px;
    padding: 16px;
    border: 1px solid #e8ecf0;
    transition: border-color 0.2s;
}
.url-import-box:focus-within {
    border-color: #667eea;
}

/* === Accordion styling === */
.accordion-label {
    font-weight: 600 !important;
    font-size: 0.95em !important;
}

/* === Responsive === */
@media (max-width: 768px) {
    .header-banner { padding: 20px; border-radius: 12px; }
    .header-banner h1 { font-size: 1.5em; }
    .header-banner p { font-size: 0.95em; }
    .card { padding: 16px; }
    .status-box { padding: 10px 14px !important; }
}
@media (max-width: 480px) {
    .header-banner { padding: 16px; }
    .header-banner h1 { font-size: 1.3em; }
    .example-btn { font-size: 0.75em !important; padding: 4px 10px !important; }
}

/* === API Settings Panel === */
.api-settings {
    background: #f8f9fa;
    border-radius: 14px;
    border: 1px solid #e8ecf0;
    padding: 16px 20px;
    margin-bottom: 20px;
}
.api-settings .api-title {
    font-size: 0.95em;
    font-weight: 600;
    color: #374151;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 6px;
}
.api-key-status {
    display: inline-block;
    padding: 2px 10px;
    border-radius: 10px;
    font-size: 0.75em;
    font-weight: 600;
    margin-left: 8px;
}
.api-key-set {
    background: #dcfce7;
    color: #16a34a;
}
.api-key-unset {
    background: #fef2f2;
    color: #ef4444;
}

/* === Category label for examples === */
.example-category {
    font-size: 0.78em;
    font-weight: 600;
    color: #9ca3af;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-bottom: 4px;
}
"""


# ---------------------------------------------------------------------------
# File upload handler
# ---------------------------------------------------------------------------

def handle_upload(video_file) -> tuple[str, list, list]:
    """Copy the uploaded file into the uploads/ directory and reset session.

    Returns:
        Tuple of (video_path, new_chat_history, new_messages).
    """
    if video_file is None:
        return "", [], create_session()

    src = Path(video_file.name) if hasattr(video_file, "name") else Path(video_file)
    dest = UPLOAD_DIR / src.name
    shutil.copy2(str(src), str(dest))

    video_path = str(dest.resolve())
    file_size_mb = dest.stat().st_size / (1024 * 1024)
    logger.info("Video uploaded: %s (%.2f MB)", video_path, file_size_mb)

    # Try to get video duration
    duration_str = ""
    try:
        from moviepy.editor import VideoFileClip
        clip = VideoFileClip(video_path)
        mins = int(clip.duration // 60)
        secs = int(clip.duration % 60)
        duration_str = f" | {mins}:{secs:02d}" if mins > 0 else f" | {secs}s"
        clip.close()
    except Exception:
        pass

    messages = create_session()
    welcome = (
        f"**{src.name}** uploaded successfully!\n\n"
        f'<span class="video-info-badge">'
        f'<span class="info-icon">📹</span> '
        f'{file_size_mb:.1f} MB{duration_str}'
        f'</span>\n\n'
        "What would you like to do? Try an example prompt below, "
        "or type your own instruction."
    )
    return video_path, [[None, welcome]], messages


# ---------------------------------------------------------------------------
# Douyin / URL video download handler
# ---------------------------------------------------------------------------

def _extract_video_url(text: str) -> str:
    """Extract a video URL from user input text.

    Handles:
    - Direct URLs: https://www.douyin.com/video/xxx
    - Short share links: https://v.douyin.com/xxxxx/
    - Douyin share text: "0.02 LWM:/ ... https://v.douyin.com/xxx/ ..."
    - Other platform URLs: YouTube, Bilibili, TikTok, etc.

    Returns the first valid URL found, or empty string if none.
    """
    if not text:
        return ""

    # Priority patterns for video platforms
    video_url_patterns = [
        # Douyin short link (most common from share text)
        r"https?://v\.douyin\.com/[A-Za-z0-9]+/?",
        # Douyin full video link
        r"https?://www\.douyin\.com/video/\d+",
        # Douyin note/discover link
        r"https?://www\.douyin\.com/(?:note|discover)/\d+",
        # TikTok
        r"https?://(?:www\.|vm\.)?tiktok\.com/[^\s]+",
        # YouTube
        r"https?://(?:www\.)?(?:youtube\.com/watch\?v=|youtu\.be/)[^\s&]+",
        # Bilibili
        r"https?://(?:www\.)?bilibili\.com/video/[^\s]+",
        # Kuaishou
        r"https?://v\.kuaishou\.com/[A-Za-z0-9]+",
        # Weibo video
        r"https?://(?:www\.)?weibo\.com/[^\s]+",
        # Generic URL fallback
        r"https?://[^\s<>\"']+",
    ]

    for pattern in video_url_patterns:
        match = re.search(pattern, text)
        if match:
            return match.group(0).rstrip("/")

    return ""


def _resolve_short_url(short_url: str) -> str:
    """Resolve a short URL (like v.douyin.com) to its final destination.

    Follows redirects and returns the canonical URL.
    """
    import requests as req
    try:
        resp = req.head(
            short_url,
            allow_redirects=True,
            timeout=15,
            headers={
                "User-Agent": (
                    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                    "AppleWebKit/537.36 (KHTML, like Gecko) "
                    "Chrome/120.0.0.0 Safari/537.36"
                ),
            },
        )
        resolved = resp.url
        logger.info("Short URL resolved: %s -> %s", short_url, resolved)
        return resolved
    except Exception as exc:
        logger.warning("Failed to resolve short URL: %s", exc)
        return short_url


def _download_douyin_video(video_url: str) -> str:
    """Download a Douyin video by scraping the mobile share page.

    Works without yt-dlp or browser cookies. Extracts the direct video
    CDN URL from the iesdouyin.com mobile page.

    Args:
        video_url: The resolved Douyin URL (e.g. douyin.com/video/xxx).

    Returns:
        Path to the downloaded MP4 file.

    Raises:
        RuntimeError: If the video cannot be extracted or downloaded.
    """
    import requests as req

    mobile_ua = (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) "
        "AppleWebKit/605.1.15 (KHTML, like Gecko) "
        "Version/17.0 Mobile/15E148 Safari/604.1"
    )

    # Extract video ID from URL
    vid_match = re.search(r"/video/(\d+)", video_url)
    if not vid_match:
        raise RuntimeError(
            f"Cannot extract video ID from URL: {video_url}"
        )
    video_id = vid_match.group(1)

    # Fetch mobile share page
    mobile_url = f"https://www.iesdouyin.com/share/video/{video_id}/"
    resp = req.get(
        mobile_url,
        headers={"User-Agent": mobile_ua},
        timeout=30,
    )
    if resp.status_code != 200:
        raise RuntimeError(
            f"Failed to fetch Douyin mobile page (HTTP {resp.status_code})"
        )

    # Extract play_addr URL from embedded page data
    play_match = re.search(
        r'"play_addr".*?"url_list":\s*\["(.*?)"\]',
        resp.text,
    )
    if not play_match:
        raise RuntimeError(
            "Could not find video URL in the Douyin page. "
            "The video may be private or deleted."
        )

    raw_url = play_match.group(1)
    play_url = raw_url.replace("\\u002F", "/").replace("\\u0026", "&")

    # Get no-watermark version
    no_wm_url = play_url.replace("/playwm/", "/play/")

    # Download the video
    dl_resp = req.get(
        no_wm_url,
        headers={
            "User-Agent": mobile_ua,
            "Referer": "https://www.douyin.com/",
        },
        timeout=120,
        stream=True,
        allow_redirects=True,
    )

    if dl_resp.status_code != 200:
        # Fallback to watermarked version
        dl_resp = req.get(
            play_url,
            headers={
                "User-Agent": mobile_ua,
                "Referer": "https://www.douyin.com/",
            },
            timeout=120,
            stream=True,
            allow_redirects=True,
        )

    if dl_resp.status_code != 200:
        raise RuntimeError(
            f"Failed to download video (HTTP {dl_resp.status_code})"
        )

    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = str(UPLOAD_DIR / f"douyin_{timestamp}_{video_id}.mp4")

    with open(output_path, "wb") as f:
        for chunk in dl_resp.iter_content(65536):
            f.write(chunk)

    file_size = Path(output_path).stat().st_size
    if file_size < 10000:
        raise RuntimeError(
            "Downloaded file is too small, video may not be available."
        )

    logger.info("Douyin video downloaded: %s (%.2f MB)",
                output_path, file_size / (1024 * 1024))
    return output_path


def handle_url_download(
    url: str,
) -> tuple[str, list, list, str]:
    """Download a video from a URL or share text (Douyin, TikTok, etc.).

    Supports pasting the full Douyin share text, e.g.:
        "0.02 LWM:/ ... https://v.douyin.com/xxxxx/ ..."
    The system will automatically extract the video URL.

    For Douyin: uses mobile page scraping (no cookies/yt-dlp needed).
    For other platforms: uses yt-dlp.

    Returns:
        Tuple of (video_path, chat_history, messages, status_html).
    """
    if not url or not url.strip():
        return "", [], create_session(), (
            '<div class="status-box status-error">'
            "<b>Status:</b> Please paste a video link first.</div>"
        )

    raw_input = url.strip()

    # Step 1: Extract a valid URL from the input
    video_url = _extract_video_url(raw_input)

    if not video_url:
        return "", [], create_session(), (
            '<div class="status-box status-error">'
            "<b>Status:</b> No valid video link found in your input. "
            "Please paste a Douyin share link like "
            "<code>https://v.douyin.com/xxxxx/</code> "
            "or a direct video URL.</div>"
        )

    logger.info("Extracted video URL: %s", video_url)

    # Step 2: Resolve short URLs
    short_domains = ["v.douyin.com", "vm.tiktok.com", "v.kuaishou.com"]
    if any(domain in video_url for domain in short_domains):
        video_url = _resolve_short_url(video_url)

    logger.info("Downloading video from: %s", video_url[:120])

    # Step 3: Download based on platform
    is_douyin = "douyin.com" in video_url or "iesdouyin.com" in video_url

    try:
        if is_douyin:
            # --- Douyin: use mobile page scraping ---
            output_path = _download_douyin_video(video_url)
            file_path = Path(output_path)
            file_name = file_path.name
            file_size_mb = file_path.stat().st_size / (1024 * 1024)
        else:
            # --- Other platforms: use yt-dlp ---
            output_template = str(UPLOAD_DIR / "url_download_%(id)s.%(ext)s")

            import sys
            venv_python = sys.executable
            cmd = [
                venv_python, "-m", "yt_dlp",
                "--no-playlist",
                "-o", output_template,
                "--no-check-certificates",
                "--no-warnings",
                "--socket-timeout", "30",
                "--retries", "3",
                video_url,
            ]

            result = subprocess.run(
                cmd, capture_output=True, text=True, timeout=300,
            )

            if result.returncode != 0:
                stderr = result.stderr.strip()
                logger.error("yt-dlp failed: %s", stderr)
                return "", [], create_session(), (
                    '<div class="status-box status-error">'
                    f"<b>Status:</b> Download failed. "
                    f"<small>{stderr[:200]}</small></div>"
                )

            downloaded_files = sorted(
                UPLOAD_DIR.glob("url_download_*"),
                key=lambda p: p.stat().st_mtime,
                reverse=True,
            )

            if not downloaded_files:
                return "", [], create_session(), (
                    '<div class="status-box status-error">'
                    "<b>Status:</b> Download completed but no file found.</div>"
                )

            output_path = str(downloaded_files[0].resolve())
            file_name = downloaded_files[0].name
            file_size_mb = downloaded_files[0].stat().st_size / (1024 * 1024)

        # --- Success ---
        logger.info("Video downloaded from URL: %s (%.2f MB)",
                    output_path, file_size_mb)

        messages = create_session()
        welcome = (
            f"Video imported from URL: **{file_name}** "
            f"({file_size_mb:.1f} MB)\n\n"
            "You can now edit this video. Switch to the **Edit Video** tab "
            "and describe what you'd like to do."
        )

        return (
            output_path,
            [[None, welcome]],
            messages,
            '<div class="status-box status-success">'
            f"<b>Status:</b> Video imported ({file_size_mb:.1f} MB)</div>",
        )

    except subprocess.TimeoutExpired:
        return "", [], create_session(), (
            '<div class="status-box status-error">'
            "<b>Status:</b> Download timed out (5 min). "
            "Please try a shorter video or check the URL.</div>"
        )
    except Exception as exc:
        logger.exception("URL download failed")
        return "", [], create_session(), (
            '<div class="status-box status-error">'
            f"<b>Status:</b> Download error: {exc}</div>"
        )


# ---------------------------------------------------------------------------
# Submit handler with streaming status updates
# ---------------------------------------------------------------------------

def handle_submit(
    message: str,
    video_path: str,
    history: list[list],
    messages: list[dict],
    active_tab: str,
    openai_key: str,
    openai_url: str,
    model: str,
    volc_key: str,
    volc_model: str,
):
    """Process a user message with streaming status updates.

    Yields intermediate UI updates for real-time feedback, then the final
    result.

    Args:
        message: The user's text input.
        video_path: Path to the uploaded/downloaded video (may be empty).
        history: Chat history.
        messages: Agent conversation messages.
        active_tab: Which tab the user is on ("edit" or "generate").
        openai_key: LLM API key from settings panel.
        openai_url: LLM base URL from settings panel.
        model: Model name from settings panel.
        volc_key: Volcengine API key from settings panel.
        volc_model: Volcengine model ID from settings panel.
    """
    # --- Validation ---
    if not message or not message.strip():
        yield (
            history,
            messages,
            gr.update(value="", placeholder="Type your instruction..."),
            gr.update(value=None, visible=False),
            gr.update(value=None, visible=False),
            gr.update(value=None, visible=False),
            '<div class="status-box status-error">'
            "<b>Status:</b> Please enter a message.</div>",
        )
        return

    # Determine if this is a generate request:
    # 1. If user is on the "Generate Video" tab -> always treat as generate
    # 2. Otherwise, check keywords in the message
    is_generate_tab = (active_tab == "generate")
    is_generate_keyword = any(
        kw in message.lower()
        for kw in [
            "generate", "create", "make a video", "ai video",
            "生成", "创建", "制作", "做一个视频", "ai生成",
            "generate a", "create a",
        ]
    )
    is_generate_request = is_generate_tab or is_generate_keyword

    if not video_path and not is_generate_request:
        yield (
            history,
            messages,
            gr.update(value="", placeholder="Upload a video or ask to generate one..."),
            gr.update(value=None, visible=False),
            gr.update(value=None, visible=False),
            gr.update(value=None, visible=False),
            '<div class="status-box status-error">'
            "<b>Status:</b> Please upload a video first (or import from URL), "
            'then describe the edit you want. To create a new video from text, '
            'switch to the "Generate Video" tab.</div>',
        )
        return

    # --- Step 1: Show "thinking" state ---
    history = history + [[message, None]]
    thinking_msg = (
        '<div class="status-box status-processing">'
        "<b>Status:</b> Analyzing your request...</div>"
    )
    yield (
        history,
        messages,
        gr.update(value="", interactive=False),
        gr.update(value=None, visible=False),
        gr.update(value=None, visible=False),
        gr.update(value=None, visible=False),
        thinking_msg,
    )

    # --- Step 2: Call agent ---
    history[-1][1] = "*Processing...*"
    yield (
        history,
        messages,
        gr.update(value="", interactive=False),
        gr.update(value=None, visible=False),
        gr.update(value=None, visible=False),
        gr.update(value=None, visible=False),
        '<div class="status-box status-processing">'
        "<b>Status:</b> Executing tool...</div>",
    )

    # Apply runtime API configuration overrides
    update_volc_config(api_key=volc_key, model_id=volc_model)

    reply, output_files = process_message(
        message, video_path, messages,
        openai_api_key=openai_key,
        openai_base_url=openai_url,
        model_name=model,
    )

    # --- Step 3: Show result ---
    history[-1][1] = reply

    video_out = gr.update(value=None, visible=False)
    audio_out = gr.update(value=None, visible=False)
    image_out = gr.update(value=None, visible=False)

    status_parts = []
    for fpath in output_files:
        ext = Path(fpath).suffix.lower()
        if ext in (".mp4", ".avi", ".mov", ".mkv", ".webm"):
            video_out = gr.update(value=fpath, visible=True)
            status_parts.append(f"Video: `{Path(fpath).name}`")
        elif ext in (".mp3", ".wav", ".aac", ".flac"):
            audio_out = gr.update(value=fpath, visible=True)
            status_parts.append(f"Audio: `{Path(fpath).name}`")
        elif ext == ".gif":
            image_out = gr.update(value=fpath, visible=True)
            status_parts.append(f"GIF: `{Path(fpath).name}`")

    if output_files:
        files_html = "<br>".join(status_parts)
        status_html = (
            '<div class="status-box status-success">'
            f"<b>Status:</b> Completed<br>{files_html}</div>"
        )
    else:
        status_html = (
            '<div class="status-box status-waiting">'
            "<b>Status:</b> No files generated.</div>"
        )

    yield (
        history,
        messages,
        gr.update(value="", interactive=True, placeholder="Type your next instruction..."),
        video_out,
        audio_out,
        image_out,
        status_html,
    )


# ---------------------------------------------------------------------------
# Tab change handler
# ---------------------------------------------------------------------------

def on_tab_change(evt: gr.SelectData) -> str:
    """Return the selected tab name when the user clicks a tab."""
    return evt.value


# ---------------------------------------------------------------------------
# Save settings handler
# ---------------------------------------------------------------------------

def handle_save_settings(
    openai_key: str,
    openai_url: str,
    model: str,
    volc_key: str,
    volc_model: str,
) -> str:
    """Save API settings and return a status message."""
    applied = []

    if openai_key and openai_key.strip():
        masked = openai_key.strip()[:8] + "..." + openai_key.strip()[-4:]
        applied.append(f"LLM API Key ({masked})")

    if openai_url and openai_url.strip():
        applied.append(f"LLM Base URL ({openai_url.strip()})")

    if model and model.strip():
        applied.append(f"Model ({model.strip()})")

    if volc_key and volc_key.strip():
        update_volc_config(api_key=volc_key)
        masked = volc_key.strip()[:8] + "..." + volc_key.strip()[-4:]
        applied.append(f"Volcengine API Key ({masked})")

    if volc_model and volc_model.strip():
        update_volc_config(model_id=volc_model)
        applied.append(f"Volcengine Model ({volc_model.strip()})")

    if applied:
        items = ", ".join(applied)
        return (
            '<div class="status-box status-success">'
            f"<b>Settings saved:</b> {items}</div>"
        )

    return (
        '<div class="status-box status-waiting">'
        "<b>Settings:</b> No changes. Leave fields empty to use "
        "defaults from .env file.</div>"
    )


# ---------------------------------------------------------------------------
# Build Gradio UI
# ---------------------------------------------------------------------------

def build_ui() -> gr.Blocks:
    """Construct and return the Gradio Blocks application."""

    with gr.Blocks(title=APP_TITLE, css=CUSTOM_CSS) as app:

        # ============================================================
        # HEADER
        # ============================================================
        gr.HTML("""
        <div class="header-banner">
            <h1>AI Video Copilot</h1>
            <p>Upload, edit, generate, and import videos through natural language
            conversation. Powered by LLM Function Calling and AI models.</p>
        </div>
        """)

        # ============================================================
        # API SETTINGS PANEL
        # ============================================================
        with gr.Accordion(
            "API Settings (enter your own keys)",
            open=False,
        ):
            gr.HTML(
                '<div style="color: #6b7280; font-size: 0.85em;'
                ' margin-bottom: 12px;">'
                "Enter your own API keys to use the service. "
                "Leave fields empty to use the default configuration "
                "from the .env file."
                "</div>"
            )

            gr.HTML(
                '<div class="api-title">'
                "LLM (Chat) Configuration</div>"
            )
            with gr.Row():
                api_key_input = gr.Textbox(
                    label="LLM API Key",
                    placeholder="sk-...",
                    type="password",
                    scale=2,
                )
                api_url_input = gr.Textbox(
                    label="LLM Base URL",
                    placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1",
                    scale=2,
                )
                model_input = gr.Textbox(
                    label="Model Name",
                    placeholder="qwen-plus",
                    scale=1,
                )

            gr.HTML(
                '<div class="api-title" style="margin-top: 12px;">'
                "Volcengine Seedance (Video Generation) Configuration</div>"
            )
            with gr.Row():
                volc_key_input = gr.Textbox(
                    label="Volcengine API Key",
                    placeholder="ark-...",
                    type="password",
                    scale=2,
                )
                volc_model_input = gr.Textbox(
                    label="Volcengine Model ID",
                    placeholder="doubao-seedance-1-5-pro-251215",
                    scale=1,
                )

            with gr.Row():
                save_settings_btn = gr.Button(
                    "Save Settings",
                    variant="primary",
                    size="sm",
                    elem_classes=["primary-btn"],
                )
            settings_status = gr.HTML(
                value=(
                    '<div class="status-box status-waiting">'
                    "<b>Settings:</b> Using defaults from .env file.</div>"
                ),
            )

        # --- Hidden state ---
        video_path_state = gr.State(value="")
        messages_state = gr.State(value=create_session())
        active_tab_state = gr.State(value="edit")

        with gr.Row(equal_height=False):

            # =========================================================
            # LEFT PANEL — Input
            # =========================================================
            with gr.Column(scale=5):

                # --- Video Upload ---
                gr.HTML(
                    '<div class="section-title">'
                    '<span class="icon">📹</span> Upload Video'
                    "</div>"
                )
                video_upload = gr.Video(
                    label="Drop a video file here or click to browse",
                    sources=["upload"],
                    height=180,
                    elem_classes=["upload-area"],
                )

                # --- Import from URL ---
                gr.HTML(
                    '<div class="section-title" style="margin-top: 12px;">'
                    '<span class="icon">🔗</span> Import from URL'
                    "</div>"
                )
                with gr.Row():
                    url_input = gr.Textbox(
                        placeholder="Paste a Douyin share text or video URL (e.g. https://v.douyin.com/xxx/)...",
                        scale=4,
                        show_label=False,
                        lines=1,
                        container=False,
                    )
                    download_btn = gr.Button(
                        "Download",
                        variant="secondary",
                        scale=1,
                        size="sm",
                    )

                # --- Tabs: Edit / Generate ---
                with gr.Tabs() as tabs:
                    with gr.Tab("Edit Video", id="edit"):
                        gr.HTML(
                            '<div style="margin: 8px 0 12px; color: #6b7280;'
                            ' font-size: 0.9em;">'
                            "Describe how to edit your uploaded or imported video. "
                            "Supported: trim, extract audio, convert to GIF."
                            "</div>"
                        )

                    with gr.Tab("Generate Video", id="generate"):
                        gr.HTML(
                            '<div style="margin: 8px 0 12px; color: #6b7280;'
                            ' font-size: 0.9em;">'
                            "Describe the video you want to create from scratch. "
                            "Powered by Doubao Seedance AI model."
                            "</div>"
                        )

                # --- Chat History ---
                chatbox = gr.Chatbot(
                    label="Conversation",
                    height=320,
                    show_copy_button=True,
                    elem_id="chatbot",
                    bubble_full_width=False,
                )

                # --- Input Row ---
                with gr.Row():
                    msg_input = gr.Textbox(
                        placeholder="Type your instruction here...",
                        scale=4,
                        show_label=False,
                        lines=1,
                        max_lines=3,
                        container=False,
                    )
                    submit_btn = gr.Button(
                        "Send",
                        variant="primary",
                        scale=1,
                        elem_classes=["primary-btn"],
                    )

                # --- Quick Actions ---
                with gr.Row():
                    clear_btn = gr.Button(
                        "Clear Chat",
                        size="sm",
                        variant="secondary",
                    )

                # --- Example Prompts ---
                gr.HTML(
                    '<div class="section-title" style="margin-top: 16px;">'
                    '<span class="icon">💡</span> Quick Start'
                    "</div>"
                )
                gr.HTML(
                    '<div class="example-category">Edit Video</div>'
                )
                with gr.Row():
                    ex1 = gr.Button("Trim from 5s to 15s", size="sm",
                                    elem_classes=["example-btn"])
                    ex2 = gr.Button("Extract the audio", size="sm",
                                    elem_classes=["example-btn"])
                    ex3 = gr.Button("Make a GIF from 3s to 8s", size="sm",
                                    elem_classes=["example-btn"])
                gr.HTML(
                    '<div class="example-category" style="margin-top: 8px;">'
                    'Generate Video</div>'
                )
                with gr.Row():
                    ex4 = gr.Button("Generate a sunset beach video", size="sm",
                                    elem_classes=["example-btn"])
                    ex5 = gr.Button("Create a cat playing piano video", size="sm",
                                    elem_classes=["example-btn"])

            # =========================================================
            # RIGHT PANEL — Results
            # =========================================================
            with gr.Column(scale=4):

                # --- Status ---
                gr.HTML(
                    '<div class="section-title">'
                    '<span class="icon">⚡</span> Status'
                    "</div>"
                )
                status_box = gr.HTML(
                    value=(
                        '<div class="status-box status-waiting">'
                        "<b>Status:</b> Waiting for input...</div>"
                    ),
                )

                # --- Results ---
                gr.HTML(
                    '<div class="section-title" style="margin-top: 20px;">'
                    '<span class="icon">🎬</span> Results'
                    "</div>"
                )

                video_result = gr.Video(
                    label="Video Output",
                    visible=False,
                    height=240,
                )

                audio_result = gr.Audio(
                    label="Audio Output",
                    visible=False,
                    type="filepath",
                )

                image_result = gr.Image(
                    label="GIF Output",
                    visible=False,
                    height=240,
                )

                # --- Tool Capabilities ---
                gr.HTML("""
                <div class="card" style="margin-top: 20px;">
                    <div class="section-title">
                        <span class="icon">🛠️</span> Available Tools
                    </div>
                    <div style="line-height: 2;">
                        <span class="tool-badge">✂️ Trim Video</span>
                        <span class="tool-badge">🎵 Extract Audio</span>
                        <span class="tool-badge">🖼️ Video to GIF</span>
                        <span class="tool-badge">🎬 AI Generate</span>
                        <span class="tool-badge">🔗 URL Import</span>
                    </div>
                    <div style="margin-top: 10px; color: #9ca3af; font-size: 0.82em;">
                        Supports Douyin, TikTok, YouTube, Bilibili and more.
                        AI face swap, watermark removal, and 3D animation
                        are not yet supported.
                    </div>
                </div>
                """)

        # ============================================================
        # FOOTER
        # ============================================================
        gr.HTML("""
        <div class="footer">
            AI Video Copilot &mdash; Built with Gradio, OpenAI Function Calling,
            MoviePy &amp; Doubao Seedance &nbsp;|&nbsp;
            <a href="https://github.com/xx05kyo/AI-Video-Copilot"
               target="_blank">GitHub</a>
        </div>
        """)

        # ============================================================
        # Event wiring
        # ============================================================

        # Track which tab is active
        tabs.select(fn=on_tab_change, inputs=None, outputs=[active_tab_state])

        # Video upload -> copy file & reset session
        video_upload.upload(
            fn=handle_upload,
            inputs=[video_upload],
            outputs=[video_path_state, chatbox, messages_state],
        )

        # URL download -> download video & reset session
        download_btn.click(
            fn=handle_url_download,
            inputs=[url_input],
            outputs=[video_path_state, chatbox, messages_state, status_box],
        )

        # Submit button -> process message (streaming)
        submit_btn.click(
            fn=handle_submit,
            inputs=[
                msg_input, video_path_state, chatbox, messages_state,
                active_tab_state,
                api_key_input, api_url_input, model_input,
                volc_key_input, volc_model_input,
            ],
            outputs=[
                chatbox,
                messages_state,
                msg_input,
                video_result,
                audio_result,
                image_result,
                status_box,
            ],
        )

        # Enter key in textbox also triggers submit
        msg_input.submit(
            fn=handle_submit,
            inputs=[
                msg_input, video_path_state, chatbox, messages_state,
                active_tab_state,
                api_key_input, api_url_input, model_input,
                volc_key_input, volc_model_input,
            ],
            outputs=[
                chatbox,
                messages_state,
                msg_input,
                video_result,
                audio_result,
                image_result,
                status_box,
            ],
        )

        # Clear button resets chat only
        clear_btn.click(
            fn=lambda: (
                [],
                create_session(),
                '<div class="status-box status-waiting">'
                "<b>Status:</b> Chat cleared.</div>",
            ),
            outputs=[chatbox, messages_state, status_box],
        )

        # Save settings button
        save_settings_btn.click(
            fn=handle_save_settings,
            inputs=[
                api_key_input, api_url_input, model_input,
                volc_key_input, volc_model_input,
            ],
            outputs=[settings_status],
        )

        # Example prompt buttons -> fill input
        for btn, text in [
            (ex1, "Trim from 5s to 15s"),
            (ex2, "Extract the audio from this video"),
            (ex3, "Make a GIF from 3s to 8s"),
            (ex4, "Generate a sunset beach video with waves"),
            (ex5, "Create a video of a cat playing piano"),
        ]:
            btn.click(fn=lambda t=text: t, outputs=[msg_input])

    return app


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    app = build_ui()
    app.launch(
        server_name="0.0.0.0",
        server_port=7860,
        share=False,
        show_error=True,
    )
