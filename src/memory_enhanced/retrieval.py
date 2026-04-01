"""
AgentSoul · 智能检索模块
提供模糊匹配、时间过滤、相关度排序等高级搜索功能
"""

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any
import json
import re

from common import log, get_project_root


@dataclass
class SearchResult:
    memory_id: str
    content: str
    relevance: float
    tags: List[str]
    last_accessed: datetime
    priority: str = "medium"


class MemoryRetriever:
    def __init__(self, storage_path: Optional[Path] = None):
        if storage_path is None:
            storage_path = get_project_root() / "data" / "memories"
        self.storage_path = storage_path
        self.storage_path.mkdir(parents=True, exist_ok=True)

    @staticmethod
    def levenshtein_distance(s1: str, s2: str) -> int:
        if len(s1) < len(s2):
            return MemoryRetriever.levenshtein_distance(s2, s1)

        if len(s2) == 0:
            return len(s1)

        previous_row = range(len(s2) + 1)
        for i, c1 in enumerate(s1):
            current_row = [i + 1]
            for j, c2 in enumerate(s2):
                insertions = previous_row[j + 1] + 1
                deletions = current_row[j] + 1
                substitutions = previous_row[j] + (c1 != c2)
                current_row.append(min(insertions, deletions, substitutions))
            previous_row = current_row

        return previous_row[-1]

    def fuzzy_match_score(self, query: str, text: str) -> float:
        query_lower = query.lower()
        text_lower = text.lower()

        if query_lower in text_lower:
            return 1.0

        query_words = re.findall(r"\w+", query_lower)
        text_words = re.findall(r"\w+", text_lower)

        if not query_words or not text_words:
            return 0.0

        matches = 0
        for q_word in query_words:
            for t_word in text_words:
                distance = self.levenshtein_distance(q_word, t_word)
                max_len = max(len(q_word), len(t_word))
                if max_len > 0 and distance / max_len < 0.4:
                    matches += 1
                    break

        return matches / len(query_words)

    def _load_all_memories(self) -> List[Dict[str, Any]]:
        memories = []
        if not self.storage_path.exists():
            return memories

        for json_file in self.storage_path.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    memory = json.load(f)
                    memory["memory_id"] = json_file.stem
                    memories.append(memory)
            except Exception as e:
                log(f"Failed to load memory {json_file}: {e}", "WARN")

        return memories

    def search(
        self,
        query: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        priority: Optional[str] = None,
        limit: int = 10
    ) -> List[SearchResult]:
        memories = self._load_all_memories()
        results = []

        for memory in memories:
            content = memory.get("content", "")
            memory_tags = memory.get("tags", [])
            memory_priority = memory.get("priority", "medium")
            last_accessed_str = memory.get("last_accessed", "")
            created_at_str = memory.get("created_at", "")

            try:
                if last_accessed_str:
                    last_accessed = datetime.fromisoformat(last_accessed_str)
                elif created_at_str:
                    last_accessed = datetime.fromisoformat(created_at_str)
                else:
                    last_accessed = datetime.now()
            except (ValueError, TypeError):
                last_accessed = datetime.now()

            if start_date and last_accessed < start_date:
                continue
            if end_date and last_accessed > end_date:
                continue

            if priority and memory_priority != priority:
                continue

            if tags:
                if not any(tag.lower() in (t.lower() for t in memory_tags) for tag in tags):
                    continue

            relevance = self.fuzzy_match_score(query, content)
            if relevance > 0:
                results.append(SearchResult(
                    memory_id=memory["memory_id"],
                    content=content,
                    relevance=relevance,
                    tags=memory_tags,
                    last_accessed=last_accessed,
                    priority=memory_priority
                ))

        priority_weights = {"high": 3, "medium": 2, "low": 1}
        results.sort(
            key=lambda r: (r.relevance * priority_weights.get(r.priority, 1), r.last_accessed),
            reverse=True
        )

        return results[:limit]
