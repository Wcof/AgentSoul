#!/usr/bin/env python3
"""
Unit tests for path_compat.py
路径兼容性模块单元测试
"""
import tempfile
import os
from pathlib import Path
import pytest

from src.path_compat import PathMapping, ResolveResult, PathResolver, resolve_path, convert_legacy_path, is_legacy_path


class TestPathCompat:
    """测试路径兼容性解析"""

    def test_default_mappings_sorted_by_priority(self):
        """测试默认映射按优先级排序"""
        resolver = PathResolver()
        priorities = [m.priority for m in resolver.mappings]
        assert priorities == sorted(priorities, reverse=True)

    def test_custom_mappings_sorted(self):
        """测试自定义映射会按优先级排序"""
        mappings = [
            PathMapping("a/", "x/", 10),
            PathMapping("b/", "y/", 50),
            PathMapping("c/", "z/", 30),
        ]
        resolver = PathResolver(mappings=mappings)
        priorities = [m.priority for m in resolver.mappings]
        assert priorities == [50, 30, 10]

    def test_apply_mapping_no_match(self):
        """测试没有匹配映射时返回原路径"""
        resolver = PathResolver()
        path = "normal/path/file.md"
        new_path, mapping = resolver._apply_mapping(path)
        assert new_path == path
        assert mapping.priority == -1

    def test_apply_mapping_match(self):
        """测试匹配到映射时正确转换"""
        resolver = PathResolver()
        path = "/xiaonuan/data/file.md"
        new_path, mapping = resolver._apply_mapping(path)
        assert new_path == "/agent/data/file.md"
        assert mapping.priority == 100

    def test_resolve_no_mapping_no_check_existence(self):
        """测试无映射，不检查存在性"""
        resolver = PathResolver()
        result = resolver.resolve("src/file.py", check_existence=False)
        assert result.found is True
        assert result.is_legacy is False
        assert result.fallback_used is False

    def test_resolve_legacy_path_fallback_to_old(self):
        """测试新路径不存在时回退到旧路径"""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            # Create legacy directory structure
            legacy_dir = project_root / "xiaonuan" / "data"
            legacy_dir.mkdir(parents=True)
            legacy_file = legacy_dir / "test.md"
            legacy_file.write_text("# Test")

            resolver = PathResolver(project_root=project_root)
            result = resolver.resolve("/xiaonuan/data/test.md")

            assert result.found is True
            assert result.is_legacy is True
            assert result.fallback_used is True
            assert result.resolved_path == legacy_file

    def test_resolve_new_path_exists(self):
        """测试新路径存在时直接使用新路径"""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            # Create new directory structure
            new_dir = project_root / "agent" / "data"
            new_dir.mkdir(parents=True)
            new_file = new_dir / "test.md"
            new_file.write_text("# Test")
            # Also create legacy to ensure priority is correct
            legacy_dir = project_root / "xiaonuan" / "data"
            legacy_dir.mkdir(parents=True)

            resolver = PathResolver(project_root=project_root)
            result = resolver.resolve("/xiaonuan/data/test.md")

            assert result.found is True
            assert result.is_legacy is False
            assert result.fallback_used is False
            assert result.resolved_path == new_file

    def test_resolve_both_paths_not_exist(self):
        """测试新旧路径都不存在时返回 found=False"""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            resolver = PathResolver(project_root=project_root)
            result = resolver.resolve("/xiaonuan/data/nonexistent.md")

            assert result.found is False

    def test_resolve_caching(self):
        """测试结果缓存"""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            new_dir = project_root / "agent" / "data"
            new_dir.mkdir(parents=True)
            new_file = new_dir / "test.md"
            new_file.write_text("# Test")

            resolver = PathResolver(project_root=project_root)
            # First call - caches result
            result1 = resolver.resolve("/xiaonuan/data/test.md")
            # Second call - should hit cache
            result2 = resolver.resolve("/xiaonuan/data/test.md")

            assert result1 is result2
            assert result1.found == result2.found

    def test_clear_cache(self):
        """测试清除缓存"""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            new_dir = project_root / "agent" / "data"
            new_dir.mkdir(parents=True)
            new_file = new_dir / "test.md"
            new_file.write_text("# Test")

            resolver = PathResolver(project_root=project_root)
            result1 = resolver.resolve("/xiaonuan/data/test.md")
            assert len(resolver._cache) == 1

            resolver.clear_cache()
            assert len(resolver._cache) == 0

    def test_resolve_many(self):
        """测试批量解析"""
        resolver = PathResolver()
        results = resolver.resolve_many(["/xiaonuan/file1.md", "/agent/file2.md"])
        assert list(results.keys()) == ["/xiaonuan/file1.md", "/agent/file2.md"]
        assert all(isinstance(v, ResolveResult) for v in results.values())

    def test_negative_result_not_cached(self):
        """测试未找到的结果不缓存，因为文件可能后来被创建"""
        with tempfile.TemporaryDirectory() as tmpdir:
            project_root = Path(tmpdir)
            resolver = PathResolver(project_root=project_root)
            result1 = resolver.resolve("/xiaonuan/data/nonexistent.md")
            assert len(resolver._cache) == 0  # Not cached

    def test_convert_legacy_path(self):
        """测试转换旧路径为新路径"""
        result = convert_legacy_path("/xiaonuan/data/file.md")
        assert result == "/agent/data/file.md"

    def test_convert_non_legacy_unchanged(self):
        """测试非旧路径保持不变"""
        result = convert_legacy_path("/agent/data/file.md")
        assert result == "/agent/data/file.md"

    def test_is_legacy_path_true(self):
        """测试识别旧路径返回 True"""
        assert is_legacy_path("/xiaonuan/data/file.md") is True
        assert is_legacy_path("xiaonuan/config/persona.yaml") is True

    def test_is_legacy_path_false(self):
        """测试识别非旧路径返回 False"""
        assert is_legacy_path("/agent/data/file.md") is False
        assert is_legacy_path("normal/path.md") is False

    def test_resolve_path_top_level_function(self):
        """测试顶层 resolve_path 函数正常工作"""
        result = resolve_path("/agent/data/file.md", check_existence=False)
        assert isinstance(result, ResolveResult)
        assert result.found is True

    def test_backslash_path_conversion(self):
        """测试 Windows 反斜杠路径正确转换为斜杠"""
        resolver = PathResolver()
        result = resolver.resolve("\\xiaonuan\\data\\file.md", check_existence=False)
        assert result.source_path == "/agent/data/file.md"
        assert result.is_legacy is True  # Still a legacy path after conversion

    def test_relative_legacy_path_mapping(self):
        """测试相对路径旧格式映射"""
        resolver = PathResolver()
        result = resolver.resolve("xiaonuan/data/file.md", check_existence=False)
        assert result.source_path == "agent/data/file.md"
        assert result.is_legacy is True

    def test_custom_project_root(self):
        """测试自定义项目根目录"""
        with tempfile.TemporaryDirectory() as tmpdir:
            custom_root = Path(tmpdir) / "custom"
            custom_root.mkdir()
            resolver = PathResolver(project_root=custom_root)
            assert resolver.project_root == custom_root

    def test_main_function_output(self):
        """测试 main 函数输出不报错"""
        # 只要能运行不抛出异常就算通过
        import sys
        from io import StringIO
        original_stdout = sys.stdout
        captured_output = StringIO()
        sys.stdout = captured_output

        # main 不存在，但 __name__ == "__main__" 块在导入时不会执行
        # 我们直接复制代码来运行
        from src.path_compat import PathResolver
        resolver = PathResolver()

        test_paths = [
            "/xiaonuan/data/memory_bank/memory_day/2024-01-01.md",
            "/xiaonuan/master/master_basic/profile.md",
            "/agent/data/memory_bank/memory_day/2024-01-01.md",
            "xiaonuan/config/persona.yaml",
            "memory_bank/memory_day/2024-01-01.md",
        ]

        # 运行不应该抛出异常
        for path in test_paths:
            result = resolver.resolve(path)
            _ = result.found

        sys.stdout = original_stdout
        # 如果到达这里，测试通过
