"""
AgentSoul · Gateway Client Detector Base
=========================================

Defines the abstract interface for software client detectors.
Each detector inspects HTTP request attributes (path, headers, payload)
and returns a confidence score indicating whether this request originated
from a known AI coding tool (Claude Code CLI, Cursor, Trae, Windsurf, etc.).

New detectors only need to:
1. Inherit BaseClientDetector
2. Implement detect() and get_client_name()
3. Register with DetectorRegistry at module level

No modifications to proxy_server.py are needed when adding new clients.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class BaseClientDetector(ABC):
    """Abstract base class for software client detectors."""

    @abstractmethod
    def detect(self, path: str, headers: dict[str, str], payload: dict) -> float:
        """
        Inspect the HTTP request and return a confidence score.

        Args:
            path:     The HTTP request path, e.g. '/v1/messages'
            headers:  A dict of lowercase header names to values
            payload:  Parsed JSON body of the request (may be empty dict)

        Returns:
            A float in [0.0, 1.0]:
              0.0  = definitely not this client
              0.5  = possible / weak signal
              1.0  = definitely this client
        """

    @abstractmethod
    def get_client_name(self) -> str:
        """
        Return the canonical software client identifier string.

        Examples: 'claude_code', 'cursor', 'trae', 'windsurf', 'copilot'
        This value is used as the `target_value` for 'software' scoped skills.
        """
