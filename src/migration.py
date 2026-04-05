"""
AgentSoul · 跨平台灵魂迁移
=========================

支持在不同平台之间迁移完整灵魂数据：
- OpenAI (本地存储) → Claude (MCP 服务)
- Claude (MCP 服务) → OpenAI (本地存储)
- 完整迁移：人格配置 + 灵魂状态 + 所有分层记忆
"""

import json
import shutil
import zipfile
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from dataclasses import dataclass

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common import get_project_root, log
from src.abstract import (
    BasePersonaStorage,
    BaseSoulStateStorage,
    BaseMemoryStorage,
)
from src.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
)
from src.storage.mcp_client import (
    McpPersonaStorage,
    McpSoulStateStorage,
    McpMemoryStorage,
)


@dataclass
class MigrationResult:
    """迁移结果"""
    success: bool
    items_migrated: int
    errors: List[str]
    message: str


class CrossPlatformMigrator:
    """跨平台灵魂迁移器

    支持在本地存储 (OpenAI 链路) 和 MCP 客户端存储 (Claude 链路) 之间迁移完整灵魂数据。
    """

    def __init__(
        self,
        source_storage: Tuple[BasePersonaStorage, BaseSoulStateStorage, BaseMemoryStorage],
        target_storage: Tuple[BasePersonaStorage, BaseSoulStateStorage, BaseMemoryStorage],
    ):
        """初始化迁移器

        Args:
            source_storage: 源存储 (persona, soul_state, memory)
            target_storage: 目标存储 (persona, soul_state, memory)
        """
        self.source_persona, self.source_soul, self.source_memory = source_storage
        self.target_persona, self.target_soul, self.target_memory = target_storage

    def migrate_all(self, skip_existing: bool = True) -> MigrationResult:
        """迁移所有数据

        迁移顺序：
        1. 人格配置
        2. 灵魂状态
        3. 所有分层记忆 (日/周/月/年/主题)

        Args:
            skip_existing: 是否跳过已存在的记忆文件

        Returns:
            迁移结果统计
        """
        errors: List[str] = []
        total_migrated = 0

        try:
            # 1. 迁移人格配置
            success = self._migrate_persona(errors)
            if success:
                total_migrated += 1
                log("Migrated persona configuration", level="INFO")
            else:
                errors.append("Failed to migrate persona configuration")

            # 2. 迁移灵魂状态
            success = self._migrate_soul_state(errors)
            if success:
                total_migrated += 1
                log("Migrated soul state (PAD emotion vector)", level="INFO")
            else:
                errors.append("Failed to migrate soul state")

            # 3. 迁移分层记忆
            # 日记忆
            daily_migrated = self._migrate_daily_memory(skip_existing, errors)
            total_migrated += daily_migrated
            log(f"Migrated {daily_migrated} daily memory files", level="INFO")

            # 周记忆
            weekly_migrated = self._migrate_weekly_memory(skip_existing, errors)
            total_migrated += weekly_migrated
            log(f"Migrated {weekly_migrated} weekly memory files", level="INFO")

            # 月记忆
            monthly_migrated = self._migrate_monthly_memory(skip_existing, errors)
            total_migrated += monthly_migrated
            log(f"Migrated {monthly_migrated} monthly memory files", level="INFO")

            # 年记忆
            yearly_migrated = self._migrate_yearly_memory(skip_existing, errors)
            total_migrated += yearly_migrated
            log(f"Migrated {yearly_migrated} yearly memory files", level="INFO")

            # 主题记忆
            topic_migrated = self._migrate_topic_memory(skip_existing, errors)
            total_migrated += topic_migrated
            log(f"Migrated {topic_migrated} topic memory files", level="INFO")

            success_overall = len(errors) == 0
            message = f"Migration completed: {total_migrated} items migrated"
            if errors:
                message += f" with {len(errors)} errors"

            return MigrationResult(
                success=success_overall,
                items_migrated=total_migrated,
                errors=errors,
                message=message
            )

        except Exception as e:
            errors.append(f"Unexpected error during migration: {str(e)}")
            return MigrationResult(
                success=False,
                items_migrated=total_migrated,
                errors=errors,
                message=f"Migration failed: {str(e)}"
            )

    def _migrate_persona(self, errors: List[str]) -> bool:
        """迁移人格配置"""
        try:
            persona_config = self.source_persona.read_persona_config()
            # MCP 客户端不支持写入，只能本地存储支持写入
            # 如果目标是 MCP，用户需要手动将文件复制到目标位置
            if hasattr(self.target_persona, 'write_persona_config'):
                return self.target_persona.write_persona_config(persona_config)
            else:
                errors.append("Target storage does not support writing persona config (MCP client is read-only for persona)")
                return False
        except Exception as e:
            errors.append(f"Persona migration error: {str(e)}")
            return False

    def _migrate_soul_state(self, errors: List[str]) -> bool:
        """迁移灵魂状态"""
        try:
            soul_state = self.source_soul.read_soul_state()
            if hasattr(self.target_soul, 'write_soul_state'):
                return self.target_soul.write_soul_state(soul_state)
            else:
                errors.append("Target storage does not support writing soul state")
                return False
        except Exception as e:
            errors.append(f"Soul state migration error: {str(e)}")
            return False

    def _migrate_daily_memory(self, skip_existing: bool, errors: List[str]) -> int:
        """迁移所有日记忆"""
        migrated = 0
        # 如果源是本地，我们可以直接枚举文件
        if hasattr(self.source_memory, 'base_dir'):
            # 本地存储
            daily_dir = self.source_memory.base_dir / "day"
            if daily_dir.exists():
                for file in daily_dir.glob("*.md"):
                    date = file.stem
                    content = self.source_memory.read_daily_memory(date)
                    if content is None:
                        continue
                    if self._check_exists_and_skip(date, content, skip_existing, self.target_memory.read_daily_memory):
                        continue
                    if self.target_memory.write_daily_memory(date, content):
                        migrated += 1
                    else:
                        errors.append(f"Failed to write daily memory for {date}")
        return migrated

    def _migrate_weekly_memory(self, skip_existing: bool, errors: List[str]) -> int:
        """迁移所有周记忆"""
        migrated = 0
        if hasattr(self.source_memory, 'base_dir'):
            weekly_dir = self.source_memory.base_dir / "week"
            if weekly_dir.exists():
                for file in weekly_dir.glob("*.md"):
                    year_week = file.stem
                    content = self.source_memory.read_weekly_memory(year_week)
                    if content is None:
                        continue
                    if self._check_exists_and_skip(year_week, content, skip_existing, self.target_memory.read_weekly_memory):
                        continue
                    if self.target_memory.write_weekly_memory(year_week, content):
                        migrated += 1
                    else:
                        errors.append(f"Failed to write weekly memory for {year_week}")
        return migrated

    def _migrate_monthly_memory(self, skip_existing: bool, errors: List[str]) -> int:
        """迁移所有月记忆"""
        migrated = 0
        if hasattr(self.source_memory, 'base_dir'):
            monthly_dir = self.source_memory.base_dir / "month"
            if monthly_dir.exists():
                for file in monthly_dir.glob("*.md"):
                    year_month = file.stem
                    content = self.source_memory.read_monthly_memory(year_month)
                    if content is None:
                        continue
                    if self._check_exists_and_skip(year_month, content, skip_existing, self.target_memory.read_monthly_memory):
                        continue
                    if self.target_memory.write_monthly_memory(year_month, content):
                        migrated += 1
                    else:
                        errors.append(f"Failed to write monthly memory for {year_month}")
        return migrated

    def _migrate_yearly_memory(self, skip_existing: bool, errors: List[str]) -> int:
        """迁移所有年记忆"""
        migrated = 0
        if hasattr(self.source_memory, 'base_dir'):
            yearly_dir = self.source_memory.base_dir / "year"
            if yearly_dir.exists():
                for file in yearly_dir.glob("*.md"):
                    year = file.stem
                    content = self.source_memory.read_yearly_memory(year)
                    if content is None:
                        continue
                    if self._check_exists_and_skip(year, content, skip_existing, self.target_memory.read_yearly_memory):
                        continue
                    if self.target_memory.write_yearly_memory(year, content):
                        migrated += 1
                    else:
                        errors.append(f"Failed to write yearly memory for {year}")
        return migrated

    def _migrate_topic_memory(self, skip_existing: bool, errors: List[str]) -> int:
        """迁移所有主题记忆"""
        migrated = 0
        topics = self.source_memory.list_topics(status="all")
        for topic_info in topics:
            topic = topic_info["name"]
            content = self.source_memory.read_topic_memory(topic)
            if content is None or len(content.strip()) == 0:
                continue
            if self._check_exists_and_skip(topic, content, skip_existing, self.target_memory.read_topic_memory):
                continue
            if self.target_memory.write_topic_memory(topic, content):
                migrated += 1
                # 如果原先是归档，目标也归档
                if topic_info.get("status") == "archived":
                    if hasattr(self.target_memory, 'archive_topic'):
                        self.target_memory.archive_topic(topic)
            else:
                errors.append(f"Failed to write topic memory for {topic}")
        return migrated

    def _check_exists_and_skip(
        self,
        identifier: str,
        new_content: str,
        skip_existing: bool,
        read_func,
    ) -> bool:
        """检查是否已存在并且需要跳过"""
        if not skip_existing:
            return False
        existing = read_func(identifier)
        if existing is None or len(existing.strip()) == 0:
            return False
        # 如果内容相同，也跳过
        if existing.strip() == new_content.strip():
            return True
        return False


class LocalToMcpMigrator(CrossPlatformMigrator):
    """本地存储 (OpenAI) → MCP 客户端 (Claude) 迁移

    将完整灵魂数据从 OpenAI 本地存储迁移到 Claude Desktop 使用的 MCP 服务。
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        mcp_server_command: Optional[str] = None,
    ):
        project_root = project_root or get_project_root()
        # 源：本地存储
        source_p = LocalPersonaStorage(project_root)
        source_s = LocalSoulStateStorage(project_root)
        source_m = LocalMemoryStorage(project_root)
        # 目标：MCP 客户端
        target_p = McpPersonaStorage(mcp_server_command)
        target_s = McpSoulStateStorage(target_p)
        target_m = McpMemoryStorage(target_p)
        super().__init__((source_p, source_s, source_m), (target_p, target_s, target_m))


class McpToLocalMigrator(CrossPlatformMigrator):
    """MCP 客户端 (Claude) → 本地存储 (OpenAI) 迁移

    将完整灵魂数据从 MCP 服务迁移到 OpenAI 本地存储用于独立使用。
    """

    def __init__(
        self,
        project_root: Optional[Path] = None,
        mcp_server_command: Optional[str] = None,
    ):
        project_root = project_root or get_project_root()
        # 源：MCP 客户端
        source_p = McpPersonaStorage(mcp_server_command)
        source_s = McpSoulStateStorage(source_p)
        source_m = McpMemoryStorage(source_p)
        # 目标：本地存储
        target_p = LocalPersonaStorage(project_root)
        target_s = LocalSoulStateStorage(project_root)
        target_m = LocalMemoryStorage(project_root)
        super().__init__((source_p, source_s, source_m), (target_p, target_s, target_m))


def export_archive(
    source_storage: Tuple[BasePersonaStorage, BaseSoulStateStorage, BaseMemoryStorage],
    output_path: Path,
) -> Path:
    """导出完整灵魂数据到 zip 归档文件，用于手动迁移

    Args:
        source_storage: 源存储
        output_path: 输出 zip 文件路径

    Returns:
        创建的 zip 文件路径
    """
    import tempfile
    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)

        # 导出人格
        source_p, source_s, source_m = source_storage
        persona_config = source_p.read_persona_config()
        with open(tmp_path / "persona.json", "w", encoding="utf-8") as f:
            json.dump(persona_config, f, indent=2, ensure_ascii=False)

        # 导出灵魂状态
        soul_state = source_s.read_soul_state()
        with open(tmp_path / "soul_state.json", "w", encoding="utf-8") as f:
            json.dump(soul_state, f, indent=2, ensure_ascii=False)

        # 记忆目录结构
        (tmp_path / "memory" / "day").mkdir(parents=True)
        (tmp_path / "memory" / "week").mkdir()
        (tmp_path / "memory" / "month").mkdir()
        (tmp_path / "memory" / "year").mkdir()
        (tmp_path / "memory" / "topic").mkdir()
        (tmp_path / "memory" / "topic" / "archive").mkdir()

        # 导出所有记忆
        if hasattr(source_m, 'base_dir'):
            # 本地存储，可以直接复制文件
            for period in ["day", "week", "month", "year", "topic"]:
                src_dir = source_m.base_dir / period
                if src_dir.exists():
                    for file in src_dir.glob("*.md"):
                        shutil.copy2(file, tmp_path / "memory" / period / file.name)
            # 复制归档
            src_archive = source_m.base_dir / "topic" / "archive"
            if src_archive.exists():
                for file in src_archive.glob("*.md"):
                    shutil.copy2(file, tmp_path / "memory" / "topic" / "archive" / file.name)
        else:
            # MCP 存储，需要逐个读取
            topics = source_m.list_topics(status="all")
            for topic_info in topics:
                topic = topic_info["name"]
                content = source_m.read_topic_memory(topic)
                if content is not None:
                    if topic_info.get("status") == "archived":
                        out_file = tmp_path / "memory" / "topic" / "archive" / f"{topic}.md"
                    else:
                        out_file = tmp_path / "memory" / "topic" / f"{topic}.md"
                    with open(out_file, "w", encoding="utf-8") as f:
                        f.write(content)

        # 创建 zip
        output_path = output_path.with_suffix('')
        zip_path = shutil.make_archive(
            str(output_path),
            'zip',
            tmp_path,
        )
        return Path(zip_path)


def import_archive(
    archive_path: Path,
    target_storage: Tuple[BasePersonaStorage, BaseSoulStateStorage, BaseMemoryStorage],
    skip_existing: bool = True,
) -> MigrationResult:
    """从 zip 归档导入灵魂数据

    Args:
        archive_path: zip 归档路径
        target_storage: 目标存储
        skip_existing: 是否跳过已存在

    Returns:
        迁移结果
    """
    import tempfile
    errors: List[str] = []
    total_migrated = 0

    with tempfile.TemporaryDirectory() as tmpdir:
        tmp_path = Path(tmpdir)
        # 解压
        with zipfile.ZipFile(archive_path, 'r') as zip_ref:
            zip_ref.extractall(tmp_path)

        target_p, target_s, target_m = target_storage

        # 导入人格
        persona_file = tmp_path / "persona.json"
        if persona_file.exists():
            with open(persona_file, "r", encoding="utf-8") as f:
                persona_config = json.load(f)
            if hasattr(target_p, 'write_persona_config'):
                if target_p.write_persona_config(persona_config):
                    total_migrated += 1
                else:
                    errors.append("Failed to write persona config")
            else:
                errors.append("Target doesn't support writing persona")

        # 导入灵魂状态
        soul_file = tmp_path / "soul_state.json"
        if soul_file.exists():
            with open(soul_file, "r", encoding="utf-8") as f:
                soul_state = json.load(f)
            if hasattr(target_s, 'write_soul_state'):
                if target_s.write_soul_state(soul_state):
                    total_migrated += 1
                else:
                    errors.append("Failed to write soul state")
            else:
                errors.append("Target doesn't support writing soul state")

        # 导入记忆
        memory_dir = tmp_path / "memory"

        # 日记忆
        daily_dir = memory_dir / "day"
        if daily_dir.exists():
            for file in daily_dir.glob("*.md"):
                date = file.stem
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                if len(content.strip()) == 0:
                    continue
                if skip_existing and target_m.read_daily_memory(date) is not None:
                    continue
                if target_m.write_daily_memory(date, content):
                    total_migrated += 1
                else:
                    errors.append(f"Failed to write daily {date}")

        # 周记忆
        weekly_dir = memory_dir / "week"
        if weekly_dir.exists():
            for file in weekly_dir.glob("*.md"):
                year_week = file.stem
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                if len(content.strip()) == 0:
                    continue
                if skip_existing and target_m.read_weekly_memory(year_week) is not None:
                    continue
                if target_m.write_weekly_memory(year_week, content):
                    total_migrated += 1
                else:
                    errors.append(f"Failed to write weekly {year_week}")

        # 月记忆
        monthly_dir = memory_dir / "month"
        if monthly_dir.exists():
            for file in monthly_dir.glob("*.md"):
                year_month = file.stem
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                if len(content.strip()) == 0:
                    continue
                if skip_existing and target_m.read_monthly_memory(year_month) is not None:
                    continue
                if target_m.write_monthly_memory(year_month, content):
                    total_migrated += 1
                else:
                    errors.append(f"Failed to write monthly {year_month}")

        # 年记忆
        yearly_dir = memory_dir / "year"
        if yearly_dir.exists():
            for file in yearly_dir.glob("*.md"):
                year = file.stem
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                if len(content.strip()) == 0:
                    continue
                if skip_existing and target_m.read_yearly_memory(year) is not None:
                    continue
                if target_m.write_yearly_memory(year, content):
                    total_migrated += 1
                else:
                    errors.append(f"Failed to write yearly {year}")

        # 主题记忆
        topic_dir = memory_dir / "topic"
        if topic_dir.exists():
            for file in topic_dir.glob("*.md"):
                topic = file.stem
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                if len(content.strip()) == 0:
                    continue
                if skip_existing and target_m.read_topic_memory(topic) is not None:
                    continue
                if target_m.write_topic_memory(topic, content):
                    total_migrated += 1
                else:
                    errors.append(f"Failed to write topic {topic}")

            # 归档主题
            archive_dir = topic_dir / "archive"
            if archive_dir.exists():
                for file in archive_dir.glob("*.md"):
                    topic = file.stem
                    with open(file, "r", encoding="utf-8") as f:
                        content = f.read()
                    if len(content.strip()) == 0:
                        continue
                    # 先写入再归档
                    if skip_existing and target_m.read_topic_memory(topic) is not None:
                        # 即使跳过也要确保归档状态正确
                        if hasattr(target_m, 'archive_topic'):
                            target_m.archive_topic(topic)
                        continue
                    if target_m.write_topic_memory(topic, content):
                        total_migrated += 1
                        if hasattr(target_m, 'archive_topic'):
                            target_m.archive_topic(topic)
                    else:
                        errors.append(f"Failed to write archived topic {topic}")

    success_overall = len(errors) == 0
    message = f"Import completed: {total_migrated} items imported"
    if errors:
        message += f" with {len(errors)} errors"

    return MigrationResult(
        success=success_overall,
        items_migrated=total_migrated,
        errors=errors,
        message=message
    )
