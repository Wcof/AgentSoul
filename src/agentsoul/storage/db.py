"""
AgentSoul · Database Management
Provides SQLite database initialization and DAO methods for token statistics,
skills registry, and session logs.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from pathlib import Path
from typing import Any

from common import get_project_root, log

class DatabaseManager:
    def __init__(self, db_path: Path | None = None):
        if db_path is None:
            db_path = get_project_root() / "data" / "agentsoul.db"
        self.db_path = db_path
        self._init_db()

    def _get_connection(self) -> sqlite3.Connection:
        self.db_path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        """Initialize SQLite database tables."""
        with self._get_connection() as conn:
            # 1. Token stats table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS token_stats (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    timestamp TEXT NOT NULL,
                    session_id TEXT NOT NULL,
                    character_id TEXT NOT NULL,
                    provider TEXT NOT NULL,
                    model TEXT NOT NULL,
                    tokens_in INTEGER NOT NULL,
                    tokens_out INTEGER NOT NULL,
                    latency REAL NOT NULL,
                    cost REAL NOT NULL
                )
            """)

            # 2. Skills registry table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS skills (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    description TEXT,
                    path TEXT NOT NULL,
                    enabled INTEGER NOT NULL DEFAULT 0,
                    prompt_files TEXT
                )
            """)

            # 3. Sessions metadata cache table
            conn.execute("""
                CREATE TABLE IF NOT EXISTS sessions_cache (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    session_id TEXT UNIQUE NOT NULL,
                    provider TEXT NOT NULL,
                    title TEXT,
                    summary TEXT,
                    project_dir TEXT,
                    created_at TEXT,
                    last_active_at TEXT,
                    file_path TEXT
                )
            """)

            # 4. Skills mapping table for multi-dimensional deployment
            conn.execute("""
                CREATE TABLE IF NOT EXISTS skills_mapping (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    skill_name TEXT NOT NULL,
                    target_type TEXT NOT NULL,  -- 'global', 'software', 'project'
                    target_value TEXT NOT NULL, -- 'all', software name (e.g. 'claude_code'), or project path
                    enabled INTEGER NOT NULL DEFAULT 1,
                    UNIQUE(skill_name, target_type, target_value)
                )
            """)

            # 5. Scanner state for incremental scans
            conn.execute("""
                CREATE TABLE IF NOT EXISTS scanner_state (
                    file_path TEXT PRIMARY KEY,
                    last_offset INTEGER NOT NULL DEFAULT 0,
                    last_modified REAL NOT NULL DEFAULT 0.0
                )
            """)

            conn.commit()
            log(f"Database initialized at {self.db_path}", "OK")

    # --- Token Stats DAO ---

    def log_token_usage(
        self,
        session_id: str,
        character_id: str,
        provider: str,
        model: str,
        tokens_in: int,
        tokens_out: int,
        latency: float,
        cost: float
    ) -> None:
        """Log LLM token usage details."""
        timestamp = datetime.utcnow().isoformat()
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO token_stats (timestamp, session_id, character_id, provider, model, tokens_in, tokens_out, latency, cost)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (timestamp, session_id, character_id, provider, model, tokens_in, tokens_out, latency, cost)
            )
            conn.commit()

    def get_token_stats(self, days: int = 7) -> list[dict[str, Any]]:
        """Get token statistics grouped by day."""
        query = """
            SELECT 
                strftime('%Y-%m-%d', timestamp) as date,
                SUM(tokens_in) as total_in,
                SUM(tokens_out) as total_out,
                SUM(tokens_in + tokens_out) as total_tokens,
                AVG(latency) as avg_latency,
                SUM(cost) as total_cost,
                COUNT(*) as request_count
            FROM token_stats
            WHERE datetime(timestamp) >= datetime('now', ?)
            GROUP BY date
            ORDER BY date ASC
        """
        with self._get_connection() as conn:
            rows = conn.execute(query, (f"-{days} days",)).fetchall()
            return [dict(row) for row in rows]

    def get_session_token_usage(self, session_id: str) -> dict[str, Any]:
        """Get aggregated token usage for a specific session."""
        query = """
            SELECT 
                SUM(tokens_in) as total_in,
                SUM(tokens_out) as total_out,
                SUM(tokens_in + tokens_out) as total_tokens,
                SUM(cost) as total_cost,
                COUNT(*) as request_count
            FROM token_stats
            WHERE session_id = ?
        """
        with self._get_connection() as conn:
            row = conn.execute(query, (session_id,)).fetchone()
            return dict(row) if row and row["request_count"] > 0 else {
                "total_in": 0, "total_out": 0, "total_tokens": 0, "total_cost": 0.0, "request_count": 0
            }

    # --- Skills DAO ---

    def register_skill(self, name: str, description: str, path: str, prompt_files: list[str]) -> None:
        """Register a new skill in the database."""
        files_json = json.dumps(prompt_files)
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO skills (name, description, path, enabled, prompt_files)
                VALUES (?, ?, ?, 0, ?)
                ON CONFLICT(name) DO UPDATE SET
                    description=excluded.description,
                    path=excluded.path,
                    prompt_files=excluded.prompt_files
                """,
                (name, description, path, files_json)
            )
            conn.commit()

    def get_all_skills(self) -> list[dict[str, Any]]:
        """Get all skills from registry."""
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM skills").fetchall()
            result = []
            for row in rows:
                item = dict(row)
                item["prompt_files"] = json.loads(item["prompt_files"] or "[]")
                result.append(item)
            return result

    def toggle_skill(self, name: str, enabled: bool) -> bool:
        """Enable or disable a skill."""
        status = 1 if enabled else 0
        with self._get_connection() as conn:
            cursor = conn.execute("UPDATE skills SET enabled = ? WHERE name = ?", (status, name))
            conn.commit()
            return cursor.rowcount > 0

    # --- Sessions Cache DAO ---

    def upsert_session_cache(
        self,
        session_id: str,
        provider: str,
        title: str,
        summary: str,
        project_dir: str,
        created_at: str,
        last_active_at: str,
        file_path: str
    ) -> None:
        """Insert or update a session cache entry."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO sessions_cache (session_id, provider, title, summary, project_dir, created_at, last_active_at, file_path)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    title=excluded.title,
                    summary=excluded.summary,
                    project_dir=excluded.project_dir,
                    last_active_at=excluded.last_active_at,
                    file_path=excluded.file_path
                """,
                (session_id, provider, title, summary, project_dir, created_at, last_active_at, file_path)
            )
            conn.commit()

    def get_cached_sessions(self, provider: str | None = None) -> list[dict[str, Any]]:
        """Get scanned sessions cached in DB."""
        query = "SELECT * FROM sessions_cache"
        params = ()
        if provider:
            query += " WHERE provider = ?"
            params = (provider,)
        query += " ORDER BY last_active_at DESC"

        with self._get_connection() as conn:
            rows = conn.execute(query, params).fetchall()
            return [dict(row) for row in rows]

    # --- Skills Mapping DAO ---

    def add_skill_mapping(
        self,
        skill_name: str,
        target_type: str,
        target_value: str,
        enabled: bool = True
    ) -> None:
        """Add or update a skill mapping definition."""
        val = 1 if enabled else 0
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO skills_mapping (skill_name, target_type, target_value, enabled)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(skill_name, target_type, target_value) DO UPDATE SET
                    enabled=excluded.enabled
                """,
                (skill_name, target_type, target_value, val)
            )
            conn.commit()

    def remove_skill_mapping(self, skill_name: str, target_type: str, target_value: str) -> None:
        """Remove a skill mapping definition."""
        with self._get_connection() as conn:
            conn.execute(
                """
                DELETE FROM skills_mapping
                WHERE skill_name = ? AND target_type = ? AND target_value = ?
                """,
                (skill_name, target_type, target_value)
            )
            conn.commit()

    def get_skill_mappings(self) -> list[dict[str, Any]]:
        """Get all skill mapping definitions."""
        with self._get_connection() as conn:
            rows = conn.execute("SELECT * FROM skills_mapping").fetchall()
            return [dict(row) for row in rows]

    def get_enabled_skills_for(self, target_type: str, target_value: str) -> list[str]:
        """Get list of enabled skill names mapped to a specific target (type & value)."""
        query = """
            SELECT skill_name FROM skills_mapping
            WHERE target_type = ? AND target_value = ? AND enabled = 1
        """
        with self._get_connection() as conn:
            rows = conn.execute(query, (target_type, target_value)).fetchall()
            return [row["skill_name"] for row in rows]

    # --- Scanner State DAO ---

    def get_scanner_state(self, file_path: str) -> dict[str, Any]:
        """
        Get the last scanned offset and modification time for a file.
        Returns a dict with default values if no state exists.
        """
        query = "SELECT last_offset, last_modified FROM scanner_state WHERE file_path = ?"
        with self._get_connection() as conn:
            row = conn.execute(query, (file_path,)).fetchone()
            if row:
                return dict(row)
            return {"last_offset": 0, "last_modified": 0.0}

    def set_scanner_state(self, file_path: str, last_offset: int, last_modified: float) -> None:
        """Set or update the last scanned offset and modification time for a file."""
        with self._get_connection() as conn:
            conn.execute(
                """
                INSERT INTO scanner_state (file_path, last_offset, last_modified)
                VALUES (?, ?, ?)
                ON CONFLICT(file_path) DO UPDATE SET
                    last_offset=excluded.last_offset,
                    last_modified=excluded.last_modified
                """,
                (file_path, last_offset, last_modified)
            )
            conn.commit()


if __name__ == "__main__":
    import sys
    db = DatabaseManager()
    if len(sys.argv) > 1:
        cmd = sys.argv[1]
        if cmd == "list-skills":
            print(json.dumps(db.get_all_skills(), ensure_ascii=False))
        elif cmd == "toggle-skill" and len(sys.argv) > 3:
            name = sys.argv[2]
            enabled = sys.argv[3] == "1"
            print(json.dumps({"success": db.toggle_skill(name, enabled)}))
        elif cmd == "list-sessions":
            provider = sys.argv[2] if len(sys.argv) > 2 else None
            print(json.dumps(db.get_cached_sessions(provider), ensure_ascii=False))
        elif cmd == "stats":
            days = int(sys.argv[2]) if len(sys.argv) > 2 else 7
            print(json.dumps(db.get_token_stats(days), ensure_ascii=False))
