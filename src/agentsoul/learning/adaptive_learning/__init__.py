"""
AgentSoul · 自适应学习模块
提供数据收集、偏好学习、PAD 调整和增强 PAD 引擎功能
"""
from __future__ import annotations

from .data_collector import DataCollector, InteractionRecord
from .pad_adjuster import PADAdjuster, PADState
from .pad_engine import PADEngine, PADEnhancedState, DriftReport, DriftSeverity, EventPerturbation, EventType
from .preference_learner import PreferenceLearner, UserPreferences

__version__ = "1.1.0"
__all__ = [
    "DataCollector",
    "InteractionRecord",
    "PADAdjuster",
    "PADState",
    "PADEngine",
    "PADEnhancedState",
    "DriftReport",
    "DriftSeverity",
    "EventPerturbation",
    "EventType",
    "PreferenceLearner",
    "UserPreferences",
]
