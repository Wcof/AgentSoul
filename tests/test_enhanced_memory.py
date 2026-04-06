"""
Unit tests for enhanced memory module - tags
"""

import tempfile
from pathlib import Path
from datetime import datetime
from src.memory_enhanced.tags import TagManager, TagInfo


class TestEnhancedMemoryTags:
    """Tests for tag management system"""

    def test_tag_manager_creation(self):
        """Test creating tag manager with temporary storage"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            assert manager is not None
            assert manager.storage_path == Path(tmpdir)
            assert len(manager.list_all_tags()) == 0

    def test_add_tags_single(self):
        """Test adding a single tag"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("memory-1", ["test"])
            tags = manager.get_tags("memory-1")
            assert len(tags) == 1
            assert "test" in tags
            all_tags = manager.list_all_tags()
            assert len(all_tags) == 1
            assert all_tags[0].name == "test"
            assert all_tags[0].count == 1

    def test_add_tags_multiple(self):
        """Test adding multiple tags"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("memory-1", ["tag1", "tag2", "tag3"])
            tags = sorted(manager.get_tags("memory-1"))
            assert len(tags) == 3
            assert tags == ["tag1", "tag2", "tag3"]
            all_tags = manager.list_all_tags()
            assert len(all_tags) == 3

    def test_add_tags_duplicate(self):
        """Test adding duplicate tags doesn't increment count multiple times"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("memory-1", ["test"])
            manager.add_tags("memory-1", ["test"])
            tags = manager.get_tags("memory-1")
            assert len(tags) == 1
            all_tags = manager.list_all_tags()
            assert len(all_tags) == 1
            # Should still count as 1 occurrence per memory
            assert all_tags[0].count == 1

    def test_remove_tags(self):
        """Test removing tags"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("memory-1", ["keep", "remove"])
            manager.remove_tags("memory-1", ["remove"])
            tags = manager.get_tags("memory-1")
            assert len(tags) == 1
            assert "keep" in tags
            assert "remove" not in tags
            all_tags = manager.list_all_tags()
            # count should be 0 so it should be gone
            assert len(all_tags) == 1
            assert all_tags[0].name == "keep"

    def test_remove_all_tags_removes_memory(self):
        """Test that removing all tags removes memory from index"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("memory-1", ["tag1", "tag2"])
            manager.remove_tags("memory-1", ["tag1", "tag2"])
            tags = manager.get_tags("memory-1")
            assert len(tags) == 0

    def test_list_all_tags_sorted_by_count(self):
        """Test that tags are sorted by count descending"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("mem1", ["low"])
            manager.add_tags("mem1", ["medium"])
            manager.add_tags("mem2", ["medium"])
            manager.add_tags("mem1", ["high"])
            manager.add_tags("mem2", ["high"])
            manager.add_tags("mem3", ["high"])
            all_tags = manager.list_all_tags()
            assert len(all_tags) == 3
            assert all_tags[0].name == "high"
            assert all_tags[0].count == 3
            assert all_tags[1].name == "medium"
            assert all_tags[1].count == 2
            assert all_tags[2].name == "low"
            assert all_tags[2].count == 1

    def test_list_all_tags_filters_min_count(self):
        """Test min_count filtering works"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("mem1", ["low"])
            manager.add_tags("mem1", ["medium"])
            manager.add_tags("mem2", ["medium"])
            manager.add_tags("mem1", ["high"])
            manager.add_tags("mem2", ["high"])
            manager.add_tags("mem3", ["high"])
            all_tags = manager.list_all_tags(min_count=2)
            assert len(all_tags) == 2
            names = [t.name for t in all_tags]
            assert "high" in names
            assert "medium" in names
            assert "low" not in names

    def test_suggest_tags_based_on_content(self):
        """Test tag suggestion works based on content words"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("mem1", ["python", "testing"])
            manager.add_tags("mem2", ["python", "development"])
            manager.add_tags("mem3", ["ai", "testing"])
            # Content contains "python" and "test" should suggest python and testing
            suggestions = manager.suggest_tags("this is a python testing example", limit=3)
            # Should at least suggest python and testing
            assert "python" in suggestions
            assert "testing" in suggestions

    def test_suggest_tags_limit(self):
        """Test suggestion limit works"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            for i in range(10):
                manager.add_tags(f"mem{i}", [f"tag{i}"])
            suggestions = manager.suggest_tags("tag", limit=5)
            assert len(suggestions) <= 5

    def test_persistence_save_load(self):
        """Test that tags are persisted to file and loaded back"""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Add tags
            manager1 = TagManager(storage_path=Path(tmpdir))
            manager1.add_tags("memory-1", ["test", "sample"])
            manager1.add_tags("memory-2", ["test"])

            # Create new manager to reload
            manager2 = TagManager(storage_path=Path(tmpdir))
            tags1 = manager2.get_tags("memory-1")
            tags2 = manager2.get_tags("memory-2")
            assert len(tags1) == 2
            assert len(tags2) == 1
            assert "test" in tags1
            assert "sample" in tags1
            assert "test" in tags2

            all_tags = manager2.list_all_tags()
            assert len(all_tags) == 2
            tag_test = next(t for t in all_tags if t.name == "test")
            assert tag_test.count == 2

    def test_invalidate_cache(self):
        """Test cache invalidation"""
        with tempfile.TemporaryDirectory() as tmpdir:
            manager = TagManager(storage_path=Path(tmpdir))
            manager.add_tags("memory-1", ["test"])
            assert len(manager.list_all_tags()) == 1
            manager.invalidate_cache()
            # After invalidation, it should still work because it reloads from disk
            assert len(manager.list_all_tags()) == 1
            assert "test" in [t.name for t in manager.list_all_tags()]

    def test_corrupted_index_handled_gracefully(self):
        """Test that corrupted index file is handled gracefully"""
        with tempfile.TemporaryDirectory() as tmpdir:
            # Create corrupted json
            index_path = Path(tmpdir) / "tags_index.json"
            with open(index_path, "w") as f:
                f.write("this is not valid json {{{")

            manager = TagManager(storage_path=Path(tmpdir))
            # Should not crash, just start empty
            assert len(manager.list_all_tags()) == 0
