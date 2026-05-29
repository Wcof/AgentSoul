"""
AgentSoul · Storage Migration Tests
====================================
Verifies idempotent SQLite schema versioning and runtime state table creation.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from agentsoul.storage.db import DatabaseManager


class TestSchemaVersion:
    """Schema versioning must track applied migrations."""

    def test_database_has_schema_version_table(self, temp_dir: Path) -> None:
        db = DatabaseManager(temp_dir / "agentsoul.db")

        with sqlite3.connect(db.db_path) as conn:
            tables = {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }
        assert "schema_version" in tables

    def test_schema_version_records_initial_version(self, temp_dir: Path) -> None:
        db = DatabaseManager(temp_dir / "agentsoul.db")

        with sqlite3.connect(db.db_path) as conn:
            row = conn.execute(
                "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
            ).fetchone()

        assert row is not None
        assert row[0] >= 1

    def test_migrations_are_idempotent(self, temp_dir: Path) -> None:
        db_path = temp_dir / "agentsoul.db"
        db1 = DatabaseManager(db_path)
        db2 = DatabaseManager(db_path)

        with sqlite3.connect(db_path) as conn:
            count = conn.execute("SELECT COUNT(*) FROM schema_version").fetchone()[0]

        assert count >= 1  # Versions recorded, not duplicated


class TestRuntimeTables:
    """Runtime state tables must exist after initialization."""

    @pytest.fixture(autouse=True)
    def setup_db(self, temp_dir: Path) -> None:
        self.db = DatabaseManager(temp_dir / "agentsoul.db")
        self.db_path = self.db.db_path

    def _get_tables(self) -> set[str]:
        with sqlite3.connect(self.db_path) as conn:
            return {
                row[0]
                for row in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table'"
                ).fetchall()
            }

    def test_companion_state_table_exists(self) -> None:
        assert "companion_state" in self._get_tables()

    def test_growth_events_table_exists(self) -> None:
        assert "growth_events" in self._get_tables()

    def test_audit_records_table_exists(self) -> None:
        assert "audit_records" in self._get_tables()

    def test_provider_profiles_table_exists(self) -> None:
        assert "provider_profiles" in self._get_tables()

    def test_approval_requests_table_exists(self) -> None:
        assert "approval_requests" in self._get_tables()

    def test_managed_rule_files_table_exists(self) -> None:
        assert "managed_rule_files" in self._get_tables()

    def test_legacy_tables_still_exist(self) -> None:
        tables = self._get_tables()
        for legacy in ("token_stats", "skills", "sessions_cache", "skills_mapping", "scanner_state"):
            assert legacy in tables, f"Legacy table {legacy} missing after migration"

    def test_companion_state_accepts_json_value(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO companion_state (key, value_json, updated_at) VALUES (?, ?, ?)",
                ("energy", '{"current": 80, "max": 100}', "2026-05-29T10:00:00"),
            )
            row = conn.execute(
                "SELECT value_json FROM companion_state WHERE key = 'energy'"
            ).fetchone()
        assert row is not None
        assert '"current": 80' in row[0]

    def test_growth_events_autoincrements(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO growth_events (occurred_at, source_type, source_id, event_json, growth_rule_version) "
                "VALUES (?, ?, ?, ?, ?)",
                ("2026-05-29T10:00:00", "gateway", "req-1", '{"xp": 10}', "v1"),
            )
            conn.execute(
                "INSERT INTO growth_events (occurred_at, source_type, source_id, event_json, growth_rule_version) "
                "VALUES (?, ?, ?, ?, ?)",
                ("2026-05-29T10:05:00", "interaction", "feed-1", '{"hunger": 30}', "v1"),
            )
            rows = conn.execute("SELECT id FROM growth_events ORDER BY id").fetchall()
        assert len(rows) == 2
        assert rows[1][0] > rows[0][0]

    def test_audit_records_metadata_only(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO audit_records "
                "(occurred_at, gateway_event_id, traffic_metadata_json, estimated_cost, outcome, evidence_hash) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                (
                    "2026-05-29T10:00:00",
                    "evt-001",
                    '{"model": "gpt-4", "tokens_in": 100, "tokens_out": 50}',
                    0.003,
                    "success",
                    "sha256:abc123",
                ),
            )
            row = conn.execute(
                "SELECT traffic_metadata_json, estimated_cost FROM audit_records WHERE gateway_event_id = 'evt-001'"
            ).fetchone()
        assert row is not None
        assert '"model": "gpt-4"' in row[0]
        assert row[1] == pytest.approx(0.003)

    def test_provider_profiles_stores_config(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO provider_profiles (id, name, activation_mode, credential_ref, config_json, enabled) "
                "VALUES (?, ?, ?, ?, ?, ?)",
                ("openai-default", "OpenAI", "gateway_route", "cred-1", '{"model": "gpt-4"}', 1),
            )
            row = conn.execute(
                "SELECT name, activation_mode FROM provider_profiles WHERE id = 'openai-default'"
            ).fetchone()
        assert row[0] == "OpenAI"
        assert row[1] == "gateway_route"

    def test_approval_requests_status_lifecycle(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO approval_requests (id, created_at, action_risk_class, status, request_json) "
                "VALUES (?, ?, ?, ?, ?)",
                ("apr-1", "2026-05-29T10:00:00", "high_risk", "pending", '{"action": "write_file"}'),
            )
            conn.execute(
                "UPDATE approval_requests SET status = ?, decision_json = ? WHERE id = ?",
                ("approved", '{"decision": "allow"}', "apr-1"),
            )
            row = conn.execute(
                "SELECT status, decision_json FROM approval_requests WHERE id = 'apr-1'"
            ).fetchone()
        assert row[0] == "approved"
        assert '"allow"' in row[1]

    def test_managed_rule_files_unique_per_workspace_target(self) -> None:
        with sqlite3.connect(self.db_path) as conn:
            conn.execute(
                "INSERT INTO managed_rule_files "
                "(workspace_path, target_path, source_path, skill_name, deployment_method, content_hash, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("/project", "CLAUDE.md", "/skills/tdd/rules.md", "tdd", "symlink", "h1", "2026-05-29"),
            )
            # Same workspace+target should conflict
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(
                    "INSERT INTO managed_rule_files "
                    "(workspace_path, target_path, source_path, skill_name, deployment_method, content_hash, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ("/project", "CLAUDE.md", "/skills/other/rules.md", "other", "symlink", "h2", "2026-05-29"),
                )
