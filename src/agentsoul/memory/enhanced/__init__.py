"""
AgentSoul · 记忆增强模块
提供智能检索、标签系统、优先级管理、语义搜索、事实提取和记忆合并功能
"""
from __future__ import annotations

from .priority import MemoryPriority, PriorityLevel, PriorityManager
from .retrieval import MemoryRetriever, SearchResult
from .tags import TagInfo, TagManager
from .semantic import EmbeddingService, SemanticRetriever, VectorStore
from .fact_extractor import FactExtractor, ExtractedFact
from .memory_consolidator import MemoryConsolidator, ConsolidationResult, ConsolidationStatus

__version__ = "1.2.0"
__all__ = [
    "MemoryRetriever",
    "SearchResult",
    "TagManager",
    "TagInfo",
    "PriorityManager",
    "PriorityLevel",
    "MemoryPriority",
    "EmbeddingService",
    "SemanticRetriever",
    "VectorStore",
    "FactExtractor",
    "ExtractedFact",
    "MemoryConsolidator",
    "ConsolidationResult",
    "ConsolidationStatus",
]
