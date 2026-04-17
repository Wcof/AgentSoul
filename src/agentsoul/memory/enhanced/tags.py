"""
AgentSoul · 记忆标签系统
提供标签管理、标签统计和自动标签建议功能
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

from agentsoul.common import get_project_root, log
from agentsoul.common.cache import TTLCacheBase


@dataclass
class TagInfo:
    name: str
    count: int
    last_used: datetime


class TagManager(TTLCacheBase):
    def __init__(self, storage_path: Path | None = None, default_ttl: int = 300):
        super().__init__(default_ttl)
        if storage_path is None:
            storage_path = get_project_root() / "var" / "data" / "memories"
        self.storage_path = storage_path
        self.tags_index_file = storage_path / "tags_index.json"
        self.storage_path.mkdir(parents=True, exist_ok=True)
        self._tags_cache: dict[str, TagInfo] = {}
        self._memory_tags: dict[str, set[str]] = {}
        self._load_index()

    def invalidate_cache(self) -> None:
        """Invalidate the tags cache - force reload on next operation."""
        self._tags_cache = {}
        self._memory_tags = {}
        super().invalidate_cache()

    def _load_index(self) -> None:
        # Return cached copy if still valid
        if self._cache_is_valid():
            return

        self._tags_cache = {}
        self._memory_tags = {}

        if self.tags_index_file.exists():
            try:
                with open(self.tags_index_file, encoding="utf-8") as f:
                    data = json.load(f)
                    self._tags_cache = {
                        name: TagInfo(
                            name=name,
                            count=info["count"],
                            last_used=datetime.fromisoformat(info["last_used"])
                        )
                        for name, info in data.get("tags", {}).items()
                    }
                    self._memory_tags = {
                        mem_id: set(tags)
                        for mem_id, tags in data.get("memory_tags", {}).items()
                    }
            except Exception as e:
                log(f"Failed to load tags index: {e}", "WARN")
                self._tags_cache = {}
                self._memory_tags = {}

        self._update_cache_timestamp()

    def _save_index(self) -> None:
        try:
            data = {
                "tags": {
                    name: {
                        "count": info.count,
                        "last_used": info.last_used.isoformat()
                    }
                    for name, info in self._tags_cache.items()
                },
                "memory_tags": {
                    mem_id: list(tags)
                    for mem_id, tags in self._memory_tags.items()
                }
            }
            with open(self.tags_index_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            self._update_cache_timestamp()
        except Exception as e:
            log(f"Failed to save tags index: {e}", "ERROR")

    def add_tags(self, memory_id: str, tags: list[str]) -> None:
        self._load_index()
        if memory_id not in self._memory_tags:
            self._memory_tags[memory_id] = set()

        current_tags = self._memory_tags[memory_id]
        now = datetime.now()

        for tag in tags:
            tag_lower = tag.strip().lower()
            if tag_lower and tag_lower not in current_tags:
                current_tags.add(tag_lower)

                if tag_lower not in self._tags_cache:
                    self._tags_cache[tag_lower] = TagInfo(
                        name=tag_lower,
                        count=0,
                        last_used=now
                    )

                self._tags_cache[tag_lower].count += 1
                self._tags_cache[tag_lower].last_used = now

        self._save_index()
        self._update_memory_file_tags(memory_id)

    def remove_tags(self, memory_id: str, tags: list[str]) -> None:
        self._load_index()
        if memory_id not in self._memory_tags:
            return

        current_tags = self._memory_tags[memory_id]

        for tag in tags:
            tag_lower = tag.strip().lower()
            if tag_lower in current_tags:
                current_tags.remove(tag_lower)

                if tag_lower in self._tags_cache:
                    self._tags_cache[tag_lower].count -= 1
                    if self._tags_cache[tag_lower].count <= 0:
                        del self._tags_cache[tag_lower]

        if not current_tags:
            del self._memory_tags[memory_id]

        self._save_index()
        self._update_memory_file_tags(memory_id)

    def get_tags(self, memory_id: str) -> list[str]:
        self._load_index()
        return list(self._memory_tags.get(memory_id, set()))

    def list_all_tags(self, min_count: int = 1) -> list[TagInfo]:
        self._load_index()
        tags = [
            info for info in self._tags_cache.values()
            if info.count >= min_count
        ]
        return sorted(tags, key=lambda t: (-t.count, -t.last_used.timestamp()))

    def suggest_tags(self, content: str, limit: int = 5) -> list[str]:
        self._load_index()
        words = re.findall(r"[\w\u4e00-\u9fff]+", content.lower())
        suggestions: dict[str, int] = {}

        for tag in self._tags_cache:
            tag_parts = re.findall(r"[\w\u4e00-\u9fff]+", tag)
            for part in tag_parts:
                if part in words:
                    suggestions[tag] = suggestions.get(tag, 0) + self._tags_cache[tag].count

        sorted_suggestions = sorted(
            suggestions.keys(),
            key=lambda k: (-suggestions[k], -self._tags_cache[k].count)
        )

        return sorted_suggestions[:limit]

    def _update_memory_file_tags(self, memory_id: str) -> None:
        memory_file = self.storage_path / f"{memory_id}.json"
        if not memory_file.exists():
            return

        try:
            with open(memory_file, encoding="utf-8") as f:
                memory = json.load(f)

            memory["tags"] = list(self._memory_tags.get(memory_id, set()))

            with open(memory_file, "w", encoding="utf-8") as f:
                json.dump(memory, f, ensure_ascii=False, indent=2)
        except Exception as e:
            log(f"Failed to update memory file tags: {e}", "WARN")
