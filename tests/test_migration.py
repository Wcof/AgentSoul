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

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_export_archive(self):
        """测试导出归档"""
        # 创建源存储
        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)

        # 导出到 zip
        output_zip = self.project_root / "export_test.zip"
        result = export_archive((source_p, source_s, source_m), output_zip)

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
        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)
        export_zip = self.project_root / "export_test.zip"
        export_archive((source_p, source_s, source_m), export_zip)

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
        source_root = self.project_root
        target_root = self.project_root / "target_skip"
        target_root.mkdir()
        (target_root / "config").mkdir()
        (target_root / "data" / "soul" / "soul_variable").mkdir(parents=True)
        (target_root / "data" / "memory" / "day").mkdir(parents=True)

        # 在目标已存在相同内容
        with open(target_root / "data" / "memory" / "day" / "2026-04-05.md", "w", encoding="utf-8") as f:
            f.write("# 2026-04-05\n\nToday we tested migration.")

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all(skip_existing=True)

        # 人格应该迁移，但日记忆应该跳过（内容相同）
        # 至少应该成功
        self.assertTrue(result.success)

    def test_cross_platform_migrator_initialization(self):
        """测试迁移器初始化"""
        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)
        target_p = LocalPersonaStorage(self.project_root / "target")
        target_s = LocalSoulStateStorage(self.project_root / "target")
        target_m = LocalMemoryStorage(self.project_root / "target")

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        self.assertIsNotNone(migrator)
        self.assertEqual(migrator.source_persona, source_p)
        self.assertEqual(migrator.source_soul, source_s)
        self.assertEqual(migrator.source_memory, source_m)

    def test_migrate_daily_memory(self):
        """测试迁移日记忆"""
        source_root = self.project_root
        target_root = self.project_root / "target_daily"
        target_root.mkdir()
        (target_root / "data" / "memory" / "day").mkdir(parents=True)

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        # 内部方法测试 - 迁移已存在的测试数据
        errors: list[str] = []
        result = migrator._migrate_daily_memory(skip_existing=True, errors=errors)
        # 至少应该完成而不崩溃
        self.assertGreaterEqual(result, 0)

    def test_migrate_weekly_memory(self):
        """测试迁移周记忆"""
        source_root = self.project_root
        target_root = self.project_root / "target_weekly"
        target_root.mkdir()
        (target_root / "data" / "memory" / "week").mkdir(parents=True)

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        errors: list[str] = []
        result = migrator._migrate_weekly_memory(skip_existing=True, errors=errors)
        self.assertGreaterEqual(result, 0)

    def test_migrate_monthly_memory(self):
        """测试迁移月记忆"""
        source_root = self.project_root
        target_root = self.project_root / "target_monthly"
        target_root.mkdir()
        (target_root / "data" / "memory" / "month").mkdir(parents=True)

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        errors: list[str] = []
        result = migrator._migrate_monthly_memory(skip_existing=True, errors=errors)
        self.assertGreaterEqual(result, 0)

    def test_migrate_yearly_memory(self):
        """测试迁移年记忆"""
        source_root = self.project_root
        target_root = self.project_root / "target_yearly"
        target_root.mkdir()
        (target_root / "data" / "memory" / "year").mkdir(parents=True)

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        errors: list[str] = []
        result = migrator._migrate_yearly_memory(skip_existing=True, errors=errors)
        self.assertGreaterEqual(result, 0)

    def test_migrate_topic_memory(self):
        """测试迁移主题记忆（包括可能已归档的）"""
        source_root = self.project_root
        target_root = self.project_root / "target_topic"
        target_root.mkdir()
        (target_root / "data" / "memory" / "topic").mkdir(parents=True)

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        errors: list[str] = []
        result = migrator._migrate_topic_memory(skip_existing=True, errors=errors)
        self.assertGreaterEqual(result, 0)

    def test_check_exists_and_skip_same_content(self):
        """测试_check_exists_and_skip 当内容相同时跳过"""
        source_root = self.project_root
        target_root = self.project_root / "target_check"
        target_root.mkdir()

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        # 创建一个模拟读取函数返回相同内容
        def mock_read(identifier: str) -> str | None:
            return "test content\nsame for both\n"

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "test content\nsame for both\n",
            skip_existing=True,
            read_func=mock_read
        )
        # 内容相同应该跳过
        self.assertTrue(should_skip)

    def test_check_exists_and_skip_different_content(self):
        """测试_check_exists_and_skip 当内容不同时不跳过"""
        source_root = self.project_root
        target_root = self.project_root / "target_check2"
        target_root.mkdir()

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        # 模拟读取函数返回不同内容
        def mock_read(identifier: str) -> str | None:
            return "different content\n"

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "source content\n",
            skip_existing=True,
            read_func=mock_read
        )
        # 内容不同不应该跳过
        self.assertFalse(should_skip)

    def test_check_exists_and_skip_no_existing(self):
        """测试_check_exists_and_skip 当目标不存在时不跳过"""
        source_root = self.project_root
        target_root = self.project_root / "target_check3"
        target_root.mkdir()

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        # 模拟读取函数返回 None（不存在）
        def mock_read(identifier: str) -> str | None:
            return None

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "source\n",
            skip_existing=True,
            read_func=mock_read
        )
        # 目标不存在不应该跳过
        self.assertFalse(should_skip)

    def test_check_exists_and_skip_skip_existing_false(self):
        """测试_check_exists_and_skip 当 skip_existing=False 时不跳过"""
        source_root = self.project_root
        target_root = self.project_root / "target_check4"
        target_root.mkdir()

        source_p = LocalPersonaStorage(source_root)
        source_s = LocalSoulStateStorage(source_root)
        source_m = LocalMemoryStorage(source_root)
        target_p = LocalPersonaStorage(target_root)
        target_s = LocalSoulStateStorage(target_root)
        target_m = LocalMemoryStorage(target_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )

        def mock_read(identifier: str) -> str | None:
            return "same content\n"

        should_skip = migrator._check_exists_and_skip(
            "test-id",
            "same content\n",
            skip_existing=False,
            read_func=mock_read
        )
        # skip_existing=False 不跳过
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
