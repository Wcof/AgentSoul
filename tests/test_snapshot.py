"""
AgentSoul · 灵魂快照与回滚测试
=============================

测试 src/snapshot.py 快照管理功能
"""
from __future__ import annotations

import os
import sys
import json
import zipfile

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
import tempfile
from pathlib import Path
from unittest.mock import patch, Mock

from src.snapshot import (
    SoulSnapshot,
    SnapshotManager,
    VersionRollback,
)


class BaseTest(unittest.TestCase):
    """基础测试类，提供通用断言方法"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestSoulSnapshot(BaseTest):
    """测试 SoulSnapshot dataclass"""

    def test_snapshot_creation(self):
        """测试创建快照对象"""
        snapshot = SoulSnapshot(
            snapshot_id="test-id",
            timestamp="2024-01-01T00:00:00",
            description="test snapshot",
            persona_version="1.0.0",
            persona_checksum="abc123",
            soul_state={"pleasure": 0.5},
            memory_topics=["topic1", "topic2"],
            metadata={"key": "value"},
        )
        self.assertEqual(snapshot.snapshot_id, "test-id")
        self.assertEqual(snapshot.description, "test snapshot")
        self.assertEqual(snapshot.persona_version, "1.0.0")
        self.assertEqual(snapshot.persona_checksum, "abc123")
        self.assertEqual(snapshot.soul_state["pleasure"], 0.5)
        self.assertEqual(snapshot.memory_topics, ["topic1", "topic2"])
        self.assertEqual(snapshot.metadata["key"], "value")


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

    def test_init_creates_snapshot_dir(self):
        """测试初始化创建快照目录"""
        manager = SnapshotManager(self.project_root, max_snapshots=10)
        self.assertTrue(manager.snapshot_dir.exists())
        self.assertEqual(manager.max_snapshots, 10)
        self.assertEqual(manager.project_root, self.project_root)

    def test_init_default_project_root(self):
        """测试使用默认项目根目录"""
        from common import get_project_root
        with patch('src.snapshot.get_project_root', return_value=self.project_root):
            manager = SnapshotManager()
            self.assertEqual(manager.project_root, self.project_root)

    def test_generate_snapshot_id_unique(self):
        """测试生成唯一快照 ID"""
        manager = SnapshotManager(self.project_root)
        id1 = manager._generate_snapshot_id()
        id2 = manager._generate_snapshot_id()
        # Counter increments so ids are different
        self.assertNotEqual(id1, id2)
        # Format includes timestamp and counter
        self.assertTrue('_' in id1)
        # Counter should be 3 digits at end
        self.assertEqual(len(id1.split('_')[-1]), 3)

    def test_calculate_checksum(self):
        """测试计算内容哈希"""
        manager = SnapshotManager(self.project_root)
        content = "test content"
        checksum = manager._calculate_checksum(content)
        # Should be 16 characters
        self.assertEqual(len(checksum), 16)
        # Same content gives same checksum
        checksum2 = manager._calculate_checksum(content)
        self.assertEqual(checksum, checksum2)
        # Different content gives different checksum
        checksum3 = manager._calculate_checksum("different")
        self.assertNotEqual(checksum, checksum3)

    def test_create_snapshot(self):
        """测试创建快照"""
        # Create minimal required files
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_path.write_text("ai:\n  name: Test\n")
        state_path = self.project_root / "data" / "soul" / "soul_variable" / "state_vector.json"
        state_path.write_text('{"pleasure": 0.5}\n')

        manager = SnapshotManager(self.project_root, max_snapshots=10)

        with patch('src.snapshot.LocalPersonaStorage') as mock_persona_cls:
            mock_persona = Mock()
            mock_persona.read_persona_config.return_value = {"ai": {"name": "Test"}}
            mock_persona.get_version.return_value = Mock(version="1.0.0")
            mock_persona_cls.return_value = mock_persona

            with patch('src.snapshot.LocalSoulStateStorage') as mock_state_cls:
                mock_state = Mock()
                mock_state.read_soul_state.return_value = {"pleasure": 0.5}
                mock_state_cls.return_value = mock_state

                with patch('src.snapshot.LocalMemoryStorage') as mock_memory_cls:
                    mock_memory = Mock()
                    mock_memory.list_topics.return_value = [{"name": "topic1"}]
                    mock_memory_cls.return_value = mock_memory

                    snapshot = manager.create_snapshot("test snapshot", {"key": "value"})

                    self.assertIsInstance(snapshot, SoulSnapshot)
                    self.assertEqual(snapshot.description, "test snapshot")
                    self.assertEqual(snapshot.metadata, {"key": "value"})
                    self.assertEqual(snapshot.persona_version, "1.0.0")

        # Check snapshot file was created
        # We get two .json files: the index and the copied state.json
        snapshot_files = list(manager.snapshot_dir.glob("*.json"))
        self.assertEqual(len(snapshot_files), 2)

    def test_list_snapshots_empty_when_no_snapshots(self):
        """测试没有快照时返回空列表"""
        manager = SnapshotManager(self.project_root)
        snapshots = manager.list_snapshots()
        self.assertEqual(len(snapshots), 0)

    def test_list_snapshots_skip_aux_files(self):
        """测试列出快照时跳过辅助文件"""
        manager = SnapshotManager(self.project_root)
        manager.snapshot_dir.mkdir(parents=True, exist_ok=True)
        # Create json index and auxiliary files
        (manager.snapshot_dir / "test.json").touch()
        (manager.snapshot_dir / "test_persona.yaml").touch()
        (manager.snapshot_dir / "test_state.json").touch()

        with patch('json.load', return_value={
            "snapshot_id": "test", "timestamp": "t", "description": "d",
            "persona_version": "v", "persona_checksum": "c", "soul_state": {}, "memory_topics": [], "metadata": {}
        }):
            snapshots = manager.list_snapshots()
            self.assertEqual(len(snapshots), 1)

    def test_list_snapshots_skip_corrupted(self):
        """测试列出快照时跳过损坏文件"""
        manager = SnapshotManager(self.project_root)
        manager.snapshot_dir.mkdir(parents=True, exist_ok=True)
        (manager.snapshot_dir / "bad.json").write_text("not valid json")

        snapshots = manager.list_snapshots()
        self.assertEqual(len(snapshots), 0)  # corrupted should be skipped, empty result

    def test_get_snapshot_empty_when_not_found(self):
        """测试找不到快照返回 None"""
        manager = SnapshotManager(self.project_root)
        snapshot = manager.get_snapshot("nonexistent")
        self.assertIsNone(snapshot)

    def test_get_snapshot_success(self):
        """测试成功获取快照"""
        manager = SnapshotManager(self.project_root)

        # Create a snapshot file manually
        snapshot_data = {
            "snapshot_id": "test-123",
            "timestamp": "2024-01-01T00:00:00",
            "description": "test",
            "persona_version": "1.0.0",
            "persona_checksum": "abc123",
            "soul_state": {},
            "memory_topics": [],
            "metadata": {},
        }
        index_path = manager.snapshot_dir / "test-123.json"
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(snapshot_data, f)

        snapshot = manager.get_snapshot("test-123")
        self.assertIsNotNone(snapshot)
        self.assertEqual(snapshot.snapshot_id, "test-123")
        self.assertEqual(snapshot.description, "test")

    def test_get_snapshot_corrupted_json_returns_none(self):
        """测试损坏 JSON 返回 None"""
        manager = SnapshotManager(self.project_root)
        index_path = manager.snapshot_dir / "bad.json"
        with open(index_path, "w", encoding="utf-8") as f:
            f.write("not valid json {{{")

        snapshot = manager.get_snapshot("bad")
        self.assertIsNone(snapshot)

    def test_delete_snapshot_deletes_all_files(self):
        """测试删除快照删除所有相关文件"""
        manager = SnapshotManager(self.project_root)
        snapshot_id = "test-del"

        # Create all three files
        (manager.snapshot_dir / f"{snapshot_id}.json").touch()
        (manager.snapshot_dir / f"{snapshot_id}_persona.yaml").touch()
        (manager.snapshot_dir / f"{snapshot_id}_state.json").touch()

        self.assertTrue((manager.snapshot_dir / f"{snapshot_id}.json").exists())

        result = manager.delete_snapshot(snapshot_id)
        self.assertTrue(result)
        self.assertFalse((manager.snapshot_dir / f"{snapshot_id}.json").exists())
        self.assertFalse((manager.snapshot_dir / f"{snapshot_id}_persona.yaml").exists())
        self.assertFalse((manager.snapshot_dir / f"{snapshot_id}_state.json").exists())

    def test_delete_snapshot_returns_false_when_not_found(self):
        """测试删除不存在快照返回 False"""
        manager = SnapshotManager(self.project_root)
        result = manager.delete_snapshot("nonexistent")
        self.assertFalse(result)

    def test_automatic_cleanup_deletes_when_over_max(self):
        """测试超过最大数量时自动清理旧快照"""
        manager = SnapshotManager(self.project_root, max_snapshots=3)

        # We need to mock the internal calls to avoid actually reading from storage
        with patch('src.snapshot.LocalPersonaStorage') as mock_persona_cls:
            mock_persona = Mock()
            mock_persona.read_persona_config.return_value = {"ai": {"name": "Test"}}
            mock_persona.get_version.return_value = Mock(version="1.0.0")
            mock_persona_cls.return_value = mock_persona

            with patch('src.snapshot.LocalSoulStateStorage') as mock_state_cls:
                mock_state = Mock()
                mock_state.read_soul_state.return_value = {"pleasure": 0.5}
                mock_state_cls.return_value = mock_state

                with patch('src.snapshot.LocalMemoryStorage') as mock_memory_cls:
                    mock_memory = Mock()
                    mock_memory.list_topics.return_value = []
                    mock_memory_cls.return_value = mock_memory

                    # Create 5 snapshots - cleanup runs automatically after each create
                    for i in range(5):
                        manager.create_snapshot(f"snap {i}")

        # After 5 created with max 3, we should have 3 snapshots
        snapshots = manager.list_snapshots()
        # list returns reverse order (newest first)
        self.assertEqual(len(snapshots), 3)
        # newest is first
        self.assertEqual(snapshots[0].description, "snap 4")

    def test_export_snapshot(self):
        """测试导出快照"""
        manager = SnapshotManager(self.project_root)

        # Create a snapshot
        snapshot_id = "test-exp"
        snapshot_data = {
            "snapshot_id": snapshot_id,
            "timestamp": "2024-01-01T00:00:00",
            "description": "export test",
            "persona_version": "1.0.0",
            "persona_checksum": "abc123",
            "soul_state": {},
            "memory_topics": [],
            "metadata": {},
        }
        # Create the index file
        index_path = manager.snapshot_dir / f"{snapshot_id}.json"
        with open(index_path, "w", encoding="utf-8") as f:
            json.dump(snapshot_data, f)
        # Create dummy backup files
        (manager.snapshot_dir / f"{snapshot_id}_persona.yaml").write_text("test")
        (manager.snapshot_dir / f"{snapshot_id}_state.json").write_text("{}")

        with tempfile.TemporaryDirectory() as out_dir:
            out_path = Path(out_dir)
            zip_path = manager.export_snapshot(snapshot_id, out_path)
            self.assertIsNotNone(zip_path)
            self.assertTrue(zip_path.exists())
            self.assertEqual(zip_path.suffix, ".zip")

    def test_export_snapshot_none_when_not_found(self):
        """测试导出不存在快照返回 None"""
        manager = SnapshotManager(self.project_root)
        with tempfile.TemporaryDirectory() as out_dir:
            result = manager.export_snapshot("nonexistent", Path(out_dir))
            self.assertIsNone(result)

    def test_import_snapshot_zip(self):
        """测试从 zip 导入快照"""
        manager = SnapshotManager(self.project_root)

        # Create a test zip
        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            # Create zip content
            (tmp_path / "agentsoul_snapshot_test-imp").mkdir()
            snapshot_data = {
                "snapshot_id": "test-imp",
                "timestamp": "2024-01-01T00:00:00",
                "description": "import test",
                "persona_version": "1.0.0",
                "persona_checksum": "abc123",
                "soul_state": {},
                "memory_topics": [],
                "metadata": {},
            }
            with open(tmp_path / "agentsoul_snapshot_test-imp" / "test-imp.json", "w") as f:
                json.dump(snapshot_data, f)
            (tmp_path / "agentsoul_snapshot_test-imp" / "test-imp_persona.yaml").write_text("test")

            # Create zip
            zip_path = self.project_root / "test_import.zip"
            with zipfile.ZipFile(zip_path, 'w') as zf:
                for file in (tmp_path / "agentsoul_snapshot_test-imp").iterdir():
                    zf.write(file, arcname=file.relative_to(tmp_path))

            # Import
            imported = manager.import_snapshot(zip_path)
            self.assertIsNotNone(imported)
            self.assertEqual(imported.snapshot_id, "test-imp")
            self.assertTrue((manager.snapshot_dir / "test-imp.json").exists())
            self.assertTrue((manager.snapshot_dir / "test-imp_persona.yaml").exists())

            # Cleanup
            zip_path.unlink()

    def test_import_snapshot_none_when_file_not_found(self):
        """测试导入文件不存在返回 None"""
        manager = SnapshotManager(self.project_root)
        result = manager.import_snapshot(Path("/nonexistent.zip"))
        self.assertIsNone(result)

    def test_import_snapshot_none_when_no_snapshot_in_zip(self):
        """测试 zip 中没有快照返回 None"""
        manager = SnapshotManager(self.project_root)

        with tempfile.TemporaryDirectory() as tmpdir:
            tmp_path = Path(tmpdir)
            zip_path = tmp_path / "empty.zip"
            with zipfile.ZipFile(zip_path, 'w') as zf:
                # Empty zip
                pass
            imported = manager.import_snapshot(zip_path)
            self.assertIsNone(imported)

    def test_rollback_success(self):
        """测试成功回滚"""
        manager = SnapshotManager(self.project_root)

        # Create snapshot directory and backup files
        snapshot_id = "test-rollback"
        manager.snapshot_dir.mkdir(parents=True, exist_ok=True)
        (manager.snapshot_dir / f"{snapshot_id}.json").write_text(json.dumps({
            "snapshot_id": snapshot_id,
            "timestamp": "2024-01-01",
            "description": "test",
            "persona_version": "1.0.0",
            "persona_checksum": "abc",
            "soul_state": {"pleasure": 0.5},
            "memory_topics": [],
            "metadata": {},
        }))
        (manager.snapshot_dir / f"{snapshot_id}_persona.yaml").write_text("rollback content")
        (manager.snapshot_dir / f"{snapshot_id}_state.json").write_text('{"pleasure": 0.5}')

        # Ensure target directories exist
        (self.project_root / "config").mkdir(exist_ok=True)

        with patch('src.snapshot.LocalSoulStateStorage') as mock_state_cls:
            mock_state = Mock()
            mock_state.write_soul_state.return_value = True
            mock_state_cls.return_value = mock_state

            result = manager.rollback(snapshot_id)
            self.assertTrue(result)
            # Check persona was copied
            target_persona = self.project_root / "config" / "persona.yaml"
            self.assertTrue(target_persona.exists())
            self.assertEqual(target_persona.read_text(), "rollback content")

    def test_rollback_fails_when_not_found(self):
        """测试回滚不存在快照失败"""
        manager = SnapshotManager(self.project_root)
        result = manager.rollback("nonexistent")
        self.assertFalse(result)


class TestVersionRollback(BaseTest):
    """测试版本回滚管理器"""

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        (self.project_root / "config").mkdir()
        (self.project_root / "data" / "soul" / "soul_variable").mkdir(parents=True)

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_init_creates_manager(self):
        """测试初始化创建管理器"""
        from common import get_project_root
        with patch('src.snapshot.get_project_root', return_value=self.project_root):
            rb = VersionRollback(max_snapshots=20)
            self.assertIsNotNone(rb.manager)

    def test_create_before_change(self):
        """测试在修改前创建快照"""
        from common import get_project_root
        with patch('src.snapshot.get_project_root', return_value=self.project_root):
            rb = VersionRollback(max_snapshots=20)

            with patch.object(rb.manager, 'create_snapshot') as mock_create:
                mock_create.return_value = Mock(snapshot_id="test-id")
                snapshot_id = rb.create_before_change("test change")
                mock_create.assert_called_once()
                call_args = mock_create.call_args
                self.assertIn("Before: test change", call_args[1]["description"])
                self.assertTrue(call_args[1]["metadata"]["automatic"])
                self.assertEqual(snapshot_id, "test-id")

    def test_rollback_to_calls_manager(self):
        """测试回滚调用管理器"""
        from common import get_project_root
        with patch('src.snapshot.get_project_root', return_value=self.project_root):
            rb = VersionRollback()
            with patch.object(rb.manager, 'rollback', return_value=True) as mock_rollback:
                result = rb.rollback_to("test-id")
                mock_rollback.assert_called_once_with("test-id")
                self.assertTrue(result)

    def test_list_available_calls_manager(self):
        """测试列出可用版本"""
        from common import get_project_root
        with patch('src.snapshot.get_project_root', return_value=self.project_root):
            rb = VersionRollback()
            mock_snapshots = [
                SoulSnapshot(
                    snapshot_id="id1",
                    timestamp="t1",
                    description="d1",
                    persona_version="v1",
                    persona_checksum="c1",
                    soul_state={},
                    memory_topics=[],
                    metadata={},
                )
            ]
            with patch.object(rb.manager, 'list_snapshots', return_value=mock_snapshots):
                result = rb.list_available()
                self.assertEqual(len(result), 1)
                self.assertEqual(result[0]["id"], "id1")
                self.assertEqual(result[0]["description"], "d1")


if __name__ == "__main__":
    unittest.main()
