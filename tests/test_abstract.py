"""
AgentSoul · 核心抽象接口测试
=========================

测试统一抽象接口和基础功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from datetime import datetime
from src.abstract import (
    BasePersonaStorage,
    BaseSoulStateStorage,
    BaseMemoryStorage,
    BaseSkillStorage,
    UnifiedSoulStorage,
    InjectionRollback,
    MemoryConflict,
    SoulVersion,
)
from src.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
    LocalSkillStorage,
)


class TestAbstractInterfaces(unittest.TestCase):
    """测试抽象接口定义"""

    def test_soul_version_dataclass(self):
        """测试 SoulVersion 数据类"""
        version = SoulVersion(
            version="1.0.0",
            timestamp=datetime.now().isoformat(),
            checksum="abc123",
            description="test"
        )
        self.assertEqual(version.version, "1.0.0")
        self.assertEqual(version.checksum, "abc123")

    def test_memory_conflict_dataclass(self):
        """测试 MemoryConflict 数据类"""
        conflict = MemoryConflict(
            topic="test",
            existing_content="old",
            new_content="new",
            conflict_type="size"
        )
        self.assertEqual(conflict.topic, "test")

    def test_injection_rollback(self):
        """测试注入回滚管理器"""
        rollback = InjectionRollback()
        self.assertEqual(len(rollback.list_snapshots()), 0)

    def test_unified_storage_construction(self):
        """测试统一存储构造"""
        p = LocalPersonaStorage()
        s = LocalSoulStateStorage()
        m = LocalMemoryStorage()
        sk = LocalSkillStorage()
        storage = UnifiedSoulStorage(p, s, m, sk)

        self.assertIsNotNone(storage.persona)
        self.assertIsNotNone(storage.soul_state)
        self.assertIsNotNone(storage.memory)
        self.assertIsNotNone(storage.skills)

        context = storage.get_full_context()
        self.assertIn("persona", context)
        self.assertIn("soul_state", context)
        self.assertIn("version", context)


class TestLocalStorage(unittest.TestCase):
    """测试本地存储实现"""

    def test_local_persona_read(self):
        """测试读取人格配置"""
        storage = LocalPersonaStorage()
        config = storage.read_persona_config()
        self.assertTrue("agent" in config or "ai" in config)
        self.assertIn("master", config)
        version = storage.get_version()
        self.assertIsInstance(version, SoulVersion)

    def test_local_soul_state_read_default(self):
        """测试读取默认灵魂状态"""
        storage = LocalSoulStateStorage()
        state = storage.read_soul_state()
        self.assertIn("pleasure", state)
        self.assertIn("arousal", state)
        self.assertIn("dominance", state)
        self.assertIsInstance(state["pleasure"], float)
        self.assertGreaterEqual(state["pleasure"], -1)
        self.assertLessEqual(state["pleasure"], 1)

    def test_local_skill_list_rules(self):
        """测试列出可用规则"""
        storage = LocalSkillStorage()
        rules = storage.list_available_rules()
        self.assertIn("SKILL", rules)
        self.assertIn("soul_base", rules)
        self.assertIn("memory_base", rules)

    def test_local_skill_read(self):
        """测试读取规则"""
        storage = LocalSkillStorage()
        content = storage.read_base_rule("SKILL")
        self.assertIsNotNone(content)
        self.assertGreater(len(content), 0)


if __name__ == "__main__":
    unittest.main()
