"""
AgentSoul · 记忆增强模块
提供智能检索、标签系统和优先级管理功能
"""

from .retrieval import MemoryRetriever, SearchResult
from .tags import TagManager, TagInfo
from .priority import PriorityManager, PriorityLevel, MemoryPriority

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
