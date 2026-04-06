"""
AgentSoul · 记忆优先级管理
提供三级优先级管理、自动调整和高优先级记忆检索功能
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path

from common import get_project_root, log
from src.common.cache import TTLCacheBase


class PriorityLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


@dataclass
class MemoryPriority:
    memory_id: str
    level: PriorityLevel
    access_count: int
    last_accessed: datetime
    manual_override: bool = False


class PriorityManager(TTLCacheBase):
    def __init__(self, storage_path: Path | None = None, default_ttl: int = 300):
        super().__init__(default_ttl)
        if storage_path is None:
            storage_path = get_project_root() / "data" / "memories"
        self.storage_path = storage_path
        self.priority_index_file = storage_path / "priority_index.json"
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._priorities: dict[str, MemoryPriority] = {}
        self._load_index()

    def invalidate_cache(self) -> None:
        """Invalidate the priority cache - force reload on next operation."""
        self._priorities = {}
        super().invalidate_cache()

    def _load_index(self) -> None:
        # Return cached copy if still valid
        if self._cache_is_valid():
            return

        self._priorities.clear()

        if self.priority_index_file.exists():
            try:
                with open(self.priority_index_file, encoding="utf-8") as f:
                    data = json.load(f)
                    for mem_id, info in data.get("priorities", {}).items():
                        self._priorities[mem_id] = MemoryPriority(
                            memory_id=mem_id,
                            level=PriorityLevel(info.get("level", "medium")),
                            access_count=info.get("access_count", 0),
                            last_accessed=datetime.fromisoformat(info.get("last_accessed", datetime.now().isoformat())),
                            manual_override=info.get("manual_override", False)
                        )
            except Exception as e:
                log(f"Failed to load priority index: {e}", "WARN")
                self._priorities = {}

        self._update_cache_timestamp()

    def _save_index(self) -> None:
        try:
            data = {
                "priorities": {
                    mem_id: {
                        "level": info.level.value,
                        "access_count": info.access_count,
                        "last_accessed": info.last_accessed.isoformat(),
                        "manual_override": info.manual_override
                    }
                    for mem_id, info in self._priorities.items()
                }
            }
            with open(self.priority_index_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._update_cache_timestamp()
        except Exception as e:
            log(f"Failed to save priority index: {e}", "ERROR")

    def set_priority(self, memory_id: str, level: PriorityLevel) -> None:
        self._load_index()
        if memory_id not in self._priorities:
            self._priorities[memory_id] = MemoryPriority(
                memory_id=memory_id,
                level=level,
                access_count=0,
                last_accessed=datetime.now(),
                manual_override=True
            )
        else:
            self._priorities[memory_id].level = level
            self._priorities[memory_id].manual_override = True

        self._save_index()
        self._update_memory_file_priority(memory_id)

    def get_priority(self, memory_id: str) -> PriorityLevel:
        self._load_index()
        if memory_id in self._priorities:
            return self._priorities[memory_id].level
        return PriorityLevel.MEDIUM

    def record_access(self, memory_id: str) -> None:
        self._load_index()
        now = datetime.now()

        if memory_id not in self._priorities:
            self._priorities[memory_id] = MemoryPriority(
                memory_id=memory_id,
                level=PriorityLevel.MEDIUM,
                access_count=1,
                last_accessed=now,
                manual_override=False
            )
        else:
            self._priorities[memory_id].access_count += 1
            self._priorities[memory_id].last_accessed = now

            if not self._priorities[memory_id].manual_override:
                self._auto_adjust_priority(memory_id)

        self._save_index()
        self._update_memory_file_priority(memory_id)

    def _auto_adjust_priority(self, memory_id: str) -> None:
        priority = self._priorities[memory_id]
        access_count = priority.access_count
        now = datetime.now()
        days_since_access = (now - priority.last_accessed).days

        if access_count >= 10 and days_since_access < 7:
            if priority.level == PriorityLevel.MEDIUM:
                priority.level = PriorityLevel.HIGH
            elif priority.level == PriorityLevel.LOW:
                priority.level = PriorityLevel.MEDIUM
        elif access_count <= 2 and days_since_access > 30:
            if priority.level == PriorityLevel.HIGH:
                priority.level = PriorityLevel.MEDIUM
            elif priority.level == PriorityLevel.MEDIUM:
                priority.level = PriorityLevel.LOW

    def get_high_priority_memories(self, limit: int = 20) -> list[str]:
        self._load_index()
        high_priority = [
            (mem_id, info.last_accessed)
            for mem_id, info in self._priorities.items()
            if info.level == PriorityLevel.HIGH
        ]
        high_priority.sort(key=lambda x: x[1], reverse=True)
        return [mem_id for mem_id, _ in high_priority[:limit]]

    def get_all_priorities(self) -> list[MemoryPriority]:
        self._load_index()
        return sorted(
            self._priorities.values(),
            key=lambda x: (
                {"high": 0, "medium": 1, "low": 2}[x.level.value],
                -x.access_count,
                -x.last_accessed.timestamp()
            )
        )

    def reset_priority(self, memory_id: str) -> None:
        self._load_index()
        if memory_id in self._priorities:
            self._priorities[memory_id].level = PriorityLevel.MEDIUM
            self._priorities[memory_id].manual_override = False
            self._save_index()
            self._update_memory_file_priority(memory_id)

    def _update_memory_file_priority(self, memory_id: str) -> None:
        memory_file = self.storage_path / f"{memory_id}.json"
        if not memory_file.exists():
            return

        try:
            with open(memory_file, encoding="utf-8") as f:
                memory = json.load(f)

            priority_info = self._priorities.get(memory_id)
            if priority_info is not None:
                memory["priority"] = priority_info.level.value
            else:
                # Default to MEDIUM if not in index
                memory["priority"] = PriorityLevel.MEDIUM.value

            with open(memory_file, "w", encoding="utf-8") as f:
                json.dump(memory, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"Failed to update memory file priority: {e}", "WARN")
