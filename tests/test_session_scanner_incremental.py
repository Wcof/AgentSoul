"""
AgentSoul · Incremental Session Scanner Tests
=============================================

Verifies incremental scanning of history.jsonl, st_mtime and st_size checks,
offset tracking, and recovery from log truncation/rotation.
"""
from __future__ import annotations

import json
import time
from pathlib import Path
import pytest
from agentsoul.storage.db import DatabaseManager
from sessions.scanners.claude_jsonl import ClaudeJsonlScanner


@pytest.fixture
def test_db(temp_dir):
    db_path = temp_dir / "test_agentsoul.db"
    return DatabaseManager(db_path)


def test_incremental_scan(temp_dir, test_db):
    history_file = temp_dir / "history.jsonl"

    # Create first batch of logs
    session_id_1 = "sess-1111-1111"
    log1 = {"sessionId": session_id_1, "timestamp": 1716616000000, "project": "/path/to/p1", "display": "Query 1"}
    log2 = {"sessionId": session_id_1, "timestamp": 1716616005000, "project": "/path/to/p1", "display": "Query 2"}

    with open(history_file, "w", encoding="utf-8") as f:
        f.write(json.dumps(log1) + "\n")
        f.write(json.dumps(log2) + "\n")

    scanner = ClaudeJsonlScanner(history_file)

    # 1. First Scan (Full Scan from offset 0)
    count = scanner.scan(test_db)
    assert count == 1  # 1 session cached

    sessions = test_db.get_cached_sessions()
    assert len(sessions) == 1
    assert sessions[0]["session_id"] == session_id_1
    assert sessions[0]["title"] == "Query 1"
    assert sessions[0]["summary"] == "Query 2"

    # Verify offset was saved
    state = test_db.get_scanner_state(str(history_file))
    assert state["last_offset"] > 0

    # 2. Second Scan (No new files, st_mtime is same)
    count_noop = scanner.scan(test_db)
    assert count_noop == 0

    # 3. Third Scan (Append new log line)
    session_id_2 = "sess-2222-2222"
    log3 = {"sessionId": session_id_2, "timestamp": 1716616010000, "project": "/path/to/p2", "display": "Query 3"}

    # Sleep slightly to ensure mtime changes
    time.sleep(1.0)
    with open(history_file, "a", encoding="utf-8") as f:
        f.write(json.dumps(log3) + "\n")

    count_inc = scanner.scan(test_db)
    assert count_inc == 1  # only sess-2222-2222 is new/updated in this batch

    sessions2 = test_db.get_cached_sessions()
    assert len(sessions2) == 2
    # Order is by last_active_at DESC
    assert sessions2[0]["session_id"] == session_id_2

    # 4. Truncation/Rotation Check
    # Sleep slightly to ensure mtime changes
    time.sleep(1.0)
    # Write only a new single line (file is now smaller than previous offset)
    session_id_3 = "sess-3333-3333"
    log4 = {"sessionId": session_id_3, "timestamp": 1716616020000, "project": "/path/to/p3", "display": "Query 4"}
    with open(history_file, "w", encoding="utf-8") as f:
        f.write(json.dumps(log4) + "\n")

    count_truncated = scanner.scan(test_db)
    assert count_truncated == 1  # successfully scanned sess-3333-3333 after resetting offset to 0

    sessions3 = test_db.get_cached_sessions()
    # sess-3333-3333 should be present
    assert any(s["session_id"] == session_id_3 for s in sessions3)
