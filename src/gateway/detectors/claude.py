"""
AgentSoul · Claude Code Client Detector
=======================================

Detects incoming requests from the Claude Code CLI.
"""
from __future__ import annotations

from .base import BaseClientDetector


class ClaudeCodeDetector(BaseClientDetector):
    """Detector for Claude Code CLI requests."""

    def detect(self, path: str, headers: dict[str, str], payload: dict) -> float:
        """
        Detect if request is from Claude Code CLI.

        Signals:
        - Header 'anthropic-version' exists (strong signal: 0.9)
        - User-Agent contains 'claude-code' or 'claude-cli' (strong signal: 0.9)
        - Path contains '/messages' and model starts with 'claude' (medium signal: 0.6)
        """
        # Lowercase headers are passed in from the registry
        if "anthropic-version" in headers:
            return 0.9

        user_agent = headers.get("user-agent", "").lower()
        if "claude-code" in user_agent or "claude-cli" in user_agent:
            return 0.9

        # Fallback to checking path and model payload
        is_messages_path = "/messages" in path
        model = payload.get("model", "") if isinstance(payload, dict) else ""
        if is_messages_path and isinstance(model, str) and model.startswith("claude"):
            return 0.6

        return 0.0

    def get_client_name(self) -> str:
        return "claude_code"
