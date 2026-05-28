"""
AgentSoul · Base Session Scanner
================================

Defines the abstract interface for history scanners of various AI coding assistants.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.storage.db import DatabaseManager


class BaseSessionScanner(ABC):
    """Abstract base class for session scanners."""

    @abstractmethod
    def scan(self, db_mgr: DatabaseManager) -> int:
        """
        Perform a scan (incremental or full) and save sessions to the database.

        Args:
            db_mgr: DatabaseManager instance to perform database operations.

        Returns:
            Number of new or updated sessions cached.
        """

    @abstractmethod
    def get_provider_name(self) -> str:
        """
        Return the canonical provider name string (e.g. 'claude_code', 'cursor').
        """
