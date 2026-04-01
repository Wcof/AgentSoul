"""
AgentSoul · 记忆优先级管理
提供三级优先级管理、自动调整和高优先级记忆检索功能
"""

from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import List, Optional, Dict
import json

from common import log, get_project_root


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


class PriorityManager:
    def __init__(self, storage_path: Optional[Path] = None):
        if storage_path is None:
            storage_path = get_project_root() / "data" / "memories"
        self.storage_path = storage_path
        self.priority_index_file = storage_path / "priority_index.json"
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._priorities: Dict[str, MemoryPriority] = {}
        self._load_index()

    def _load_index(self) -> None:
        if self.priority_index_file.exists():
            try:
                with open(self.priority_index_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    self._priorities = {
                        mem_id: MemoryPriority(
                            memory_id=mem_id,
                            level=PriorityLevel(info["level"]),
                            access_count=info["access_count"],
                            last_accessed=datetime.fromisoformat(info["last_accessed"]),
                            manual_override=info.get("manual_override", False)
                        )
                        for mem_id, info in data.get("priorities", {}).items()
                    }
            except Exception as e:
                log(f"Failed to load priority index: {e}", "WARN")
                self._priorities = {}

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
        except Exception as e:
            log(f"Failed to save priority index: {e}", "ERROR")

    def set_priority(self, memory_id: str, level: PriorityLevel) -> None:
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
        if memory_id in self._priorities:
            return self._priorities[memory_id].level
        return PriorityLevel.MEDIUM

    def record_access(self, memory_id: str) -> None:
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

    def get_high_priority_memories(self, limit: int = 20) -> List[str]:
        high_priority = [
            (mem_id, info.last_accessed)
            for mem_id, info in self._priorities.items()
            if info.level == PriorityLevel.HIGH
        ]
        high_priority.sort(key=lambda x: x[1], reverse=True)
        return [mem_id for mem_id, _ in high_priority[:limit]]

    def get_all_priorities(self) -> List[MemoryPriority]:
        return sorted(
            self._priorities.values(),
            key=lambda x: (
                {"high": 0, "medium": 1, "low": 2}[x.level.value],
                -x.access_count,
                -x.last_accessed.timestamp()
            )
        )

    def reset_priority(self, memory_id: str) -> None:
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
            with open(memory_file, "r", encoding="utf-8") as f:
                memory = json.load(f)

            memory["priority"] = self._priorities[memory_id].level.value

            with open(memory_file, "w", encoding="utf-8") as f:
                json.dump(memory, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"Failed to update memory file priority: {e}", "WARN")
