"""
Unit tests for src/memory_enhanced/priority.py
=============================

Tests for PriorityLevel, MemoryPriority, PriorityManager
"""
import os
import json
import tempfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path
import unittest

from agentsoul.memory.enhanced.priority import (
    PriorityLevel,
    MemoryPriority,
    PriorityManager,
)


class TestPriorityLevelEnum(unittest.TestCase):
    """Tests for PriorityLevel enum"""

    def test_enum_values(self):
        """Test that enum has correct values"""
        self.assertEqual(PriorityLevel.HIGH.value, "high")
        self.assertEqual(PriorityLevel.MEDIUM.value, "medium")
        self.assertEqual(PriorityLevel.LOW.value, "low")

    def test_enum_comparison(self):
        """Test that enum can be compared"""
        self.assertEqual(PriorityLevel.HIGH, PriorityLevel.HIGH)
        self.assertNotEqual(PriorityLevel.HIGH, PriorityLevel.MEDIUM)


class TestMemoryPriorityDataclass(unittest.TestCase):
    """Tests for MemoryPriority dataclass"""

    def test_create_memory_priority(self):
        """Test creating MemoryPriority with default values"""
        now = datetime.now()
        mp = MemoryPriority(
            memory_id="test-id",
            level=PriorityLevel.MEDIUM,
            access_count=0,
            last_accessed=now
        )
        self.assertEqual(mp.memory_id, "test-id")
        self.assertEqual(mp.level, PriorityLevel.MEDIUM)
        self.assertEqual(mp.access_count, 0)
        self.assertEqual(mp.last_accessed, now)
        self.assertEqual(mp.manual_override, False)

    def test_create_memory_priority_manual_override(self):
        """Test creating MemoryPriority with manual_override True"""
        now = datetime.now()
        mp = MemoryPriority(
            memory_id="test-id",
            level=PriorityLevel.HIGH,
            access_count=5,
            last_accessed=now,
            manual_override=True
        )
        self.assertTrue(mp.manual_override)


class TestPriorityManager(unittest.TestCase):
    """Tests for PriorityManager"""

    def setUp(self):
        """Create a temporary directory for testing"""
        self.temp_dir = tempfile.mkdtemp()
        self.storage_path = Path(self.temp_dir)
        self.pm = PriorityManager(storage_path=self.storage_path, default_ttl=300)

    def tearDown(self):
        """Clean up temporary directory"""
        shutil.rmtree(self.temp_dir)

    def test_init_creates_directory(self):
        """Test that __init__ creates storage directory if it doesn't exist"""
        self.assertTrue(self.storage_path.exists())

    def test_init_empty_index(self):
        """Test that empty storage initializes with empty priorities"""
        # No index file exists → should have empty dict
        self.assertEqual(len(self.pm._priorities), 0)

    def test_invalidate_cache(self):
        """Test invalidate_cache clears priorities"""
        self.pm.set_priority("test", PriorityLevel.HIGH)
        self.assertEqual(len(self.pm._priorities), 1)
        self.pm.invalidate_cache()
        # After invalidate, _priorities should be empty
        # Cache TTL will force reload on next access
        self.assertEqual(len(self.pm._priorities), 0)
        # Next access will reload
        level = self.pm.get_priority("test")
        self.assertEqual(level, PriorityLevel.HIGH)
        self.assertEqual(len(self.pm._priorities), 1)

    def test_set_and_get_priority(self):
        """Set priority then read it back"""
        self.pm.set_priority("test-memory", PriorityLevel.HIGH)
        level = self.pm.get_priority("test-memory")
        self.assertEqual(level, PriorityLevel.HIGH)

    def test_get_priority_default_medium(self):
        """Getting priority for non-existent memory returns MEDIUM"""
        level = self.pm.get_priority("nonexistent")
        self.assertEqual(level, PriorityLevel.MEDIUM)

    def test_set_priority_updates_existing(self):
        """Setting priority on existing memory updates it"""
        self.pm.set_priority("test", PriorityLevel.LOW)
        self.assertEqual(self.pm.get_priority("test"), PriorityLevel.LOW)
        self.pm.set_priority("test", PriorityLevel.HIGH)
        self.assertEqual(self.pm.get_priority("test"), PriorityLevel.HIGH)

    def test_record_access_increments_count(self):
        """Recording access increments access count"""
        self.pm.record_access("test")
        # After first access
        self.assertEqual(self.pm._priorities["test"].access_count, 1)
        self.pm.record_access("test")
        # After second access
        self.assertEqual(self.pm._priorities["test"].access_count, 2)

    def test_record_access_creates_if_not_exists(self):
        """Recording access creates entry if it doesn't exist"""
        self.assertEqual(len(self.pm._priorities), 0)
        self.pm.record_access("new-memory")
        self.assertEqual(len(self.pm._priorities), 1)
        self.assertIn("new-memory", self.pm._priorities)
        mp = self.pm._priorities["new-memory"]
        self.assertEqual(mp.access_count, 1)
        self.assertEqual(mp.level, PriorityLevel.MEDIUM)
        self.assertFalse(mp.manual_override)

    def test_record_access_updates_last_accessed(self):
        """Recording access updates last_accessed timestamp"""
        before = datetime.now() - timedelta(hours=1)
        self.pm.set_priority("test", PriorityLevel.MEDIUM)
        self.pm._priorities["test"].last_accessed = before
        self.pm.record_access("test")
        after = datetime.now()
        mp_last = self.pm._priorities["test"].last_accessed
        self.assertGreater(mp_last, before)

    def test_auto_adjust_priority_from_medium_to_high(self):
        """Auto-adjust: access_count >= 10 and recent → promote from MEDIUM to HIGH"""
        pm = self.pm
        pm.set_priority("test", PriorityLevel.MEDIUM)
        mp = pm._priorities["test"]
        mp.access_count = 10
        mp.last_accessed = datetime.now() - timedelta(days=3)  # < 7 days
        pm._auto_adjust_priority("test")
        self.assertEqual(mp.level, PriorityLevel.HIGH)

    def test_auto_adjust_priority_from_low_to_medium(self):
        """Auto-adjust: access_count >= 10 and recent → promote from LOW to MEDIUM"""
        pm = self.pm
        pm.set_priority("test", PriorityLevel.LOW)
        mp = pm._priorities["test"]
        mp.access_count = 12
        mp.last_accessed = datetime.now() - timedelta(days=2)  # < 7 days
        pm._auto_adjust_priority("test")
        self.assertEqual(mp.level, PriorityLevel.MEDIUM)

    def test_auto_adjust_priority_from_high_to_medium(self):
        """Auto-adjust: access_count <= 2 and old → demote from HIGH to MEDIUM"""
        pm = self.pm
        pm.set_priority("test", PriorityLevel.HIGH)
        mp = pm._priorities["test"]
        mp.access_count = 2
        mp.last_accessed = datetime.now() - timedelta(days=31)  # > 30 days
        pm._auto_adjust_priority("test")
        self.assertEqual(mp.level, PriorityLevel.MEDIUM)

    def test_auto_adjust_priority_from_medium_to_low(self):
        """Auto-adjust: access_count <= 2 and old → demote from MEDIUM to LOW"""
        pm = self.pm
        pm.set_priority("test", PriorityLevel.MEDIUM)
        mp = pm._priorities["test"]
        mp.access_count = 1
        mp.last_accessed = datetime.now() - timedelta(days=35)  # > 30 days
        pm._auto_adjust_priority("test")
        self.assertEqual(mp.level, PriorityLevel.LOW)

    def test_auto_adjust_no_change_when_manual_override(self):
        """Auto-adjust doesn't change when manual_override is True (during record_access)"""
        pm = self.pm
        pm.set_priority("test", PriorityLevel.HIGH)  # sets manual_override=True
        mp = pm._priorities["test"]
        mp.access_count = 1
        mp.last_accessed = datetime.now() - timedelta(days=40)
        original_level = mp.level
        # record_access should not auto-adjust because manual_override=True
        pm.record_access("test")
        # Should not change because manual_override is True
        self.assertEqual(mp.level, original_level)
        self.assertTrue(mp.manual_override)

    def test_get_high_priority_memories_empty(self):
        """get_high_priority_memories returns empty list when no high priorities"""
        result = self.pm.get_high_priority_memories()
        self.assertEqual(result, [])

    def test_get_high_priority_memories_returns_sorted(self):
        """get_high_priority_memories returns memory ids sorted by last_accessed descending"""
        # Create with different last_accessed
        self.pm.set_priority("oldest", PriorityLevel.HIGH)
        self.pm._priorities["oldest"].last_accessed = datetime.now() - timedelta(days=3)

        self.pm.set_priority("middle", PriorityLevel.HIGH)
        self.pm._priorities["middle"].last_accessed = datetime.now() - timedelta(days=1)

        self.pm.set_priority("newest", PriorityLevel.HIGH)
        self.pm._priorities["newest"].last_accessed = datetime.now()

        result = self.pm.get_high_priority_memories()
        # Should be newest first
        self.assertEqual(result, ["newest", "middle", "oldest"])

    def test_get_high_priority_memories_respects_limit(self):
        """get_high_priority_memories respects the limit parameter"""
        for i in range(10):
            self.pm.set_priority(f"mem{i}", PriorityLevel.HIGH)

        result = self.pm.get_high_priority_memories(limit=5)
        self.assertEqual(len(result), 5)

    def test_get_all_priorities_sorted(self):
        """get_all_priorities returns sorted by priority then access count"""
        self.pm.set_priority("low-1", PriorityLevel.LOW)
        self.pm.set_priority("high-1", PriorityLevel.HIGH)
        self.pm.set_priority("med-1", PriorityLevel.MEDIUM)
        self.pm.set_priority("high-2", PriorityLevel.HIGH)

        # More accesses to high-2
        self.pm.record_access("high-2")
        self.pm.record_access("high-2")

        result = self.pm.get_all_priorities()
        # Should be ordered: HIGH first (by access desc), then MEDIUM, then LOW
        # Within HIGH, higher access count comes first
        ids = [mp.memory_id for mp in result]
        # high-2 (2 accesses) before high-1 (1 access)
        high_pos_2 = ids.index("high-2")
        high_pos_1 = ids.index("high-1")
        self.assertLess(high_pos_2, high_pos_1)
        # HIGH before MEDIUM before LOW
        self.assertLess(ids.index("high-1"), ids.index("med-1"))
        self.assertLess(ids.index("med-1"), ids.index("low-1"))

    def test_reset_priority(self):
        """reset_priority sets back to MEDIUM and clears manual_override"""
        self.pm.set_priority("test", PriorityLevel.HIGH)
        self.assertTrue(self.pm._priorities["test"].manual_override)
        self.assertEqual(self.pm.get_priority("test"), PriorityLevel.HIGH)

        self.pm.reset_priority("test")
        self.assertEqual(self.pm.get_priority("test"), PriorityLevel.MEDIUM)
        self.assertFalse(self.pm._priorities["test"].manual_override)

    def test_reset_priority_nonexistent(self):
        """reset_priority does nothing when memory doesn't exist"""
        # Should not throw
        self.pm.reset_priority("nonexistent")
        self.assertNotIn("nonexistent", self.pm._priorities)

    def test_load_corrupted_index_handles_error(self):
        """Loading corrupted JSON clears priorities and doesn't throw"""
        # Write corrupted JSON
        self.storage_path.mkdir(exist_ok=True)
        index_file = self.storage_path / "priority_index.json"
        index_file.write_text("this is not valid json {")

        # Create new manager which should handle the error
        pm = PriorityManager(storage_path=self.storage_path)
        self.assertEqual(len(pm._priorities), 0)

    def test_persist_and_reload(self):
        """Saving and reloading from disk preserves priorities"""
        self.pm.set_priority("mem1", PriorityLevel.HIGH)
        self.pm.set_priority("mem2", PriorityLevel.LOW)
        self.pm.record_access("mem1")
        self.pm.record_access("mem1")

        # Create new manager instance which should load from disk
        pm2 = PriorityManager(storage_path=self.storage_path)
        self.assertEqual(pm2.get_priority("mem1"), PriorityLevel.HIGH)
        self.assertEqual(pm2.get_priority("mem2"), PriorityLevel.LOW)
        # Access count should be preserved
        # set_priority sets access_count=0 + 2 from record = 2
        self.assertEqual(pm2._priorities["mem1"].access_count, 2)

    def test_update_memory_file_priority(self):
        """_update_memory_file_priority updates priority field in memory file"""
        # Create memory file
        memory_file = self.storage_path / "test-memory.json"
        initial_data = {"id": "test-memory", "content": "test content"}
        with open(memory_file, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        self.pm.set_priority("test-memory", PriorityLevel.HIGH)
        # After set_priority, it should have updated the memory file
        with open(memory_file, encoding="utf-8") as f:
            data = json.load(f)
        self.assertEqual(data["priority"], "high")

    def test_update_memory_file_priority_nonexistent_file(self):
        """_update_memory_file_priority does nothing if memory file doesn't exist"""
        self.pm.set_priority("nonexistent-file", PriorityLevel.HIGH)
        # Should not throw an exception
        self.assertIn("nonexistent-file", self.pm._priorities)

    def test_update_memory_file_persistence_after_update(self):
        """Multiple updates to priority are correctly persisted"""
        memory_file = self.storage_path / "test.json"
        initial_data = {"id": "test"}
        with open(memory_file, "w", encoding="utf-8") as f:
            json.dump(initial_data, f)

        self.pm.set_priority("test", PriorityLevel.LOW)
        self.assertEqual(json.loads(memory_file.read_text())["priority"], "low")

        self.pm.set_priority("test", PriorityLevel.HIGH)
        self.assertEqual(json.loads(memory_file.read_text())["priority"], "high")


if __name__ == "__main__":
    unittest.main()
