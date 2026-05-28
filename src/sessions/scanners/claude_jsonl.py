"""
AgentSoul · Claude JSONL Session Scanner
========================================

Parses history.jsonl from Claude Code CLI incrementally.
Uses sqlite scanner_state to perform fast, millisecond-level incremental scans.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from pathlib import Path
from typing import TYPE_CHECKING
from common import log
from .base import BaseSessionScanner

if TYPE_CHECKING:
    from src.storage.db import DatabaseManager


class ClaudeJsonlScanner(BaseSessionScanner):
    """Scanner for Claude Code JSONL history files with incremental scans."""

    def __init__(self, history_file: Path | None = None):
        self.history_file = history_file or (Path.home() / ".claude" / "history.jsonl")

    def get_provider_name(self) -> str:
        return "claude_code"

    def scan(self, db_mgr: DatabaseManager) -> int:
        """
        Scan Claude Code sessions from history.jsonl incrementally.
        Uses scanner_state offset and modification time to check for changes.
        """
        if not self.history_file.exists():
            log(f"Claude Code history file not found: {self.history_file}", "WARN")
            return 0

        file_path_str = str(self.history_file)
        stat = self.history_file.stat()
        current_mtime = stat.st_mtime
        current_size = stat.st_size

        # Retrieve last scan state
        state = db_mgr.get_scanner_state(file_path_str)
        last_offset = state["last_offset"]
        last_modified = state["last_modified"]

        # If file hasn't changed, skip scanning
        if current_mtime <= last_modified and current_size <= last_offset:
            return 0

        # Handle rotation or truncation: reset offset if file is smaller than last offset
        if current_size < last_offset:
            log(f"History file {self.history_file} truncated, rescanning from start", "INFO")
            last_offset = 0

        sessions_map = {}
        log(f"Incrementally scanning Claude Code sessions from offset {last_offset}...", "STEP")

        new_offset = last_offset
        try:
            with open(self.history_file, "r", encoding="utf-8", errors="ignore") as f:
                f.seek(last_offset)
                for line in f:
                    new_offset += len(line.encode("utf-8"))
                    line_str = line.strip()
                    if not line_str:
                        continue
                    try:
                        data = json.loads(line_str)
                        session_id = data.get("sessionId")
                        if not session_id:
                            continue

                        timestamp_ms = data.get("timestamp", 0)
                        dt = datetime.fromtimestamp(timestamp_ms / 1000.0).isoformat()
                        project = data.get("project", "")
                        display = data.get("display", "")

                        if session_id not in sessions_map:
                            sessions_map[session_id] = {
                                "session_id": session_id,
                                "provider": self.get_provider_name(),
                                "title": display,
                                "summary": display,
                                "project_dir": project,
                                "created_at": dt,
                                "last_active_at": dt,
                                "file_path": file_path_str
                            }
                        else:
                            sess = sessions_map[session_id]
                            if dt < sess["created_at"]:
                                sess["created_at"] = dt
                            if dt > sess["last_active_at"]:
                                sess["last_active_at"] = dt
                                sess["summary"] = display
                    except Exception:
                        continue
        except OSError as e:
            log(f"Failed to read history file {self.history_file}: {e}", "ERROR")
            return 0

        # Cache sessions to database
        count = 0
        for session_id, sess in sessions_map.items():
            try:
                db_mgr.upsert_session_cache(
                    session_id=sess["session_id"],
                    provider=sess["provider"],
                    title=sess["title"][:200] if sess["title"] else "Untitled Session",
                    summary=sess["summary"][:500] if sess["summary"] else "",
                    project_dir=sess["project_dir"],
                    created_at=sess["created_at"],
                    last_active_at=sess["last_active_at"],
                    file_path=sess["file_path"]
                )
                count += 1
            except Exception as e:
                log(f"Failed to cache session {session_id}: {e}", "WARN")

        # Save scan state
        db_mgr.set_scanner_state(file_path_str, new_offset, current_mtime)
        if count > 0:
            log(f"Cached {count} new/updated Claude Code sessions", "OK")
        return count
