"""
AgentSoul · Gateway Detector Registry
======================================

Central registry for software client detectors.
Iterates all registered detectors and selects the one with the highest
confidence score. Falls back to 'unknown' if no detector exceeds threshold.
"""
from __future__ import annotations

from .base import BaseClientDetector
from .claude import ClaudeCodeDetector
from .cursor import CursorDetector

# ─────────────────────────────────────────────────────────────────────────────
# Default threshold: confidence must be ≥ this value to be considered a match
CONFIDENCE_THRESHOLD = 0.4
# ─────────────────────────────────────────────────────────────────────────────


class DetectorRegistry:
    """
    Registry holding all active client detectors.

    Usage:
        registry = DetectorRegistry()
        client_name = registry.identify(path, headers, payload)
    """

    def __init__(self) -> None:
        self._detectors: list[BaseClientDetector] = []

    def register(self, detector: BaseClientDetector) -> None:
        """Add a new detector to the registry."""
        self._detectors.append(detector)

    def identify(
        self,
        path: str,
        headers: dict[str, str],
        payload: dict,
    ) -> str:
        """
        Run all registered detectors and return the client name with the
        highest confidence that meets the threshold.

        Returns:
            Client name string, e.g. 'claude_code', 'cursor', or 'unknown'.
        """
        best_name = "unknown"
        best_score = 0.0

        # Normalise header keys to lowercase for consistent matching
        norm_headers = {k.lower(): v for k, v in headers.items()}

        for detector in self._detectors:
            try:
                score = detector.detect(path, norm_headers, payload)
                if score > best_score:
                    best_score = score
                    best_name = detector.get_client_name()
            except Exception:
                continue  # Never let a broken detector crash the gateway

        if best_score < CONFIDENCE_THRESHOLD:
            return "unknown"
        return best_name


# ─────────────────────────────────────────────────────────────────────────────
# Module-level default registry — import and use directly in proxy_server.py
# ─────────────────────────────────────────────────────────────────────────────
_default_registry = DetectorRegistry()
_default_registry.register(ClaudeCodeDetector())
_default_registry.register(CursorDetector())


def identify_client(path: str, headers: dict[str, str], payload: dict) -> str:
    """Convenience wrapper around the default registry."""
    return _default_registry.identify(path, headers, payload)


__all__ = [
    "BaseClientDetector",
    "DetectorRegistry",
    "identify_client",
]
