"""
Agent Core for AI Video Copilot.

Implements the OpenAI Function Calling workflow:
1. Receive user prompt + video path
2. Send to LLM with tool definitions
3. If LLM returns tool_calls -> execute tool -> feed result back
4. LLM generates final natural-language response
5. Return response text + any output file paths

Supports multi-turn conversation via per-session message history.
"""

from __future__ import annotations

import json
import time
import logging
from openai import OpenAI

from config import OPENAI_API_KEY, OPENAI_BASE_URL, MODEL_NAME
from tools import tool_registry, TOOL_SCHEMAS

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# System Prompt
# ---------------------------------------------------------------------------
SYSTEM_PROMPT: str = """\
You are a professional video editing AI assistant named "AI Video Copilot".

Your capabilities:
- You can ONLY complete user requests through the registered tools.
- You must NEVER fabricate results or pretend a task is done without actually \
calling the appropriate tool and receiving its result.

When a user describes a video editing task:
1. Analyze the request carefully.
2. Determine which tool to use and what arguments to provide.
3. Call the tool with precise, correct arguments.
4. Wait for the tool result before responding.

Important rules:
- ALWAYS use a tool to complete video editing tasks. Never say "I've done it" \
without actually calling a tool.
- If the user's request cannot be fulfilled with the available tools \
(e.g., AI face swap, watermark removal, 3D animation, auto subtitles, AI \
voiceover, color grading, or any other feature not in the tool list), you \
MUST clearly inform the user that this feature is not currently supported by \
the tool library. Do NOT fabricate results.
- When extracting time ranges, be precise. Convert natural language time \
expressions (e.g., "the first 10 seconds", "from minute 1 to minute 2") \
into exact seconds.
- If the user's request is ambiguous, ask clarifying questions before \
calling any tool.
- Always respond in the same language as the user.

Available tools:
- trim_video: Cut a video segment between two time points (outputs MP4).
- extract_audio: Extract the audio track from a video (outputs MP3).
- video_to_gif: Convert a video segment to an animated GIF.
- generate_video: Generate a new short AI video from a text description using \
the Doubao Seedance model (outputs MP4). Use this when the user wants to \
create a video from scratch based on a text prompt, not when editing an \
existing video.

You are helpful, precise, and professional. You explain what you did clearly \
and concisely.
"""


# ---------------------------------------------------------------------------
# Session management
# ---------------------------------------------------------------------------

def create_session() -> list[dict]:
    """Create a new conversation session with the system prompt.

    Returns:
        A list of message dicts representing the conversation history.
    """
    return [{"role": "system", "content": SYSTEM_PROMPT}]


# ---------------------------------------------------------------------------
# Core agent loop
# ---------------------------------------------------------------------------

def process_message(
    user_message: str,
    video_path: str,
    messages: list[dict],
    openai_api_key: str = "",
    openai_base_url: str = "",
    model_name: str = "",
) -> tuple[str, list[str]]:
    """Process a user message through the full Function Calling workflow.

    This is the main entry point called by the UI for each user submission.

    Args:
        user_message: The natural-language instruction from the user.
        video_path: Absolute path to the uploaded video file.
        messages: The running conversation history (mutated in-place).
        openai_api_key: Runtime API key override (from UI input).
        openai_base_url: Runtime base URL override (from UI input).
        model_name: Runtime model name override (from UI input).

    Returns:
        A tuple of ``(assistant_reply, output_files)`` where:
        - ``assistant_reply`` is the final text response from the LLM.
        - ``output_files`` is a list of output file paths produced by tools
          (may be empty if no tool was called or the tool failed).
    """
    # Use runtime values if provided, otherwise fall back to config
    api_key = openai_api_key.strip() if openai_api_key else OPENAI_API_KEY
    base_url = openai_base_url.strip() if openai_base_url else OPENAI_BASE_URL
    model = model_name.strip() if model_name else MODEL_NAME

    # --- Guard: API key ---
    if not api_key:
        return (
            "Error: API Key is not configured. "
            "Please enter your API Key in the settings panel above.",
            [],
        )

    try:
        client = OpenAI(api_key=api_key, base_url=base_url)
    except Exception as exc:
        logger.exception("Failed to initialize OpenAI client")
        return f"Error initializing OpenAI client: {exc}", []

    # --- Build user message with video context ---
    content_parts = [user_message]
    if video_path:
        content_parts.append(f"\n[Attached video file: {video_path}]")

    messages.append({"role": "user", "content": "".join(content_parts)})
    logger.info("User prompt: %s", user_message)

    output_files: list[str] = []

    try:
        # =================================================================
        # STEP 1: First LLM call - decide whether to call a tool
        # =================================================================
        logger.info("Sending request to LLM (model=%s) ...", model)
        t0 = time.time()

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
        )

        choice = response.choices[0]
        message = choice.message

        # Append assistant message to history
        messages.append(message.model_dump())

        # ------------------------------------------------------------------
        # If no tool calls: LLM answered directly (clarification, refusal, etc.)
        # ------------------------------------------------------------------
        if not message.tool_calls:
            reply = message.content or "I'm not sure how to help with that."
            logger.info("LLM responded directly (no tool call).")
            return reply, output_files

        # =================================================================
        # STEP 2: Execute each tool call
        # =================================================================
        for tool_call in message.tool_calls:
            func_name = tool_call.function.name
            logger.info("LLM tool decision: %s", func_name)

            # --- Unknown tool ---
            if func_name not in tool_registry:
                err_msg = f"Unknown tool requested: '{func_name}'."
                logger.error(err_msg)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps({
                        "success": False,
                        "message": err_msg,
                        "output_path": None,
                    }),
                })
                continue

            # --- Parse arguments ---
            try:
                arguments = json.loads(tool_call.function.arguments)
                logger.info("Tool arguments: %s", json.dumps(arguments, ensure_ascii=False))
            except json.JSONDecodeError as exc:
                err_msg = f"Failed to parse tool arguments: {exc}"
                logger.error(err_msg)
                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": json.dumps({
                        "success": False,
                        "message": err_msg,
                        "output_path": None,
                    }),
                })
                continue

            # --- Execute tool ---
            try:
                func = tool_registry[func_name]
                result = func(**arguments)
            except TypeError as exc:
                err_msg = f"Invalid arguments for tool '{func_name}': {exc}"
                logger.error(err_msg)
                result = {
                    "success": False,
                    "message": err_msg,
                    "output_path": None,
                }
            except Exception as exc:
                err_msg = f"Tool '{func_name}' execution failed: {exc}"
                logger.exception(err_msg)
                result = {
                    "success": False,
                    "message": err_msg,
                    "output_path": None,
                }

            # Collect output files
            if result.get("success") and result.get("output_path"):
                output_files.append(result["output_path"])

            logger.info("Tool result: %s", json.dumps(result, ensure_ascii=False))

            # --- Feed tool result back to LLM ---
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": json.dumps(result),
            })

        # =================================================================
        # STEP 3: Second LLM call - generate natural language response
        # =================================================================
        logger.info("Sending tool results back to LLM for final response ...")

        final_response = client.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOL_SCHEMAS,
            tool_choice="auto",
        )

        final_message = final_response.choices[0].message
        messages.append(final_message.model_dump())

        elapsed = time.time() - t0
        logger.info("Full agent loop completed in %.2fs", elapsed)

        reply = final_message.content or "Task completed."
        return reply, output_files

    except Exception as exc:
        logger.exception("Agent processing failed")
        return (
            f"An error occurred while processing your request: {exc}",
            output_files,
        )
