"""
AgentSoul · 增强记忆模块测试
=============================

测试 src/memory_enhanced/ 三个核心模块：
- priority.py - 记忆优先级管理
- tags.py - 记忆标签系统
- retrieval.py - 智能检索模块
"""
from __future__ import annotations

import os
import sys
import tempfile
import unittest
from datetime import datetime, timedelta
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.memory_enhanced.priority import (
    PriorityLevel,
    MemoryPriority,
    PriorityManager,
)
from src.memory_enhanced.tags import (
    TagInfo,
    TagManager,
)
from src.memory_enhanced.retrieval import (
    SearchResult,
    MemoryRetriever,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestPriorityLevel(BaseTest):
    """测试 PriorityLevel 枚举"""

    def test_enum_values(self):
        """测试枚举值"""
        self.assertEqual(PriorityLevel.HIGH.value, "high")
        self.assertEqual(PriorityLevel.MEDIUM.value, "medium")
        self.assertEqual(PriorityLevel.LOW.value, "low")


class TestMemoryPriority(BaseTest):
    """测试 MemoryPriority dataclass"""

    def test_creation(self):
        """测试创建优先级记录"""
        dt = datetime.now()
        mp = MemoryPriority(
            memory_id="mem-123",
            level=PriorityLevel.HIGH,
            access_count=5,
            last_accessed=dt,
            manual_override=True
        )
        self.assertEqual(mp.memory_id, "mem-123")
        self.assertEqual(mp.level, PriorityLevel.HIGH)
        self.assertEqual(mp.access_count, 5)
        self.assertEqual(mp.last_accessed, dt)
        self.assertTrue(mp.manual_override)

    def test_creation_default_override(self):
        """测试创建优先级记录默认 manual_override 为 False"""
        dt = datetime.now()
        mp = MemoryPriority(
            memory_id="mem-123",
            level=PriorityLevel.MEDIUM,
            access_count=0,
            last_accessed=dt
        )
        self.assertFalse(mp.manual_override)


class TestPriorityManager(BaseTest):
    """测试 PriorityManager"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.manager = PriorityManager(storage_path=self.data_dir)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_init_creates_directory(self):
        """测试初始化创建目录"""
        self.assertTrue(self.data_dir.exists())

    def test_set_and_get_priority(self):
        """测试设置和获取优先级"""
        self.manager.set_priority("mem-1", PriorityLevel.HIGH)
        level = self.manager.get_priority("mem-1")
        self.assertEqual(level, PriorityLevel.HIGH)

    def test_get_priority_default_medium(self):
        """测试未设置优先级默认为 MEDIUM"""
        level = self.manager.get_priority("nonexistent")
        self.assertEqual(level, PriorityLevel.MEDIUM)

    def test_record_access_increases_count(self):
        """测试记录访问增加计数"""
        self.manager.record_access("mem-1")
        self.manager.record_access("mem-1")
        priorities = self.manager.get_all_priorities()
        self.assertEqual(len(priorities), 1)
        self.assertEqual(priorities[0].access_count, 2)

    def test_record_access_auto_adjusts(self):
        """测试频繁访问自动提升优先级"""
        # Record 10 times access
        for _ in range(10):
            self.manager.record_access("mem-1")
        # Should be auto promoted to HIGH
        level = self.manager.get_priority("mem-1")
        self.assertEqual(level, PriorityLevel.HIGH)

    def test_record_access_old_inactive_lowers_priority(self):
        """测试长期不访问自动降低优先级"""
        # Create with HIGH priority
        self.manager.set_priority("mem-1", PriorityLevel.HIGH)
        # Modify last_accessed to 31 days ago by accessing it long time ago
        # We can't directly modify, but let's test the auto-adjust logic indirectly
        priority = self.manager._priorities["mem-1"]
        priority.last_accessed = datetime.now() - timedelta(days=35)
        priority.access_count = 2
        self.manager._auto_adjust_priority("mem-1")
        # Should drop to MEDIUM
        self.assertEqual(priority.level, PriorityLevel.MEDIUM)

    def test_get_high_priority_memories(self):
        """测试获取高优先级记忆"""
        self.manager.set_priority("mem-1", PriorityLevel.HIGH)
        self.manager.set_priority("mem-2", PriorityLevel.MEDIUM)
        self.manager.set_priority("mem-3", PriorityLevel.HIGH)

        high = self.manager.get_high_priority_memories()
        self.assertEqual(len(high), 2)
        self.assertIn("mem-1", high)
        self.assertIn("mem-3", high)
        self.assertNotIn("mem-2", high)

    def test_get_high_priority_respects_limit(self):
        """测试获取高优先级记忆遵守限制"""
        for i in range(10):
            self.manager.set_priority(f"mem-{i}", PriorityLevel.HIGH)

        high = self.manager.get_high_priority_memories(limit=5)
        self.assertEqual(len(high), 5)

    def test_get_all_priorities_sorted(self):
        """测试获取所有优先级按优先级排序"""
        self.manager.set_priority("mem-low", PriorityLevel.LOW)
        self.manager.set_priority("mem-high", PriorityLevel.HIGH)
        self.manager.set_priority("mem-medium", PriorityLevel.MEDIUM)

        all_priorities = self.manager.get_all_priorities()
        # Should be sorted: HIGH first, then MEDIUM, then LOW
        self.assertEqual(all_priorities[0].memory_id, "mem-high")
        self.assertEqual(all_priorities[1].memory_id, "mem-medium")
        self.assertEqual(all_priorities[2].memory_id, "mem-low")

    def test_reset_priority(self):
        """测试重置优先级到默认 MEDIUM"""
        self.manager.set_priority("mem-1", PriorityLevel.HIGH)
        self.manager.reset_priority("mem-1")
        level = self.manager.get_priority("mem-1")
        self.assertEqual(level, PriorityLevel.MEDIUM)
        # Should also clear manual override
        priority = self.manager._priorities["mem-1"]
        self.assertFalse(priority.manual_override)

    def test_invalidate_cache_clears_priorities(self):
        """测试清除缓存清空优先级"""
        self.manager.set_priority("mem-1", PriorityLevel.HIGH)
        self.assertNotEmpty(self.manager._priorities)
        self.manager.invalidate_cache()
        self.assertEqual(len(self.manager._priorities), 0)

    def test_load_corrupted_index_uses_empty(self):
        """测试加载损坏索引用空"""
        self.manager.priority_index_file.write_text("not valid json")

        with patch('src.memory_enhanced.priority.log') as mock_log:
            manager = PriorityManager(storage_path=self.data_dir)
            self.assertEqual(len(manager._priorities), 0)
            self.assertTrue(any("Failed to load priority index" in str(call) for call in mock_log.call_args_list))

    def test_update_memory_file_priority_creates_field(self):
        """测试更新记忆文件优先级写入字段"""
        # Create a memory file
        mem_file = self.data_dir / "mem-1.json"
        mem_file.write_text('{"content": "test"}')

        self.manager.set_priority("mem-1", PriorityLevel.HIGH)

        # Check that priority field was added
        import json
        data = json.loads(mem_file.read_text())
        self.assertEqual(data["priority"], "high")


class TestTagInfo(BaseTest):
    """测试 TagInfo dataclass"""

    def test_creation(self):
        """测试创建标签信息"""
        dt = datetime.now()
        tag = TagInfo(name="testing", count=5, last_used=dt)
        self.assertEqual(tag.name, "testing")
        self.assertEqual(tag.count, 5)
        self.assertEqual(tag.last_used, dt)


class TestTagManager(BaseTest):
    """测试 TagManager"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.manager = TagManager(storage_path=self.data_dir)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_init_creates_directory(self):
        """测试初始化创建目录"""
        self.assertTrue(self.data_dir.exists())

    def test_add_tags_single(self):
        """测试添加单个标签"""
        self.manager.add_tags("mem-1", ["testing"])
        tags = self.manager.get_tags("mem-1")
        self.assertEqual(tags, ["testing"])

    def test_add_tags_multiple(self):
        """测试添加多个标签"""
        self.manager.add_tags("mem-1", ["tag1", "tag2", "tag3"])
        tags = self.manager.get_tags("mem-1")
        self.assertEqual(len(tags), 3)

    def test_add_tags_normalizes_case(self):
        """测试添加标签规范化大小写"""
        self.manager.add_tags("mem-1", ["TestCase", "  TEST  "])
        tags = self.manager.get_tags("mem-1")
        self.assertIn("testcase", tags)
        self.assertIn("test", tags)

    def test_add_tags_skips_duplicates(self):
        """测试添加标签跳过重复"""
        self.manager.add_tags("mem-1", ["tag1"])
        self.manager.add_tags("mem-1", ["tag1"])
        tags = self.manager.get_tags("mem-1")
        self.assertEqual(len(tags), 1)

    def test_remove_tags(self):
        """测试移除标签"""
        self.manager.add_tags("mem-1", ["tag1", "tag2"])
        self.manager.remove_tags("mem-1", ["tag1"])
        tags = self.manager.get_tags("mem-1")
        self.assertEqual(tags, ["tag2"])

    def test_remove_tags_removes_memory_when_empty(self):
        """测试移除最后一个标签后删除记忆条目"""
        self.manager.add_tags("mem-1", ["tag1"])
        self.manager.remove_tags("mem-1", ["tag1"])
        tags = self.manager.get_tags("mem-1")
        self.assertEqual(len(tags), 0)
        self.assertNotIn("mem-1", self.manager._memory_tags)

    def test_get_tags_empty_when_none(self):
        """测试没有标签返回空列表"""
        tags = self.manager.get_tags("nonexistent")
        self.assertEqual(len(tags), 0)

    def test_list_all_tags_sorted_by_count(self):
        """测试列出所有标签按计数降序排序"""
        # Add tags with different counts
        self.manager.add_tags("mem-1", ["common", "rare"])
        self.manager.add_tags("mem-2", ["common", "medium"])
        self.manager.add_tags("mem-3", ["common", "medium"])
        self.manager.add_tags("mem-4", ["common"])

        tags = self.manager.list_all_tags()
        # common (4) > medium (2) > rare (1)
        self.assertEqual(len(tags), 3)
        self.assertEqual(tags[0].name, "common")
        self.assertEqual(tags[1].name, "medium")
        self.assertEqual(tags[2].name, "rare")

    def test_list_all_tags_filters_min_count(self):
        """测试列出所有标签过滤最小计数"""
        self.manager.add_tags("mem-1", ["common", "rare"])
        self.manager.add_tags("mem-2", ["common"])

        tags = self.manager.list_all_tags(min_count=2)
        self.assertEqual(len(tags), 1)
        self.assertEqual(tags[0].name, "common")

    def test_suggest_tags_finds_matches(self):
        """测试标签建议找到匹配"""
        self.manager.add_tags("mem-1", ["python", "testing"])
        self.manager.add_tags("mem-2", ["python", "coding"])

        suggestions = self.manager.suggest_tags("i love python coding")
        # Should suggest python and coding in that order
        self.assertEqual(len(suggestions), 2)
        self.assertEqual(suggestions[0], "python")
        self.assertEqual(suggestions[1], "coding")

    def test_suggest_tags_respects_limit(self):
        """测试标签建议遵守限制"""
        # Add 10 distinct tags all starting with tag
        for i in range(10):
            self.manager.add_tags("mem-1", [f"tag{i}"])

        # "tag" is in the content, but no tag is exactly "tag", so no full word matches
        # Because tagi is matched as a single word (no underscore), so no match
        # Let's add several full word tags that match
        self.manager.add_tags("mem-1", ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot"])

        suggestions = self.manager.suggest_tags("alpha bravo charlie delta echo foxtrot", limit=5)
        self.assertEqual(len(suggestions), 5)

    def test_invalidate_cache_clears_all(self):
        """测试清除缓存清空所有"""
        self.manager.add_tags("mem-1", ["tag1"])
        self.assertNotEmpty(self.manager._tags_cache)
        self.assertNotEmpty(self.manager._memory_tags)
        self.manager.invalidate_cache()
        self.assertEqual(len(self.manager._tags_cache), 0)
        self.assertEqual(len(self.manager._memory_tags), 0)

    def test_load_corrupted_index_uses_empty(self):
        """测试加载损坏索引用空"""
        self.manager.tags_index_file.write_text("not valid json")

        with patch('src.memory_enhanced.tags.log') as mock_log:
            manager = TagManager(storage_path=self.data_dir)
            self.assertEqual(len(manager._tags_cache), 0)
            self.assertTrue(any("Failed to load tags index" in str(call) for call in mock_log.call_args_list))

    def test_update_memory_file_tags_adds_field(self):
        """测试更新记忆文件标签写入字段"""
        mem_file = self.data_dir / "mem-1.json"
        mem_file.write_text('{"content": "test"}')

        self.manager.add_tags("mem-1", ["tag1", "tag2"])

        import json
        data = json.loads(mem_file.read_text())
        self.assertEqual(sorted(data["tags"]), ["tag1", "tag2"])


class TestSearchResult(BaseTest):
    """测试 SearchResult dataclass"""

    def test_creation(self):
        """测试创建搜索结果"""
        dt = datetime.now()
        result = SearchResult(
            memory_id="mem-1",
            content="test content",
            relevance=0.85,
            tags=["tag1"],
            last_accessed=dt,
            priority="high"
        )
        self.assertEqual(result.memory_id, "mem-1")
        self.assertEqual(result.content, "test content")
        self.assertEqual(result.relevance, 0.85)
        self.assertEqual(result.priority, "high")


class TestMemoryRetriever(BaseTest):
    """测试 MemoryRetriever"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp_dir.name)
        self.retriever = MemoryRetriever(storage_path=self.data_dir)

    def tearDown(self):
        """清理"""
        self.temp_dir.cleanup()

    def test_levenshtein_distance(self):
        """测试编辑距离计算"""
        dist = MemoryRetriever.levenshtein_distance("kitten", "sitting")
        # kitten → sitting: distance should be 3
        self.assertEqual(dist, 3)

        dist_empty = MemoryRetriever.levenshtein_distance("", "abc")
        self.assertEqual(dist_empty, 3)

        dist_same = MemoryRetriever.levenshtein_distance("abc", "abc")
        self.assertEqual(dist_same, 0)

    def test_fuzzy_match_score_exact_match(self):
        """测试精确匹配得分 1.0"""
        score = self.retriever.fuzzy_match_score("hello", "world hello world")
        self.assertEqual(score, 1.0)

    def test_fuzzy_match_score_no_match(self):
        """测试无匹配得分 0.0"""
        score = self.retriever.fuzzy_match_score("xyz", "abc def ghi")
        self.assertEqual(score, 0.0)

    def test_fuzzy_match_score_fuzzy_match_close_word(self):
        """测试模糊匹配相近单词给出一定得分"""
        # "abc" vs "abx" distance = 1 → 1/3 < 0.4 → should match
        score = self.retriever.fuzzy_match_score("abc", "the abx quick brown fox")
        self.assertGreater(score, 0)
        self.assertEqual(score, 1.0)  # One word query, one match found

    def test_invalidate_cache_clears_cache(self):
        """测试清除缓存"""
        # Create a memory file to load into cache
        (self.data_dir / "mem-1.json").write_text('{"content": "test"}')
        self.retriever._load_all_memories()
        self.assertIsNotNone(self.retriever._cache)
        self.assertEqual(len(self.retriever._cache), 1)

        self.retriever.invalidate_cache()
        self.assertIsNone(self.retriever._cache)

    def test_search_returns_exact_match(self):
        """测试搜索返回精确匹配"""
        (self.data_dir / "mem-1.json").write_text('{"content": "hello world", "priority": "high"}')
        (self.data_dir / "mem-2.json").write_text('{"content": "foo bar", "priority": "medium"}')

        results = self.retriever.search("hello")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].memory_id, "mem-1")
        self.assertEqual(results[0].relevance, 1.0)
        self.assertEqual(results[0].priority, "high")

    def test_search_empty_query_returns_all(self):
        """测试空查询返回所有匹配过滤条件的结果"""
        (self.data_dir / "mem-1.json").write_text('{"content": "one"}')
        (self.data_dir / "mem-2.json").write_text('{"content": "two"}')

        results = self.retriever.search("")
        self.assertEqual(len(results), 2)

    def test_search_filter_by_priority(self):
        """测试按优先级过滤"""
        (self.data_dir / "mem-1.json").write_text('{"content": "test", "priority": "high"}')
        (self.data_dir / "mem-2.json").write_text('{"content": "test", "priority": "low"}')

        results = self.retriever.search("test", priority="high")
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].memory_id, "mem-1")

    def test_search_filter_by_tags(self):
        """测试按标签过滤"""
        (self.data_dir / "mem-1.json").write_text('{"content": "test", "tags": ["python", "testing"]}')
        (self.data_dir / "mem-2.json").write_text('{"content": "test", "tags": ["javascript"]}')

        results = self.retriever.search("test", tags=["python"])
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].memory_id, "mem-1")

    def test_search_filter_by_date_range(self):
        """测试按日期范围过滤"""
        now = datetime.now()
        week_ago = (now - timedelta(days=7)).isoformat()
        two_weeks_ago = (now - timedelta(days=14)).isoformat()

        (self.data_dir / "mem-1.json").write_text(f'{{"content": "content recent", "last_accessed": "{week_ago}"}}')
        (self.data_dir / "mem-2.json").write_text(f'{{"content": "content old", "last_accessed": "{two_weeks_ago}"}}')

        # Search from 10 days ago to now
        start_date = now - timedelta(days=10)
        results = self.retriever.search("content", start_date=start_date)
        # Only mem-1 is within range (last_accessed >= 10d ago), should be found
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0].memory_id, "mem-1")

    def test_search_sorts_by_relevance_and_priority(self):
        """测试按相关度和优先级排序"""
        (self.data_dir / "mem-1.json").write_text('{"content": "hello there", "priority": "low"}')
        (self.data_dir / "mem-2.json").write_text('{"content": "hello world", "priority": "high"}')

        results = self.retriever.search("hello")
        # Both have relevance 1.0, high priority should come first
        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].memory_id, "mem-2")

    def test_search_skips_corrupted_files(self):
        """测试搜索跳过损坏文件"""
        (self.data_dir / "good.json").write_text('{"content": "good"}')
        (self.data_dir / "bad.json").write_text('not valid json')

        with patch('src.memory_enhanced.retrieval.log') as mock_log:
            results = self.retriever.search("")
            self.assertEqual(len(results), 1)
            self.assertEqual(results[0].memory_id, "good")
            self.assertTrue(any("Failed to load memory" in str(call) for call in mock_log.call_args_list))

    def test_search_respects_limit(self):
        """测试搜索遵守结果限制"""
        for i in range(10):
            (self.data_dir / f"mem-{i}.json").write_text('{"content": "test"}')

        results = self.retriever.search("", limit=5)
        self.assertEqual(len(results), 5)

    def test_load_all_memories_empty_dir(self):
        """测试加载空目录返回空列表"""
        results = self.retriever._load_all_memories()
        self.assertEqual(len(results), 0)


if __name__ == "__main__":
    unittest.main()
