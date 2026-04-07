"""
AgentSoul · 灵魂快照与版本回滚
===========================

功能特性：
- 创建完整灵魂快照（人格配置 + 灵魂状态 + 记忆索引）
- 列出所有可用快照
- 回滚到指定快照
- 自动清理旧快照（保留最近 N 个）
- 导出/导入快照用于跨平台迁移
"""
from __future__ import annotations

import hashlib
import json
import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

from common import get_project_root, log
from src.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSoulStateStorage,
)


@dataclass
class SoulSnapshot:
    """灵魂快照"""
    snapshot_id: str
    timestamp: str
    description: str
    persona_version: str
    persona_checksum: str
    soul_state: dict[str, Any]
    memory_topics: list[str]
    metadata: dict[str, Any]


class SnapshotManager:
    """灵魂快照管理器"""

    _counter: int = 0

    def __init__(self, project_root: Path | None = None, max_snapshots: int = 50):
        self.project_root = project_root or get_project_root()
        self.max_snapshots = max_snapshots
        self._update_paths()
        self._ensure_dir()

    def _update_paths(self) -> None:
        """Update paths after project_root change"""
        self.snapshot_dir = self.project_root / "data" / "snapshots"

    def _ensure_dir(self) -> None:
        """确保快照目录存在"""
        self.snapshot_dir.mkdir(parents=True, exist_ok=True)

    def _generate_snapshot_id(self) -> str:
        """生成快照 ID

        Uses timestamp with milliseconds + incrementing counter to guarantee uniqueness
        even when multiple snapshots are created within the same millisecond.
        """
        now = datetime.now()
        SnapshotManager._counter += 1
        ts = now.strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Include milliseconds
        return f"{ts}_{SnapshotManager._counter:03d}"

    def _calculate_checksum(self, content: str) -> str:
        """计算内容哈希"""
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def create_snapshot(self, description: str = "", metadata: dict[str, Any] | None = None) -> SoulSnapshot:
        """创建完整灵魂快照

        Args:
            description: 快照描述（比如"修改人格之前"、"功能更新前"）
            metadata: 额外元数据

        Returns:
            创建的快照信息
        """
        # 创建存储实例读取当前状态
        persona = LocalPersonaStorage(self.project_root)
        soul_state = LocalSoulStateStorage(self.project_root)
        memory = LocalMemoryStorage(self.project_root)

        # 读取当前状态
        persona_config = persona.read_persona_config()
        current_state = soul_state.read_soul_state()
        topics = memory.list_topics(status="all")

        # 计算人格配置校验和
        persona_json = json.dumps(persona_config, sort_keys=True)
        persona_checksum = self._calculate_checksum(persona_json)

        # 获取人格版本
        persona_version = persona.get_version().version

        # 创建快照对象
        snapshot_id = self._generate_snapshot_id()
        snapshot = SoulSnapshot(
            snapshot_id=snapshot_id,
            timestamp=datetime.now().isoformat(),
            description=description,
            persona_version=persona_version,
            persona_checksum=persona_checksum,
            soul_state=current_state,
            memory_topics=[t["name"] for t in topics],
            metadata=metadata or {}
        )

        # 保存快照索引和完整数据
        snapshot_json = json.dumps(snapshot.__dict__, indent=2, ensure_ascii=False)

        # 保存索引
        index_path = self.snapshot_dir / f"{snapshot_id}.json"
        with open(index_path, "w", encoding="utf-8") as f:
            f.write(snapshot_json)

        # 复制当前人格配置文件完整备份
        persona_src = self.project_root / "config" / "persona.yaml"
        if persona_src.exists():
            persona_dst = self.snapshot_dir / f"{snapshot_id}_persona.yaml"
            shutil.copy2(persona_src, persona_dst)

        # 复制灵魂状态完整备份
        state_src = self.project_root / "data" / "soul" / "soul_variable" / "state_vector.json"
        if state_src.exists():
            state_dst = self.snapshot_dir / f"{snapshot_id}_state.json"
            shutil.copy2(state_src, state_dst)

        # 清理旧快照
        self._cleanup_old_snapshots()

        log(f"Created soul snapshot: {snapshot_id} - {description}", level="INFO")
        return snapshot

    def list_snapshots(self) -> list[SoulSnapshot]:
        """列出所有可用快照，按时间倒序排列"""
        snapshots: list[SoulSnapshot] = []

        if not self.snapshot_dir.exists():
            return snapshots

        for file in self.snapshot_dir.glob("*.json"):
            if file.name.endswith(("_persona.yaml", "_state.json")):
                continue
            try:
                with open(file, encoding="utf-8") as f:
                    data = json.load(f)
                snapshots.append(SoulSnapshot(**data))
            except Exception as e:
                log(f"Failed to load snapshot {file}: {e}", level="WARNING")
                continue

        # 按时间倒序排列
        snapshots.sort(key=lambda s: s.timestamp, reverse=True)
        return snapshots

    def get_snapshot(self, snapshot_id: str) -> SoulSnapshot | None:
        """获取指定快照信息"""
        index_path = self.snapshot_dir / f"{snapshot_id}.json"
        if not index_path.exists():
            return None

        try:
            with open(index_path, encoding="utf-8") as f:
                data = json.load(f)
            return SoulSnapshot(**data)
        except Exception as e:
            log(f"Failed to load snapshot {snapshot_id}: {e}", level="ERROR")
            return None

    def rollback(self, snapshot_id: str) -> bool:
        """回滚到指定快照

        Args:
            snapshot_id: 要回滚到的快照 ID

        Returns:
            是否回滚成功
        """
        snapshot = self.get_snapshot(snapshot_id)
        if snapshot is None:
            log(f"Snapshot {snapshot_id} not found", level="ERROR")
            return False

        try:
            # 回滚人格配置
            persona_backup = self.snapshot_dir / f"{snapshot_id}_persona.yaml"
            if persona_backup.exists():
                target = self.project_root / "config" / "persona.yaml"
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(persona_backup, target)
                log(f"Rolled back persona config from snapshot {snapshot_id}", level="INFO")

            # 回滚灵魂状态
            state_backup = self.snapshot_dir / f"{snapshot_id}_state.json"
            if state_backup.exists():
                # 读取备份状态
                with open(state_backup, encoding="utf-8") as f:
                    state_data = json.load(f)
                # 写入回去
                storage = LocalSoulStateStorage(self.project_root)
                success = storage.write_soul_state(state_data)
                if success:
                    log(f"Rolled back soul state from snapshot {snapshot_id}", level="INFO")
                else:
                    log("Failed to write soul state during rollback", level="ERROR")
                    return False

            log(f"Successfully rolled back to snapshot {snapshot_id}", level="INFO")
            return True

        except Exception as e:
            log(f"Rollback failed: {e}", level="ERROR")
            return False

    def delete_snapshot(self, snapshot_id: str) -> bool:
        """删除指定快照"""
        deleted = False

        # 删除索引
        index_path = self.snapshot_dir / f"{snapshot_id}.json"
        if index_path.exists():
            index_path.unlink()
            deleted = True

        # 删除人格备份
        persona_path = self.snapshot_dir / f"{snapshot_id}_persona.yaml"
        if persona_path.exists():
            persona_path.unlink()
            deleted = True

        # 删除状态备份
        state_path = self.snapshot_dir / f"{snapshot_id}_state.json"
        if state_path.exists():
            state_path.unlink()
            deleted = True

        return deleted

    def _cleanup_old_snapshots(self) -> None:
        """清理超过保留数量的旧快照"""
        snapshots = self.list_snapshots()
        if len(snapshots) > self.max_snapshots:
            # 删除最旧的
            to_delete = snapshots[self.max_snapshots:]
            for snap in to_delete:
                self.delete_snapshot(snap.snapshot_id)
            log(f"Cleaned up {len(to_delete)} old snapshots (keep last {self.max_snapshots})", level="INFO")

    def export_snapshot(self, snapshot_id: str, output_dir: Path) -> Path | None:
        """导出快照到指定目录，可用于跨平台迁移

        Args:
            snapshot_id: 快照 ID
            output_dir: 输出目录

        Returns:
            导出的快照文件路径（zip 文件）
        """
        snapshot = self.get_snapshot(snapshot_id)
        if snapshot is None:
            return None

        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        # 创建导出目录结构
        export_dir = output_dir / f"agentsoul_snapshot_{snapshot_id}"
        export_dir.mkdir(exist_ok=True)

        # 复制快照文件
        for ext in ["json", "_persona.yaml", "_state.json"]:
            src = self.snapshot_dir / f"{snapshot_id}{ext}"
            if src.exists():
                shutil.copy2(src, export_dir)

        # 创建 zip
        zip_path = output_dir / f"agentsoul_snapshot_{snapshot_id}.zip"
        shutil.make_archive(
            str(zip_path.with_suffix('')),
            'zip',
            export_dir.parent,
            export_dir.name
        )

        # 清理临时目录
        shutil.rmtree(export_dir)

        log(f"Exported snapshot to {zip_path}", level="INFO")
        return zip_path

    def import_snapshot(self, zip_path: Path) -> SoulSnapshot | None:
        """导入快照从 zip 文件

        Args:
            zip_path: zip 文件路径

        Returns:
            导入后的快照信息
        """
        import zipfile

        if not zip_path.exists():
            log(f"Import file not found: {zip_path}", level="ERROR")
            return None

        # 解压到临时目录
        temp_dir = self.snapshot_dir / f"temp_import_{int(datetime.now().timestamp())}"
        temp_dir.mkdir()

        try:
            with zipfile.ZipFile(zip_path, 'r') as zip_ref:
                zip_ref.extractall(temp_dir)

            # 找到快照文件 - 递归查找任何子目录中的 json
            json_files = list(temp_dir.rglob("*.json"))
            if not json_files:
                log("No snapshot index found in zip", level="ERROR")
                return None

            # 读取快照信息
            json_path = json_files[0]
            snapshot_id = json_path.stem

            with open(json_path, encoding="utf-8") as f:
                data = json.load(f)
            snapshot = SoulSnapshot(**data)

            # 复制所有文件到快照目录（包括子目录中的文件）
            for file in temp_dir.rglob("*"):
                if file.is_file():
                    shutil.copy2(file, self.snapshot_dir)

            log(f"Imported snapshot: {snapshot_id}", level="INFO")
            return snapshot

        except Exception as e:
            log(f"Import failed: {e}", level="ERROR")
            return None

        finally:
            # 清理临时目录
            shutil.rmtree(temp_dir)


class VersionRollback:
    """版本回滚管理器

    便捷接口用于创建快照和回滚
    """

    def __init__(self, max_snapshots: int = 50):
        self.manager = SnapshotManager(max_snapshots=max_snapshots)

    def create_before_change(self, change_description: str) -> str:
        """在修改之前创建快照

        Args:
            change_description: 修改描述

        Returns:
            快照 ID，用于后续回滚
        """
        snapshot = self.manager.create_snapshot(
            description=f"Before: {change_description}",
            metadata={"change": change_description, "automatic": True}
        )
        return snapshot.snapshot_id

    def rollback_to(self, snapshot_id: str) -> bool:
        """回滚到指定快照"""
        return self.manager.rollback(snapshot_id)

    def list_available(self) -> list[dict[str, Any]]:
        """列出可用版本"""
        snapshots = self.manager.list_snapshots()
        return [
            {
                "id": s.snapshot_id,
                "timestamp": s.timestamp,
                "description": s.description,
                "persona_version": s.persona_version,
            }
            for s in snapshots
        ]
