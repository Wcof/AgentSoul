"""
AgentSoul · 灵魂快照测试
======================

测试灵魂快照与版本回滚功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
import tempfile
from pathlib import Path
from src import SnapshotManager, SoulSnapshot, VersionRollback


class BaseTest(unittest.TestCase):
    """基础测试类，提供通用断言方法"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestSnapshotManager(BaseTest):
    """测试快照管理器"""

    def setUp(self):
        """创建临时目录用于测试"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        # 创建必要的目录结构
        (self.project_root / "config").mkdir()
        (self.project_root / "data" / "soul" / "soul_variable").mkdir(parents=True)

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_create_snapshot(self):
        """测试创建快照"""
        manager = SnapshotManager(self.project_root, max_snapshots=10)
        snapshot = manager.create_snapshot("test snapshot", {"test": True})

        self.assertIsInstance(snapshot, SoulSnapshot)
        self.assertNotEmpty(snapshot.snapshot_id)
        self.assertEqual(snapshot.description, "test snapshot")
        self.assertIn("test", snapshot.metadata)

    def test_list_snapshots(self):
        """测试列出快照"""
        manager = SnapshotManager(self.project_root)
        # 创建两个快照
        manager.create_snapshot("first")
        manager.create_snapshot("second")

        snapshots = manager.list_snapshots()
        self.assertEqual(len(snapshots), 2)
        # 最新的应该在第一个
        self.assertEqual(snapshots[0].description, "second")

    def test_get_snapshot(self):
        """测试获取快照"""
        manager = SnapshotManager(self.project_root)
        created = manager.create_snapshot("get test")
        fetched = manager.get_snapshot(created.snapshot_id)

        self.assertIsNotNone(fetched)
        self.assertEqual(fetched.snapshot_id, created.snapshot_id)
        self.assertEqual(fetched.description, "get test")

    def test_delete_snapshot(self):
        """测试删除快照"""
        manager = SnapshotManager(self.project_root)
        snapshot = manager.create_snapshot("to delete")
        initial_count = len(manager.list_snapshots())
        self.assertEqual(initial_count, 1)

        deleted = manager.delete_snapshot(snapshot.snapshot_id)
        self.assertTrue(deleted)
        after_count = len(manager.list_snapshots())
        self.assertEqual(after_count, 0)

    def test_automatic_cleanup(self):
        """测试自动清理旧快照"""
        manager = SnapshotManager(self.project_root, max_snapshots=3)
        # 创建 5 个快照
        for i in range(5):
            manager.create_snapshot(f"snapshot {i}")

        snapshots = manager.list_snapshots()
        # 应该只保留 3 个最新的
        self.assertEqual(len(snapshots), 3)
        # 最新的第一个应该是 snapshot 4
        self.assertEqual(snapshots[0].description, "snapshot 4")

    def test_calculate_checksum(self):
        """测试校验和计算"""
        manager = SnapshotManager(self.project_root)
        checksum1 = manager._calculate_checksum("hello world")
        checksum2 = manager._calculate_checksum("hello world")
        checksum3 = manager._calculate_checksum("hello changed")

        self.assertEqual(checksum1, checksum2)
        self.assertNotEqual(checksum1, checksum3)


class TestVersionRollback(BaseTest):
    """测试版本回滚管理器"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        (self.project_root / "config").mkdir()
        (self.project_root / "data" / "soul" / "soul_variable").mkdir(parents=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_create_before_change(self):
        """测试在修改前创建快照"""
        rollback = VersionRollback(max_snapshots=10)
        # 替换项目根目录
        rollback.manager.project_root = self.project_root
        rollback.manager._update_paths()
        rollback.manager._ensure_dir()
        snapshot_id = rollback.create_before_change("test change")

        self.assertNotEmpty(snapshot_id)
        snapshots = rollback.manager.list_snapshots()
        self.assertEqual(len(snapshots), 1)
        self.assertIn("Before: test change", snapshots[0].description)

    def test_list_available(self):
        """测试列出可用版本"""
        rollback = VersionRollback()
        rollback.manager.project_root = self.project_root
        rollback.manager._update_paths()
        rollback.manager._ensure_dir()
        rollback.create_before_change("change 1")
        rollback.create_before_change("change 2")

        versions = rollback.list_available()
        self.assertEqual(len(versions), 2)
        self.assertIn("change 1", versions[1]["description"])


if __name__ == "__main__":
    unittest.main()
