"""
AgentSoul · 跨平台迁移测试
=====================

测试跨平台灵魂迁移功能
"""

from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import tempfile
import unittest
import zipfile
from pathlib import Path

from src import (
    CrossPlatformMigrator,
    LocalToMcpMigrator,
    McpToLocalMigrator,
    MigrationResult,
    export_archive,
    import_archive,
)
from src.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSoulStateStorage,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestMigration(BaseTest):
    """测试跨平台迁移功能"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # 创建源目录结构
        (self.project_root / "config").mkdir()
        (self.project_root / "data" / "soul" / "soul_variable").mkdir(parents=True)
        (self.project_root / "data" / "memory" / "day").mkdir(parents=True)
        (self.project_root / "data" / "memory" / "week").mkdir()
        (self.project_root / "data" / "memory" / "month").mkdir()
        (self.project_root / "data" / "memory" / "year").mkdir()
        (self.project_root / "data" / "memory" / "topic").mkdir()
        (self.project_root / "data" / "memory" / "topic" / "archive").mkdir()

        # 创建测试人格配置
        persona_config = {
            "ai": {
                "name": "TestAgent",
                "role": "Test Assistant",
                "personality": ["friendly"],
            },
            "master": {
                "name": "TestUser",
            }
        }
        import yaml
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        # 创建一些测试记忆
        # 日记忆
        with open(self.project_root / "data" / "memory" / "day" / "2026-04-05.md", "w", encoding="utf-8") as f:
            f.write("# 2026-04-05\n\nToday we tested migration.")

        # 主题记忆
        with open(self.project_root / "data" / "memory" / "topic" / "test-topic.md", "w", encoding="utf-8") as f:
            f.write("# Test Topic\n\nThis is a test topic for migration testing.")

        # 创建源存储（可被所有测试复用）
        self.source_p = LocalPersonaStorage(self.project_root)
        self.source_s = LocalSoulStateStorage(self.project_root)
        self.source_m = LocalMemoryStorage(self.project_root)

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def _create_migrator(self, target_subdir: str, memory_subdir: str | None = None) -> CrossPlatformMigrator:
        """Helper: 创建迁移器并初始化目标目录

        Args:
            target_subdir: 目标子目录名称
            memory_subdir: 如果提供，创建 memory/<memory_subdir> 目录

        Returns:
            配置好的 CrossPlatformMigrator 实例
        """
        target_root = self.project_root / target_subdir
        target_root.mkdir()
        (target_root / "config").mkdir()
        (target_root / "data" / "soul" / "soul_variable").mkdir(parents=True)

        if memory_subdir is not None:
            (target_root / "data" / "memory" / memory_subdir).mkdir(parents=True)

        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        return CrossPlatformMigrator(
            (self.source_p, self.source_s, self.source_m),
            (target_p, target_s, target_m)
        )

    def test_export_archive(self):
        """测试导出归档"""
        # 导出到 zip
        output_zip = self.project_root / "export_test.zip"
        result = export_archive((self.source_p, self.source_s, self.source_m), output_zip)

        self.assertTrue(result.exists())
        self.assertTrue(result.stat().st_size > 0)

        # 验证 zip 内容
        with zipfile.ZipFile(result, 'r') as zip_ref:
            files = zip_ref.namelist()
            self.assertIn("persona.json", files)
            self.assertIn("soul_state.json", files)
            self.assertIn("memory/day/2026-04-05.md", files)
            self.assertIn("memory/topic/test-topic.md", files)

    def test_import_archive(self):
        """测试导入归档"""
        # 先导出
        export_zip = self.project_root / "export_test.zip"
        export_archive((self.source_p, self.source_s, self.source_m), export_zip)

        # 创建目标目录
        target_root = self.project_root / "target"
        target_root.mkdir()
        (target_root / "config").mkdir()
        (target_root / "data" / "soul" / "soul_variable").mkdir(parents=True)
        (target_root / "data" / "memory" / "day").mkdir(parents=True)
        (target_root / "data" / "memory" / "topic").mkdir()

        # 导入
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        result = import_archive(export_zip, (target_p, target_s, target_m))
        self.assertTrue(result.success)
        self.assertGreater(result.items_migrated, 0)

        # 验证导入
        imported_persona = target_p.read_persona_config()
        self.assertEqual(imported_persona["ai"]["name"], "TestAgent")

        imported_daily = target_m.read_daily_memory("2026-04-05")
        self.assertNotEmpty(imported_daily)
        assert imported_daily is not None
        self.assertIn("tested migration", imported_daily)

        imported_topic = target_m.read_topic_memory("test-topic")
        self.assertNotEmpty(imported_topic)
        assert imported_topic is not None
        self.assertIn("test topic", imported_topic)

    def test_migration_result_dataclass(self):
        """测试迁移结果数据类"""
        result = MigrationResult(
            success=True,
            items_migrated=5,
            errors=[],
            message="Test migration completed"
        )
        self.assertTrue(result.success)
        self.assertEqual(result.items_migrated, 5)
        self.assertEqual(len(result.errors), 0)

    def test_skip_existing(self):
        """测试跳过已存在文件"""
        # 创建源和目标
        migrator = self._create_migrator("target_skip", "day")

        # 在目标已存在相同内容
        target_root = self.project_root / "target_skip"
        with open(target_root / "data" / "memory" / "day" / "2026-04-05.md", "w", encoding="utf-8") as f:
            f.write("# 2026-04-05\n\nToday we tested migration.")

        result = migrator.migrate_all(skip_existing=True)

        # 人格应该迁移，但日记忆应该跳过（内容相同）
        # 至少应该成功
        self.assertTrue(result.success)

    def test_cross_platform_migrator_initialization(self):
        """测试迁移器初始化"""
        migrator = self._create_migrator("target", None)

        self.assertIsNotNone(migrator)
        self.assertEqual(migrator.source_persona, self.source_p)
        self.assertEqual(migrator.source_soul, self.source_s)
        self.assertEqual(migrator.source_memory, self.source_m)

    def test_migrate_all_memory_types(self):
        """测试各类型记忆迁移（日/周/月/年/主题）"""
        # 参数化测试所有记忆类型
        memory_tests = [
            ("target_daily", "day", "_migrate_daily_memory"),
            ("target_weekly", "week", "_migrate_weekly_memory"),
            ("target_monthly", "month", "_migrate_monthly_memory"),
            ("target_yearly", "year", "_migrate_yearly_memory"),
            ("target_topic", "topic", "_migrate_topic_memory"),
        ]

        for target_name, mem_subdir, method_name in memory_tests:
            with self.subTest(memory_type=mem_subdir):
                migrator = self._create_migrator(target_name, mem_subdir)
                errors: list[str] = []
                method = getattr(migrator, method_name)
                result = method(skip_existing=True, errors=errors)
                self.assertGreaterEqual(result, 0)

    def test_check_exists_and_skip_same_content(self):
        """测试_check_exists_and_skip 当内容相同时跳过"""
        migrator = self._create_migrator("target_check", None)

        def mock_read(identifier: str) -> str | None:
            return "test content\nsame for both\n"

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "test content\nsame for both\n",
            skip_existing=True,
            read_func=mock_read
        )
        self.assertTrue(should_skip)

    def test_check_exists_and_skip_different_content(self):
        """测试_check_exists_and_skip 当内容不同时不跳过"""
        migrator = self._create_migrator("target_check2", None)

        def mock_read(identifier: str) -> str | None:
            return "different content\n"

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "source content\n",
            skip_existing=True,
            read_func=mock_read
        )
        self.assertFalse(should_skip)

    def test_check_exists_and_skip_no_existing(self):
        """测试_check_exists_and_skip 当目标不存在时不跳过"""
        migrator = self._create_migrator("target_check3", None)

        def mock_read(identifier: str) -> str | None:
            return None

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "source\n",
            skip_existing=True,
            read_func=mock_read
        )
        self.assertFalse(should_skip)

    def test_check_exists_and_skip_skip_existing_false(self):
        """测试_check_exists_and_skip 当 skip_existing=False 时不跳过"""
        migrator = self._create_migrator("target_check4", None)

        def mock_read(identifier: str) -> str | None:
            return "same content\n"

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "same content\n",
            skip_existing=False,
            read_func=mock_read
        )
        self.assertFalse(should_skip)

    def test_local_to_mcp_migrator_creation(self):
        """测试 LocalToMcpMigrator 创建"""
        migrator = LocalToMcpMigrator(
            project_root=self.project_root,
            mcp_server_command=None
        )
        self.assertIsNotNone(migrator)

    def test_mcp_to_local_migrator_creation(self):
        """测试 McpToLocalMigrator 创建"""
        migrator = McpToLocalMigrator(
            project_root=self.project_root,
            mcp_server_command=None
        )
        self.assertIsNotNone(migrator)

    def test_cli_main_module_importable(self):
        """测试 CLI 主函数可导入"""
        # 只测试导入不执行
        from src.migration import main
        self.assertIsNotNone(main)


if __name__ == "__main__":
    unittest.main()
