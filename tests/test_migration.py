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

from agentsoul import (
    CrossPlatformMigrator,
    LocalToMcpMigrator,
    McpToLocalMigrator,
    MigrationResult,
    export_archive,
    import_archive,
)
from agentsoul.storage.local import (
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
        (self.project_root / "var" / "data" / "soul" / "soul_variable").mkdir(parents=True)
        (self.project_root / "var" / "data" / "memory" / "day").mkdir(parents=True)
        (self.project_root / "var" / "data" / "memory" / "week").mkdir()
        (self.project_root / "var" / "data" / "memory" / "month").mkdir()
        (self.project_root / "var" / "data" / "memory" / "year").mkdir()
        (self.project_root / "var" / "data" / "memory" / "topic").mkdir()
        (self.project_root / "var" / "data" / "memory" / "topic" / "archive").mkdir()

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
        with open(self.project_root / "var" / "data" / "memory" / "day" / "2026-04-05.md", "w", encoding="utf-8") as f:
            f.write("# 2026-04-05\n\nToday we tested migration.")

        # 主题记忆
        with open(self.project_root / "var" / "data" / "memory" / "topic" / "test-topic.md", "w", encoding="utf-8") as f:
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
        from agentsoul.migration import main
        self.assertIsNotNone(main)

    def test_migration_unexpected_exception_caught(self):
        """测试migrate_all捕获顶层异常"""
        from agentsoul.abstract import BaseMemoryStorage

        # Mock that only implements list_topics which raises
        class BadMemoryStorage(BaseMemoryStorage):
            def list_topics(self, status="active"):
                raise RuntimeError("This is an unexpected error")
            # Implement all other abstract methods
            def archive_topic(self, topic): pass
            def detect_conflict(self, topic): return False
            def read_daily_memory(self, i): return None
            def read_monthly_memory(self, i): return None
            def read_topic_memory(self, t): return None
            def read_weekly_memory(self, w): return None
            def read_yearly_memory(self, y): return None
            def resolve_conflict(self, t, s, strategy): return False
            def write_daily_memory(self, i, c): return True
            def write_monthly_memory(self, i, c): return True
            def write_topic_memory(self, t, c): return True
            def write_weekly_memory(self, w, c): return True
            def write_yearly_memory(self, y, c): return True

        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = BadMemoryStorage()

        target_p = LocalPersonaStorage(self.project_root / "target_err")
        target_s = LocalSoulStateStorage(self.project_root / "target_err")
        target_m = LocalMemoryStorage(self.project_root / "target_err")

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)
        self.assertIn("unexpected error", result.errors[0])

    def test_persona_write_failure_adds_error(self):
        """测试人格写入失败添加错误"""
        from agentsoul.abstract import BasePersonaStorage

        class FailWritePersona(BasePersonaStorage):
            def read_persona_config(self):
                return {"name": "Test"}
            def write_persona_config(self, config):
                return False
            def get_version(self): return "1.0"

        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)

        target_p = FailWritePersona()
        target_s = LocalSoulStateStorage(self.project_root)
        target_m = LocalMemoryStorage(self.project_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("Failed to migrate persona", result.errors[0])

    def test_soul_state_write_failure_adds_error(self):
        """测试灵魂状态写入失败添加错误"""
        from agentsoul.abstract import BaseSoulStateStorage

        class FailWriteSoul(BaseSoulStateStorage):
            def read_soul_state(self):
                return {"pleasure": 0.0}
            def write_soul_state(self, state):
                return False
            def rollback(self): pass

        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)

        target_p = LocalPersonaStorage(self.project_root)
        target_s = FailWriteSoul()
        target_m = LocalMemoryStorage(self.project_root)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("Failed to migrate soul state", result.errors[0])

    def test_memory_write_failure_adds_error(self):
        """测试记忆写入失败添加错误"""
        from agentsoul.abstract import BaseMemoryStorage

        class FailWriteMemory(BaseMemoryStorage):
            def read_daily_memory(self, ident):
                return "content"
            def write_daily_memory(self, ident, content):
                return False
            # Implement other abstract methods
            def archive_topic(self, topic): pass
            def detect_conflict(self, topic): return False
            def list_topics(self, status="active"): return []
            def read_monthly_memory(self, i): return None
            def read_topic_memory(self, t): return None
            def read_weekly_memory(self, w): return None
            def read_yearly_memory(self, y): return None
            def resolve_conflict(self, t, s, strategy): return False
            def write_monthly_memory(self, i, c): return True
            def write_topic_memory(self, t, c): return True
            def write_weekly_memory(self, w, c): return True
            def write_yearly_memory(self, y, c): return True

        # Add a file to source so it will be processed
        (self.project_root / "var" / "data" / "memory" / "day").mkdir(exist_ok=True)
        (self.project_root / "var" / "data" / "memory" / "day" / "test.md").write_text("content")

        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)
        # Override base_dir
        source_m.base_dir = self.project_root / "var" / "data" / "memory"

        target_p = LocalPersonaStorage(self.project_root / "target_fail")
        target_s = LocalSoulStateStorage(self.project_root / "target_fail")
        target_m = FailWriteMemory()
        (self.project_root / "target_fail" / "data" / "memory" / "day").mkdir(parents=True)

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        # Persona + soul succeed, one memory write fails → overall success is False because there is at least one error
        self.assertFalse(result.success)
        self.assertEqual(len(result.errors), 1)

    def test_target_persona_write_returns_false(self):
        """测试目标人格存储write_persona_config返回False添加错误"""
        from agentsoul.abstract import BasePersonaStorage

        # This matches what McpPersonaStorage actually does - write exists but returns False
        class FailWritePersona(BasePersonaStorage):
            def read_persona_config(self):
                return {"name": "Test"}
            def write_persona_config(self, config):
                # MCP doesn't support writing via client
                return False
            def get_version(self): return "1.0"

        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)

        target_p = FailWritePersona()
        target_s = LocalSoulStateStorage(self.project_root / "target_ro")
        target_m = LocalMemoryStorage(self.project_root / "target_ro")

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("Failed to migrate persona", result.errors[0])

    def test_target_soul_write_returns_false(self):
        """测试目标灵魂状态存储write_soul_state返回False添加错误"""
        from agentsoul.abstract import BaseSoulStateStorage

        # This matches what McpSoulStateStorage actually does - write exists but returns False
        class FailWriteSoul(BaseSoulStateStorage):
            def read_soul_state(self):
                return {"pleasure": 0.0}
            def write_soul_state(self, state):
                # MCP doesn't support writing via client
                return False
            def rollback(self, to_version=None): return False

        source_p = LocalPersonaStorage(self.project_root)
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)

        target_p = LocalPersonaStorage(self.project_root / "target_ro_soul")
        target_s = FailWriteSoul()
        target_m = LocalMemoryStorage(self.project_root / "target_ro_soul")

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertEqual(len(result.errors), 1)
        self.assertIn("Failed to migrate soul state", result.errors[0])

    def test_persona_migration_exception_caught(self):
        """测试人格迁移异常被捕获并添加错误"""
        from agentsoul.abstract import BasePersonaStorage

        class ErrorPersona(BasePersonaStorage):
            def read_persona_config(self):
                raise RuntimeError("Cannot read persona config")
            def write_persona_config(self, config):
                return False
            def get_version(self): return "1.0"

        source_p = ErrorPersona()
        source_s = LocalSoulStateStorage(self.project_root)
        source_m = LocalMemoryStorage(self.project_root)

        target_p = LocalPersonaStorage(self.project_root / "target_err_persona")
        target_s = LocalSoulStateStorage(self.project_root / "target_err_persona")
        target_m = LocalMemoryStorage(self.project_root / "target_err_persona")

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)
        self.assertIn("Persona migration error", result.errors[0])

    def test_soul_state_migration_exception_caught(self):
        """测试灵魂状态迁移异常被捕获并添加错误"""
        from agentsoul.abstract import BaseSoulStateStorage

        class ErrorSoul(BaseSoulStateStorage):
            def read_soul_state(self):
                raise RuntimeError("Cannot read soul state")
            def write_soul_state(self, state):
                return False
            def rollback(self, to_version=None): return False

        source_p = LocalPersonaStorage(self.project_root)
        source_s = ErrorSoul()
        source_m = LocalMemoryStorage(self.project_root)

        target_p = LocalPersonaStorage(self.project_root / "target_err_soul")
        target_s = LocalSoulStateStorage(self.project_root / "target_err_soul")
        target_m = LocalMemoryStorage(self.project_root / "target_err_soul")

        migrator = CrossPlatformMigrator(
            (source_p, source_s, source_m),
            (target_p, target_s, target_m)
        )
        result = migrator.migrate_all()
        self.assertFalse(result.success)
        self.assertGreater(len(result.errors), 0)
        self.assertIn("Soul state migration error", result.errors[0])

    def test_cli_argparse_export_command(self):
        """测试CLI导出命令参数解析"""
        import argparse
        from agentsoul.migration import main
        # Test that argument parsing works for export
        import sys
        from unittest.mock import patch

        with patch('sys.argv', ['agentsoul.migration', 'export', 'test.zip']):
            try:
                # Just check it parses args, won't execute because we catch SystemExit
                with patch('agentsoul.migration.export_archive') as mock_export:
                    mock_export.return_value = Path('test.zip')
                    with patch('sys.exit') as mock_exit:
                        mock_exit.side_effect = SystemExit
                        try:
                            main()
                        except SystemExit:
                            pass
                    mock_export.assert_called_once()
            except SystemExit:
                pass
            # Should reach here without errors
            self.assertTrue(True)

    def test_cli_argparse_import_command(self):
        """测试CLI导入命令参数解析"""
        from unittest.mock import patch
        import sys

        with patch('sys.argv', ['agentsoul.migration', 'import', 'test.zip', '--no-skip-existing']):
            try:
                with patch('agentsoul.migration.import_archive') as mock_import:
                    from agentsoul.migration import MigrationResult
                    mock_import.return_value = MigrationResult(
                        success=True, items_migrated=5, errors=[], message='ok'
                    )
                    with patch('sys.exit') as mock_exit:
                        mock_exit.side_effect = SystemExit
                        try:
                            from agentsoul.migration import main
                            main()
                        except SystemExit:
                            pass
                    mock_import.assert_called_once()
                    # Check that skip_existing is False because --no-skip-existing is passed
                    args = mock_import.call_args
                    self.assertEqual(args[0][2], False)
            except SystemExit:
                pass
            self.assertTrue(True)

    def test_cli_argparse_migrate_local_to_mcp(self):
        """测试CLI migrate-local-to-mcp命令参数解析"""
        from unittest.mock import patch
        import sys

        with patch('sys.argv', ['agentsoul.migration', 'migrate-local-to-mcp']):
            try:
                with patch('agentsoul.migration.LocalToMcpMigrator') as mock_ctor:
                    from agentsoul.migration import MigrationResult
                    mock_instance = mock_ctor.return_value
                    mock_instance.migrate_all.return_value = MigrationResult(
                        success=True, items_migrated=5, errors=[], message='ok'
                    )
                    with patch('sys.exit') as mock_exit:
                        mock_exit.side_effect = SystemExit
                        try:
                            from agentsoul.migration import main
                            main()
                        except SystemExit:
                            pass
                    mock_ctor.assert_called_once()
                    mock_instance.migrate_all.assert_called_once()
            except SystemExit:
                pass
            self.assertTrue(True)

    def test_cli_argparse_migrate_mcp_to_local(self):
        """测试CLI migrate-mcp-to-local命令参数解析"""
        from unittest.mock import patch
        import sys

        with patch('sys.argv', ['agentsoul.migration', 'migrate-mcp-to-local']):
            try:
                with patch('agentsoul.migration.McpToLocalMigrator') as mock_ctor:
                    from agentsoul.migration import MigrationResult
                    mock_instance = mock_ctor.return_value
                    mock_instance.migrate_all.return_value = MigrationResult(
                        success=True, items_migrated=5, errors=[], message='ok'
                    )
                    with patch('sys.exit') as mock_exit:
                        mock_exit.side_effect = SystemExit
                        try:
                            from agentsoul.migration import main
                            main()
                        except SystemExit:
                            pass
                    mock_ctor.assert_called_once()
                    mock_instance.migrate_all.assert_called_once()
            except SystemExit:
                pass
            self.assertTrue(True)

    # Note: unknown command is handled by argparse and exits before reaching the else clause
    # The else at line 603-605 is unreachable due to required=True on subparsers


if __name__ == "__main__":
    unittest.main()
