"""
AgentSoul · Session Scanner
===========================

Scans Claude Code local history logs (~/.claude/history.jsonl) and caches session
metadata (session_id, project_dir, title, last_active_at) into the SQLite cache.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path
import sys

# Calculate project root manually before importing
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from common import log
from src.storage.db import DatabaseManager
from src.sessions.scanners import scan_all_sessions, ClaudeJsonlScanner


class SessionScanner:
    def __init__(self, db_mgr: DatabaseManager | None = None):
        self.db_mgr = db_mgr or DatabaseManager()

    def scan_claude_sessions(self, history_file: Path | None = None) -> int:
        """
        Scan ~/.claude/history.jsonl and cache entries to database.
        Delegated to ClaudeJsonlScanner.
        """
        scanner = ClaudeJsonlScanner(history_file)
        return scanner.scan(self.db_mgr)

    def scan_all(self) -> int:
        """Scan all registered session history providers."""
        return scan_all_sessions(self.db_mgr)


if __name__ == "__main__":
    scanner = SessionScanner()
    scanner.scan_all()
