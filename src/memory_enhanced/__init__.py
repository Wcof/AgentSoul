"""
AgentSoul · 记忆增强模块
提供智能检索、标签系统和优先级管理功能
"""
from __future__ import annotations

from .priority import MemoryPriority, PriorityLevel, PriorityManager
from .retrieval import MemoryRetriever, SearchResult
from .tags import TagInfo, TagManager

__version__ = "1.0.0"
__all__ = [
    "MemoryRetriever",
    "SearchResult",
    "TagManager",
    "TagInfo",
    "PriorityManager",
    "PriorityLevel",
    "MemoryPriority"
]
