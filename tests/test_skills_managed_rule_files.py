"""
AgentSoul · Skills Managed Rule File Ownership Tests
=====================================================
Verifies that deployed rule files are tracked as Managed Rule Files,
deactivation removes only tracked files, and user-authored files are preserved.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest

from agentsoul.storage.db import DatabaseManager
from skills.skills_manager import SkillsManager


@pytest.fixture
def db(temp_dir: Path) -> DatabaseManager:
    return DatabaseManager(temp_dir / "agentsoul.db")


@pytest.fixture
def manager(db: DatabaseManager) -> SkillsManager:
    return SkillsManager(db)


@pytest.fixture
def skill_dir(temp_dir: Path) -> Path:
    """Create a fake skill directory with a rule file."""
    d = temp_dir / "skills" / "tdd"
    d.mkdir(parents=True)
    (d / "CLAUDE.md").write_text("# TDD Skill Rules\nAlways write tests first.\n")
    return d


@pytest.fixture
def workspace(temp_dir: Path) -> Path:
    w = temp_dir / "workspace"
    w.mkdir(parents=True)
    return w


class TestManagedRuleFileTracking:
    """Deployed rule files must be recorded in managed_rule_files."""

    def test_deploy_records_managed_rule_file(
        self,
        manager: SkillsManager,
        skill_dir: Path,
        workspace: Path,
        db: DatabaseManager,
    ) -> None:
        manager.register_skill("tdd", "TDD skill", str(skill_dir), ["CLAUDE.md"])
        manager.toggle_skill("tdd", True)
        manager.deploy_skills_to_workspace(str(workspace))

        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            conn.row_factory = sqlite3.Row
            rows = conn.execute(
                "SELECT * FROM managed_rule_files WHERE workspace_path = ?",
                (str(workspace.resolve()),),
            ).fetchall()
        assert len(rows) == 1
        assert rows[0]["skill_name"] == "tdd"
        assert rows[0]["target_path"] == "CLAUDE.md"

    def test_deactivation_removes_only_managed_files(
        self,
        manager: SkillsManager,
        skill_dir: Path,
        workspace: Path,
    ) -> None:
        manager.register_skill("tdd", "TDD skill", str(skill_dir), ["CLAUDE.md"])
        manager.toggle_skill("tdd", True)
        manager.deploy_skills_to_workspace(str(workspace))

        # File should exist
        target = workspace / "CLAUDE.md"
        assert target.exists() or target.is_symlink()

        manager.clean_workspace_skills(str(workspace))

        # Symlink should be removed
        assert not target.is_symlink()

    def test_user_authored_file_not_deleted(
        self,
        manager: SkillsManager,
        workspace: Path,
        db: DatabaseManager,
    ) -> None:
        """A CLAUDE.md that was not deployed by AgentSoul must not be removed."""
        user_file = workspace / "CLAUDE.md"
        user_file.write_text("# My custom rules\n")

        # No managed rule files for this workspace
        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            rows = conn.execute(
                "SELECT * FROM managed_rule_files WHERE workspace_path = ?",
                (str(workspace.resolve()),),
            ).fetchall()
        assert len(rows) == 0

        manager.clean_workspace_skills(str(workspace))

        # User file should still exist
        assert user_file.exists()
        assert user_file.read_text() == "# My custom rules\n"


class TestManagedRuleFileDAO:
    """Direct DAO operations on managed_rule_files table."""

    def test_record_managed_rule_file(
        self, db: DatabaseManager
    ) -> None:
        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            conn.execute(
                "INSERT INTO managed_rule_files "
                "(workspace_path, target_path, source_path, skill_name, deployment_method, content_hash, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("/project", "CLAUDE.md", "/skills/tdd/rules.md", "tdd", "symlink", "abc123", "2026-05-29"),
            )
            conn.commit()
            row = conn.execute(
                "SELECT skill_name, deployment_method FROM managed_rule_files WHERE workspace_path = '/project'"
            ).fetchone()
        assert row[0] == "tdd"
        assert row[1] == "symlink"

    def test_delete_managed_rule_file(
        self, db: DatabaseManager
    ) -> None:
        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            conn.execute(
                "INSERT INTO managed_rule_files "
                "(workspace_path, target_path, source_path, skill_name, deployment_method, content_hash, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                ("/project", "CLAUDE.md", "/skills/tdd/rules.md", "tdd", "symlink", "abc123", "2026-05-29"),
            )
            conn.commit()
            conn.execute(
                "DELETE FROM managed_rule_files WHERE workspace_path = ? AND target_path = ?",
                ("/project", "CLAUDE.md"),
            )
            conn.commit()
            count = conn.execute(
                "SELECT COUNT(*) FROM managed_rule_files WHERE workspace_path = '/project'"
            ).fetchone()[0]
        assert count == 0

    def test_get_managed_rule_files_for_workspace(
        self, db: DatabaseManager
    ) -> None:
        import sqlite3
        with sqlite3.connect(db.db_path) as conn:
            for fname in ("CLAUDE.md", ".cursorrules"):
                conn.execute(
                    "INSERT INTO managed_rule_files "
                    "(workspace_path, target_path, source_path, skill_name, deployment_method, content_hash, created_at) "
                    "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    ("/project", fname, f"/skills/tdd/{fname}", "tdd", "symlink", "h1", "2026-05-29"),
                )
            conn.commit()
            rows = conn.execute(
                "SELECT target_path FROM managed_rule_files WHERE workspace_path = '/project' ORDER BY target_path"
            ).fetchall()
        assert [r[0] for r in rows] == [".cursorrules", "CLAUDE.md"]
