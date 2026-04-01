"""
AgentSoul · 自适应学习模块
提供数据收集、偏好学习和 PAD 调整功能
"""

from .data_collector import DataCollector, InteractionRecord
from .preference_learner import PreferenceLearner, UserPreferences
from .pad_adjuster import PADAdjuster, PADState

__version__ = "1.0.0"
__all__ = [
    "DataCollector",
    "InteractionRecord",
    "PreferenceLearner",
    "UserPreferences",
    "PADAdjuster",
    "PADState"
]
