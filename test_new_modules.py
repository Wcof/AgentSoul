#!/usr/bin/env python3
"""
测试新模块的基本功能
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

print("=== 测试记忆增强模块 ===")
try:
    from src.memory_enhanced import (
        MemoryRetriever,
        SearchResult,
        TagManager,
        TagInfo,
        PriorityManager,
        PriorityLevel,
        MemoryPriority
    )
    print("✓ 记忆增强模块导入成功")

    retriever = MemoryRetriever()
    print("✓ MemoryRetriever 初始化成功")

    tag_manager = TagManager()
    print("✓ TagManager 初始化成功")

    priority_manager = PriorityManager()
    print("✓ PriorityManager 初始化成功")

except Exception as e:
    print(f"✗ 记忆增强模块失败: {e}")

print("\n=== 测试自适应学习模块 ===")
try:
    from src.adaptive_learning import (
        DataCollector,
        InteractionRecord,
        PreferenceLearner,
        UserPreferences,
        PADAdjuster,
        PADState
    )
    print("✓ 自适应学习模块导入成功")

    data_collector = DataCollector()
    print("✓ DataCollector 初始化成功")

    preference_learner = PreferenceLearner()
    print("✓ PreferenceLearner 初始化成功")

    pad_adjuster = PADAdjuster()
    print("✓ PADAdjuster 初始化成功")

except Exception as e:
    print(f"✗ 自适应学习模块失败: {e}")
    import traceback
    traceback.print_exc()

print("\n=== 所有测试完成 ===")
