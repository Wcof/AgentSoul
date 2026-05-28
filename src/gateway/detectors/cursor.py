"""
AgentSoul · Cursor Client Detector
===================================

Detects incoming requests from the Cursor IDE.
"""
from __future__ import annotations

from .base import BaseClientDetector


class CursorDetector(BaseClientDetector):
    """Detector for Cursor requests."""

    def detect(self, path: str, headers: dict[str, str], payload: dict) -> float:
        """
        Detect if request is from Cursor.

        Signals:
        - User-Agent contains 'cursor' (strong signal: 0.9)
        - Path is typical for OpenAI/custom OpenAI endpoints e.g. '/v1/chat/completions'
          and payload contains common LLM model formats.
        """
        user_agent = headers.get("user-agent", "").lower()
        if "cursor" in user_agent:
            return 0.9

        # Some configurations or proxy requests might strip Cursor from User-Agent
        # but use standard chat/completions path. If payload contains models, check it.
        is_chat_completions = "/chat/completions" in path
        if is_chat_completions:
            # Check model name or structure
            model = payload.get("model", "") if isinstance(payload, dict) else ""
            if isinstance(model, str) and (
                "gpt-" in model.lower()
                or "claude-" in model.lower()
                or "cursor-" in model.lower()
            ):
                return 0.5

        return 0.0

    def get_client_name(self) -> str:
        return "cursor"
