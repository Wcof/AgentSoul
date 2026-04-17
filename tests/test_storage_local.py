"""
AgentSoul · 本地存储单元测试
=============================

测试 src/storage/local.py 所有存储实现
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import json
import tempfile
import shutil
from datetime import datetime
from pathlib import Path
from typing import cast
import unittest
import yaml

from agentsoul.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
    LocalSkillStorage,
)
from agentsoul.abstract import (
    MemoryConflict,
    SoulVersion,
)


class TestLocalPersonaStorage(unittest.TestCase):
    """Tests for LocalPersonaStorage"""

    def setUp(self):
        """Create a temporary directory for testing"""
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = Path(self.temp_dir)
        self.storage = LocalPersonaStorage(project_root=self.project_root)

    def tearDown(self):
        """Clean up temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_read_persona_config_default_when_file_missing(self):
        """When config file doesn't exist, return default config"""
        config = self.storage.read_persona_config()
        self.assertIn("ai", config)
        self.assertIn("master", config)
        self.assertEqual(config["ai"]["name"], "Agent")
        self.assertEqual(config["master"]["timezone"], "Asia/Shanghai")

    def test_write_and_read_persona_config(self):
        """Write config then read it back"""
        test_config = {
            "ai": {
                "name": "TestAgent",
                "nickname": "Tester",
                "role": "Test Assistant",
                "personality": ["friendly", "helpful"],
                "core_values": ["privacy"],
                "interaction_style": {
                    "tone": "friendly",
                    "language": "chinese",
                },
            },
            "master": {
                "name": "TestUser",
                "timezone": "America/New_York",
                "labels": ["developer", "tester"],
            },
        }
        success = self.storage.write_persona_config(test_config)
        self.assertTrue(success)
        read_back = self.storage.read_persona_config()
        self.assertEqual(read_back["ai"]["name"], "TestAgent")
        self.assertEqual(read_back["master"]["name"], "TestUser")

    def test_get_version_default_when_file_missing(self):
        """When config file doesn't exist, get_version returns 0.0.0"""
        version = self.storage.get_version()
        self.assertEqual(version.version, "0.0.0")
        self.assertIsNone(version.checksum)

    def test_get_version_after_write(self):
        """After writing config, get_version returns correct version info"""
        test_config = {"ai": {"name": "Test"}, "master": {"name": "Test"}}
        self.storage.write_persona_config(test_config)
        version = self.storage.get_version()
        self.assertTrue(version.version.startswith("1.0."))
        self.assertIsNotNone(version.checksum)
        # Caching should work
        version_cached = self.storage.get_version()
        self.assertEqual(version.checksum, version_cached.checksum)


class TestLocalSoulStateStorage(unittest.TestCase):
    """Tests for LocalSoulStateStorage"""

    def setUp(self):
        """Create a temporary directory for testing"""
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = Path(self.temp_dir)
        self.storage = LocalSoulStateStorage(project_root=self.project_root)

    def tearDown(self):
        """Clean up temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_read_soul_state_default_when_file_missing(self):
        """When state file doesn't exist, return default state"""
        state = self.storage.read_soul_state()
        self.assertEqual(state["version"], "1.0.0")
        self.assertEqual(state["pleasure"], 0.3)
        self.assertEqual(state["arousal"], 0.2)
        self.assertEqual(state["dominance"], 0.3)

    def test_write_and_read_soul_state(self):
        """Write state then read it back"""
        test_state = {
            "version": "1.0.0",
            "pleasure": 0.5,
            "arousal": 0.4,
            "dominance": 0.6,
            "last_updated": "2026-01-01T00:00:00",
            "history": [],
        }
        success = self.storage.write_soul_state(test_state)
        self.assertTrue(success)
        read_back = self.storage.read_soul_state()
        self.assertEqual(read_back["pleasure"], 0.5)
        self.assertEqual(read_back["arousal"], 0.4)
        self.assertEqual(read_back["dominance"], 0.6)

    def test_list_versions_empty_when_no_history(self):
        """When no version history exists, list_versions returns empty list"""
        versions = self.storage.list_versions()
        self.assertEqual(len(versions), 0)

    def test_rollback_fails_when_version_not_found(self):
        """Rollback to non-existent version returns False"""
        success = self.storage.rollback("nonexistent")
        self.assertFalse(success)


class TestLocalMemoryStorage(unittest.TestCase):
    """Tests for LocalMemoryStorage"""

    def setUp(self):
        """Create a temporary directory for testing"""
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = Path(self.temp_dir)
        self.storage = LocalMemoryStorage(project_root=self.project_root)

    def tearDown(self):
        """Clean up temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_sanitize_topic(self):
        """Test _sanitize_topic removes dangerous characters"""
        sanitized = self.storage._sanitize_topic("my-topic_123!@#$%^&*()")
        self.assertEqual(sanitized, "my-topic_123")

    def test_parse_date_valid(self):
        """Test _parse_date with valid dates"""
        parsed = self.storage._parse_date("2026-04-07")
        self.assertEqual(parsed, (2026, 4, 7))
        parsed = self.storage._parse_date("2024-02-29")  # leap year
        self.assertEqual(parsed, (2024, 2, 29))

    def test_parse_date_invalid(self):
        """Test _parse_date with invalid dates"""
        self.assertIsNone(self.storage._parse_date("2026-13-01"))  # invalid month
        self.assertIsNone(self.storage._parse_date("2026-04-32"))  # invalid day
        self.assertIsNone(self.storage._parse_date("2025-02-29"))  # not leap year
        self.assertIsNone(self.storage._parse_date("invalid"))  # bad format
        self.assertIsNone(self.storage._parse_date("2026/04/07"))  # wrong format

    def test_date_conversions(self):
        """Test date conversion methods"""
        # _date_to_year_week
        week = self.storage._date_to_year_week("2026-01-01")
        self.assertEqual(week, "2026-01")

        # _date_to_year_month
        month = self.storage._date_to_year_month("2026-04-07")
        self.assertEqual(month, "2026-04")

        # _date_to_year
        year = self.storage._date_to_year("2026-04-07")
        self.assertEqual(year, "2026")

        # Invalid input returns None
        self.assertIsNone(self.storage._date_to_year_week("invalid"))
        self.assertIsNone(self.storage._date_to_year_month("invalid"))
        self.assertIsNone(self.storage._date_to_year("invalid"))

    def test_should_archive_day_to_week(self):
        """Test _should_archive_day_to_week logic"""
        # Different week → should archive
        result = self.storage._should_archive_day_to_week("2026-01-08", "2026-01-01")
        self.assertTrue(result)

        # Same week, less than 7 days → should not archive
        result = self.storage._should_archive_day_to_week("2026-01-05", "2026-01-01")
        self.assertFalse(result)

        # Invalid date → should not archive
        result = self.storage._should_archive_day_to_week("invalid", "2026-01-01")
        self.assertFalse(result)

    def test_should_archive_week_to_month(self):
        """Test _should_archive_week_to_month logic"""
        # Previous year → should archive
        result = self.storage._should_archive_week_to_month("2025-12")
        self.assertTrue(result)

        # Invalid format → should not archive
        result = self.storage._should_archive_week_to_month("invalid")
        self.assertFalse(result)

    def test_should_archive_month_to_year(self):
        """Test _should_archive_month_to_year logic"""
        # Previous year → should archive
        result = self.storage._should_archive_month_to_year("2025-12")
        self.assertTrue(result)

        # Invalid format → should not archive
        result = self.storage._should_archive_month_to_year("invalid")
        self.assertFalse(result)

    def test_write_and_read_daily_memory(self):
        """Write daily memory then read it back"""
        date = "2026-04-07"
        content = "# Daily Memory\n\nTest content for testing."
        success = self.storage.write_daily_memory(date, content)
        self.assertTrue(success)
        read_back = self.storage.read_daily_memory(date)
        self.assertEqual(read_back.strip(), content.strip())

    def test_append_to_daily_memory(self):
        """Append to existing daily memory"""
        date = "2026-04-07"
        content1 = "First part"
        content2 = "Second part"
        self.storage.write_daily_memory(date, content1)
        success = self.storage.write_daily_memory(date, content2, append=True)
        self.assertTrue(success)
        read_back = self.storage.read_daily_memory(date)
        self.assertIn("First part", read_back)
        self.assertIn("Second part", read_back)

    def test_read_nonexistent_daily_memory(self):
        """Reading non-existent daily memory returns None"""
        result = self.storage.read_daily_memory("2099-12-31")
        self.assertIsNone(result)

    def test_write_and_read_weekly_memory(self):
        """Write weekly memory then read it back"""
        week = "2026-15"
        content = "# Weekly Memory\n\nAggregated content."
        success = self.storage.write_weekly_memory(week, content)
        self.assertTrue(success)
        read_back = self.storage.read_weekly_memory(week)
        self.assertEqual(read_back.strip(), content.strip())

    def test_read_nonexistent_weekly_memory(self):
        """Reading non-existent weekly memory returns None"""
        result = self.storage.read_weekly_memory("2099-99")
        self.assertIsNone(result)

    def test_write_and_read_monthly_memory(self):
        """Write monthly memory then read it back"""
        month = "2026-04"
        content = "# Monthly Memory\n\nMonthly summary."
        success = self.storage.write_monthly_memory(month, content)
        self.assertTrue(success)
        read_back = self.storage.read_monthly_memory(month)
        self.assertEqual(read_back.strip(), content.strip())

    def test_read_nonexistent_monthly_memory(self):
        """Reading non-existent monthly memory returns None"""
        result = self.storage.read_monthly_memory("2099-13")
        self.assertIsNone(result)

    def test_write_and_read_yearly_memory(self):
        """Write yearly memory then read it back"""
        year = "2026"
        content = "# Yearly Memory\n\nYearly summary."
        success = self.storage.write_yearly_memory(year, content)
        self.assertTrue(success)
        read_back = self.storage.read_yearly_memory(year)
        self.assertEqual(read_back.strip(), content.strip())

    def test_read_nonexistent_yearly_memory(self):
        """Reading non-existent yearly memory returns None"""
        result = self.storage.read_yearly_memory("9999")
        self.assertIsNone(result)

    def test_write_and_read_topic_memory(self):
        """Write topic memory then read it back"""
        topic = "test-topic"
        content = "# Topic Memory\n\nTopic content."
        success = self.storage.write_topic_memory(topic, content)
        self.assertTrue(success)
        read_back = self.storage.read_topic_memory(topic)
        self.assertEqual(read_back.strip(), content.strip())

    def test_read_nonexistent_topic_memory(self):
        """Reading non-existent topic memory returns None"""
        result = self.storage.read_topic_memory("nonexistent-topic")
        self.assertIsNone(result)

    def test_list_topics_empty_when_no_topics(self):
        """list_topics returns empty when no topics exist"""
        topics = self.storage.list_topics("active")
        self.assertEqual(len(topics), 0)

    def test_list_topics_with_topics(self):
        """list_topics correctly lists active topics"""
        self.storage.write_topic_memory("topic-one", "content")
        self.storage.write_topic_memory("topic-two", "content")
        topics = self.storage.list_topics("active")
        self.assertEqual(len(topics), 2)
        names = [t["name"] for t in topics]
        self.assertIn("topic-one", names)
        self.assertIn("topic-two", names)

    def test_archive_topic(self):
        """Archive a topic moves it to archive directory"""
        topic = "to-archive"
        self.storage.write_topic_memory(topic, "content")
        # Before archive
        active_before = [t["name"] for t in self.storage.list_topics("active")]
        archived_before = [t["name"] for t in self.storage.list_topics("archived")]
        self.assertIn(topic, active_before)
        self.assertNotIn(topic, archived_before)

        # Do archive
        success = self.storage.archive_topic(topic)
        self.assertTrue(success)

        # After archive
        active_after = [t["name"] for t in self.storage.list_topics("active")]
        archived_after = [t["name"] for t in self.storage.list_topics("archived")]
        self.assertNotIn(topic, active_after)
        self.assertIn(topic, archived_after)

        # Can still read archived topic
        content = self.storage.read_topic_memory(topic)
        self.assertIsNotNone(content)

    def test_archive_topic_fails_when_not_found(self):
        """Archive fails when topic doesn't exist"""
        success = self.storage.archive_topic("nonexistent")
        self.assertFalse(success)

    def test_detect_conflict_no_conflict_nonexistent(self):
        """No conflict when topic doesn't exist"""
        conflict = self.storage.detect_conflict("nonexistent", "new content")
        self.assertIsNone(conflict)

    def test_detect_conflict_size_mismatch(self):
        """Detect conflict when new content is much larger than existing"""
        topic = "test-conflict"
        existing = "short"
        self.storage.write_topic_memory(topic, existing)
        new_content = "x" * 1000  # 1000 chars vs 5 chars → 10x+
        conflict = self.storage.detect_conflict(topic, new_content)
        self.assertIsNotNone(conflict)
        if conflict:
            self.assertEqual(conflict.conflict_type, "size_mismatch")

    def test_detect_conflict_timestamp_mismatch(self):
        """Detect conflict when timestamps don't match"""
        topic = "test-timestamp"
        existing = "Content from 2026-01-01"
        self.storage.write_topic_memory(topic, existing)
        new_content = "Content from 2026-02-01"
        conflict = self.storage.detect_conflict(topic, new_content)
        self.assertIsNotNone(conflict)
        if conflict:
            self.assertEqual(conflict.conflict_type, "timestamp_mismatch")

    def test_resolve_conflict_keep_existing(self):
        """Resolving with keep_existing doesn't change anything"""
        topic = "resolve-test"
        original_content = "original content"
        new_content = "new content from 2026-01-01"
        self.storage.write_topic_memory(topic, original_content + "\n2026-02-01")
        conflict = cast(MemoryConflict, self.storage.detect_conflict(topic, new_content))
        success = self.storage.resolve_conflict(conflict, "keep_existing")
        self.assertTrue(success)
        read_back = self.storage.read_topic_memory(topic)
        self.assertEqual(read_back.strip(), (original_content + "\n2026-02-01").strip())

    def test_resolve_conflict_overwrite(self):
        """Resolving with overwrite replaces content"""
        topic = "resolve-test"
        original_content = "original"
        new_content = "overwritten from 2026-02-01"
        self.storage.write_topic_memory(topic, original_content + "\n2026-01-01")
        conflict = cast(MemoryConflict, self.storage.detect_conflict(topic, new_content))
        self.assertIsNotNone(conflict)
        success = self.storage.resolve_conflict(conflict, "overwrite")
        self.assertTrue(success)
        read_back = self.storage.read_topic_memory(topic)
        self.assertIn("overwritten", read_back)

    def test_resolve_conflict_merge_append(self):
        """Resolving with merge_append combines content"""
        topic = "resolve-test"
        original_content = "original\n2026-01-01"
        new_content = "appended\n2026-02-01"
        self.storage.write_topic_memory(topic, original_content)
        conflict = cast(MemoryConflict, self.storage.detect_conflict(topic, new_content))
        self.assertIsNotNone(conflict)
        success = self.storage.resolve_conflict(conflict, "merge_append")
        self.assertTrue(success)
        read_back = self.storage.read_topic_memory(topic)
        self.assertIn("original", read_back)
        self.assertIn("appended", read_back)

    def test_resolve_conflict_unknown_strategy(self):
        """Unknown resolution strategy returns False"""
        topic = "resolve-test"
        self.storage.write_topic_memory(topic, "content")
        conflict = cast(MemoryConflict, self.storage.detect_conflict(topic, "new"))
        success = self.storage.resolve_conflict(conflict, "unknown-strategy")
        self.assertFalse(success)

    def test_aggregate_daily_to_weekly(self):
        """Aggregate multiple daily memories into weekly"""
        # Create two days in the same week
        self.storage.write_daily_memory("2026-01-01", "Day 1 content")
        self.storage.write_daily_memory("2026-01-02", "Day 2 content")
        aggregated = self.storage._aggregate_daily_to_weekly("2026-01")
        self.assertIsNotNone(aggregated)
        if aggregated:
            self.assertIn("Day 1 content", aggregated)
            self.assertIn("Day 2 content", aggregated)

    def test_aggregate_daily_to_weekly_returns_none_when_no_content(self):
        """Returns None when daily directory doesn't exist"""
        aggregated = self.storage._aggregate_daily_to_weekly("2026-01")
        self.assertIsNone(aggregated)

    def test_trigger_automatic_archiving_no_error_when_no_dirs(self):
        """_trigger_automatic_archiving doesn't crash when directories don't exist"""
        # Should not throw
        self.storage._trigger_automatic_archiving("2026-04-07")

    def test_atomic_write_creates_parent_dir(self):
        """_atomic_write creates parent directories if needed"""
        path = self.storage.base_dir / "subdir1" / "subdir2" / "test.md"
        success = self.storage._atomic_write(path, "test content", append=False)
        self.assertTrue(success)
        self.assertTrue(path.exists())


class TestLocalSkillStorage(unittest.TestCase):
    """Tests for LocalSkillStorage"""

    def setUp(self):
        """Create a temporary directory for testing with mock rules"""
        self.temp_dir = tempfile.mkdtemp()
        self.project_root = Path(self.temp_dir)
        # Create src directory with some rule files
        self.src_dir = self.project_root / "src"
        self.src_dir.mkdir()
        # Create a few rule files
        (self.src_dir / "SKILL.md").write_text("# SKILL\n")
        (self.src_dir / "soul_base.md").write_text("# soul_base\n")
        (self.src_dir / "custom.md").write_text("# custom\n")  # Not in list
        self.storage = LocalSkillStorage(project_root=self.project_root)

    def tearDown(self):
        """Clean up temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_read_base_rule_exists(self):
        """Reading existing base rule returns content"""
        content = self.storage.read_base_rule("SKILL")
        self.assertEqual(content, "# SKILL\n")

    def test_read_base_rule_not_found(self):
        """Reading non-existent base rule returns None"""
        content = self.storage.read_base_rule("nonexistent")
        self.assertIsNone(content)

    def test_list_available_rules(self):
        """list_available_rules returns only the expected rules"""
        rules = self.storage.list_available_rules()
        self.assertIn("SKILL", rules)
        self.assertIn("soul_base", rules)
        # custom.md is not in the expected list of base rules
        self.assertNotIn("custom", rules)
        # Should be sorted
        self.assertEqual(rules, sorted(rules))


class TestLocalPersonaStorageExtra(unittest.TestCase):
    """Additional tests for LocalPersonaStorage edge cases"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        (self.project_root / "config").mkdir()
        self.storage = LocalPersonaStorage(project_root=self.project_root)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_get_version_io_error_returns_default(self):
        """When config file exists but can't be read for version calculation, returns default version"""
        # Create file with no permissions
        test_config = {"ai": {"name": "Test"}}
        with open(self.storage.config_path, "w", encoding="utf-8") as f:
            yaml.dump(test_config, f)

        # Remove read permission
        self.storage.config_path.chmod(0o000)
        version = self.storage.get_version()
        # Restore permission for cleanup
        self.storage.config_path.chmod(0o644)

        self.assertEqual(version.version, "0.0.0")
        self.assertIsNone(version.checksum)


class TestLocalSoulStateStorageExtra(unittest.TestCase):
    """Additional tests for LocalSoulStateStorage edge cases"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        self.storage = LocalSoulStateStorage(project_root=self.project_root)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_read_json_corrupted_returns_default(self):
        """When state file exists but JSON is corrupted, return default state"""
        self.storage.state_path.parent.mkdir(parents=True)
        with open(self.storage.state_path, "w", encoding="utf-8") as f:
            f.write("this is not valid json {{{")

        result = self.storage.read_soul_state()
        self.assertEqual(result["pleasure"], 0.3)

    def test_save_version_snapshot_no_error_on_permission_error(self):
        """_save_version_snapshot doesn't throw exception on IO error, just logs it"""
        # Create directory read-only
        self.storage.history_dir.parent.mkdir(parents=True)
        self.storage.history_dir.mkdir()
        self.storage.history_dir.chmod(0o555)

        state = {"version": "1.0.0", "pleasure": 0.5}
        # Should not throw
        self.storage._save_version_snapshot(state)

        # Restore permission for cleanup
        self.storage.history_dir.chmod(0o755)

    def test_rollback_fails_on_read_error(self):
        """Rollback fails when snapshot can't be read"""
        self.storage.history_dir.mkdir(parents=True)
        snap_path = self.storage.history_dir / "20260101_120000_v1.0.0.json"
        with open(snap_path, "w", encoding="utf-8") as f:
            f.write("not valid json")

        result = self.storage.rollback("v1.0.0")
        self.assertFalse(result)


class TestLocalMemoryStorageExtra(unittest.TestCase):
    """Additional tests for LocalMemoryStorage edge cases"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        self.storage = LocalMemoryStorage(project_root=self.project_root)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_read_daily_io_error_returns_none(self):
        """When daily file exists but can't be read, returns None"""
        date = "2026-04-07"
        path = self.storage._get_path("day", date)
        path.parent.mkdir(parents=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("content")

        path.chmod(0o000)
        result = self.storage.read_daily_memory(date)
        path.chmod(0o644)
        self.assertIsNone(result)

    def test_aggregate_weekly_to_monthly(self):
        """_aggregate_weekly_to_monthly aggregates multiple weeks into month"""
        week_dir = self.storage.base_dir / "week"
        week_dir.mkdir(parents=True)
        self.storage.write_weekly_memory("2026-04", "Week 1 content")
        self.storage.write_weekly_memory("2026-04-02", "Week 2 content")

        aggregated = self.storage._aggregate_weekly_to_monthly("2026-04")
        self.assertIsNotNone(aggregated)
        self.assertIn("Week 1 content", aggregated)
        self.assertIn("Week 2 content", aggregated)

    def test_aggregate_weekly_to_monthly_returns_none_when_no_dir(self):
        """Returns None when week directory doesn't exist"""
        aggregated = self.storage._aggregate_weekly_to_monthly("2026-04")
        self.assertIsNone(aggregated)

    def test_aggregate_monthly_to_yearly(self):
        """_aggregate_monthly_to_yearly aggregates multiple months into year"""
        month_dir = self.storage.base_dir / "month"
        month_dir.mkdir(parents=True)
        self.storage.write_monthly_memory("2026-01", "January content")
        self.storage.write_monthly_memory("2026-02", "February content")

        aggregated = self.storage._aggregate_monthly_to_yearly("2026")
        self.assertIsNotNone(aggregated)
        self.assertIn("January content", aggregated)
        self.assertIn("February content", aggregated)

    def test_aggregate_monthly_to_yearly_returns_none_when_no_dir(self):
        """Returns None when month directory doesn't exist"""
        aggregated = self.storage._aggregate_monthly_to_yearly("2026")
        self.assertIsNone(aggregated)

    def test_aggregate_daily_to_weekly_no_content_returns_none(self):
        """Returns None when all daily files are empty"""
        day_dir = self.storage.base_dir / "day"
        day_dir.mkdir(parents=True)
        (day_dir / "2026-01-01.md").write_text("")

        aggregated = self.storage._aggregate_daily_to_weekly("2026-01")
        self.assertIsNone(aggregated)

    def test_read_topic_active_io_error_returns_none(self):
        """When active topic file exists but can't be read, returns None after trying"""
        topic = "test"
        sanitized = self.storage._sanitize_topic(topic)
        path = self.storage.base_dir / "topic" / f"{sanitized}.md"
        path.parent.mkdir(parents=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("content")

        path.chmod(0o000)
        result = self.storage.read_topic_memory(topic)
        path.chmod(0o644)
        self.assertIsNone(result)

    def test_atomic_write_append_fails_when_cant_read_existing(self):
        """append mode fails when existing file can't be read"""
        path = self.storage.base_dir / "test" / "file.md"
        path.parent.mkdir(parents=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write("existing")
        path.chmod(0o000)

        success = self.storage._atomic_write(path, "new content", append=True)
        path.chmod(0o644)
        self.assertFalse(success)

    def test_list_topics_skips_unreadable_files_and_errors(self):
        """list_topics skips unreadable files and continues"""
        active_dir = self.storage.base_dir / "topic"
        active_dir.mkdir(parents=True)
        # Create a readable file
        (active_dir / "good.md").write_text("content")
        # Create a file with no permissions to trigger exception during reading
        (active_dir / "bad.md").write_text("content")
        (active_dir / "bad.md").chmod(0o000)

        topics = self.storage.list_topics("active")
        # Should still get the good one, skip the bad one
        names = [t["name"] for t in topics]
        self.assertIn("good", names)

        # Cleanup
        (active_dir / "bad.md").chmod(0o644)

    def test_archive_topic_fails_on_rename_error(self):
        """archive_topic returns False when rename fails"""
        topic = "test"
        active_path = self.storage.base_dir / "topic" / f"{topic}.md"
        active_path.parent.mkdir(parents=True)
        active_path.write_text("content")

        # Make archive directory read-only so rename fails
        archive_dir = self.storage.base_dir / "topic" / "archive"
        archive_dir.mkdir(parents=True)
        archive_dir.chmod(0o555)

        success = self.storage.archive_topic(topic)
        archive_dir.chmod(0o755)
        self.assertFalse(success)

    def test_aggregate_weekly_to_monthly_handles_invalid_year_month(self):
        """Handles invalid year-month format gracefully - even with invalid week names, still aggregates what matches"""
        week_dir = self.storage.base_dir / "week"
        week_dir.mkdir(parents=True)
        # Create a week file with invalid name that can't be split
        (week_dir / "invalid.md").write_text("content")

        aggregated = self.storage._aggregate_weekly_to_monthly("invalid")
        # Even though the name can't be parsed, it still aggregates it when prefix matches
        self.assertIsNotNone(aggregated)
        self.assertIn("content", aggregated)


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
