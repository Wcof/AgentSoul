"""
AgentSoul · Work Session Tests
================================
Verifies Work Session model (searchable vs resumable),
session launcher safety integration, and resume command handling.
"""
from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import pytest

from agentsoul.safety.models import ActionRiskClass
from sessions.work_session import WorkSession, WorkSessionBuilder


class TestWorkSession:
    """WorkSession is the searchable unit of development context."""

    def test_work_session_is_searchable_by_default(self) -> None:
        ws = WorkSession(
            session_id="s-1",
            project_dir="/project",
            client="claude_code",
            title="Refactor auth module",
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
        )
        assert ws.is_searchable is True

    def test_work_session_is_not_resumable_by_default(self) -> None:
        ws = WorkSession(
            session_id="s-1",
            project_dir="/project",
            client="claude_code",
            title="Refactor auth module",
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
        )
        assert ws.is_resumable is False

    def test_work_session_with_resume_command_is_resumable(self) -> None:
        ws = WorkSession(
            session_id="s-1",
            project_dir="/project",
            client="claude_code",
            title="Refactor auth module",
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
            resume_command="claude -r s-1",
        )
        assert ws.is_resumable is True

    def test_launch_is_high_risk_action(self) -> None:
        ws = WorkSession(
            session_id="s-1",
            project_dir="/project",
            client="claude_code",
            title="Refactor auth",
            created_at=datetime.utcnow(),
            last_active_at=datetime.utcnow(),
            resume_command="claude -r s-1",
        )
        assert ws.launch_risk_class == ActionRiskClass.HIGH_RISK

    def test_work_session_to_dict_roundtrip(self) -> None:
        now = datetime.utcnow()
        ws = WorkSession(
            session_id="s-1",
            project_dir="/project",
            client="claude_code",
            title="Test session",
            created_at=now,
            last_active_at=now,
            resume_command="claude -r s-1",
        )
        data = ws.to_dict()
        assert data["session_id"] == "s-1"
        assert data["is_searchable"] is True
        assert data["is_resumable"] is True
        assert data["resume_command"] == "claude -r s-1"


class TestWorkSessionBuilder:
    """Builder constructs WorkSession from scanner output."""

    def test_builder_from_scanner_entry(self) -> None:
        entry = {
            "session_id": "s-10",
            "project_dir": "/project",
            "provider": "claude_code",
            "title": "Fix login bug",
            "created_at": "2026-05-28T10:00:00",
            "last_active_at": "2026-05-28T12:00:00",
        }
        builder = WorkSessionBuilder()
        ws = builder.from_scanner_entry(entry)
        assert ws.session_id == "s-10"
        assert ws.is_searchable is True
        assert ws.is_resumable is False  # No resume command from scanner

    def test_builder_infers_resumable_when_command_known(self) -> None:
        entry = {
            "session_id": "s-11",
            "project_dir": "/project",
            "provider": "claude_code",
            "title": "Add tests",
            "created_at": "2026-05-28T10:00:00",
            "last_active_at": "2026-05-28T12:00:00",
            "resume_command": "claude -r s-11",
        }
        builder = WorkSessionBuilder()
        ws = builder.from_scanner_entry(entry)
        assert ws.is_resumable is True

    def test_builder_handles_missing_fields(self) -> None:
        entry = {
            "session_id": "s-12",
            "project_dir": "/project",
            "provider": "unknown_client",
            "created_at": "2026-05-28T10:00:00",
            "last_active_at": "2026-05-28T12:00:00",
        }
        builder = WorkSessionBuilder()
        ws = builder.from_scanner_entry(entry)
        assert ws.title == ""
        assert ws.is_resumable is False
