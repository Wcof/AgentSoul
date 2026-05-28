"""
AgentSoul · Session Scanner Registry
====================================

Registry holding all active session log scanners.
"""
from __future__ import annotations

from typing import TYPE_CHECKING
from .base import BaseSessionScanner
from .claude_jsonl import ClaudeJsonlScanner

if TYPE_CHECKING:
    from src.storage.db import DatabaseManager


class ScannerRegistry:
    """Registry holding all active session scanners."""

    def __init__(self) -> None:
        self._scanners: list[BaseSessionScanner] = []

    def register(self, scanner: BaseSessionScanner) -> None:
        self._scanners.append(scanner)

    def scan_all(self, db_mgr: DatabaseManager) -> int:
        """Run all registered scanners and return total updated sessions."""
        total = 0
        for scanner in self._scanners:
            try:
                total += scanner.scan(db_mgr)
            except Exception:
                continue  # Prevent one broken scanner from breaking the loop
        return total


# Module-level default registry
_default_registry = ScannerRegistry()
_default_registry.register(ClaudeJsonlScanner())


def scan_all_sessions(db_mgr: DatabaseManager) -> int:
    """Convenience wrapper around default registry."""
    return _default_registry.scan_all(db_mgr)


__all__ = [
    "BaseSessionScanner",
    "ScannerRegistry",
    "scan_all_sessions",
]
