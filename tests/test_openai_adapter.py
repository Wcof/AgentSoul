"""
AgentSoul · OpenAI 适配器测试
==========================

测试 OpenAI 注入适配器功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from src import OpenAIInjectionAdapter, InjectionConfig
from src.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
    LocalSkillStorage,
)
from src.abstract import UnifiedSoulStorage


class TestOpenAIAdapter(unittest.TestCase):
    """测试 OpenAI 注入适配器"""

    def test_adapter_construction(self):
        """测试适配器构造"""
        adapter = OpenAIInjectionAdapter()
        self.assertIsNotNone(adapter.storage)
        self.assertIsNotNone(adapter.config)

    def test_adapter_with_custom_storage(self):
        """测试使用自定义存储构造"""
        p = LocalPersonaStorage()
        s = LocalSoulStateStorage()
        m = LocalMemoryStorage()
        sk = LocalSkillStorage()
        storage = UnifiedSoulStorage(p, s, m, sk)
        adapter = OpenAIInjectionAdapter(storage=storage)
        self.assertEqual(adapter.storage, storage)

    def test_adapter_custom_config(self):
        """测试自定义注入配置"""
        config = InjectionConfig(
            include_persona=True,
            include_soul_state=False,
            include_recent_memory=False,
            include_rules=False
        )
        adapter = OpenAIInjectionAdapter(config=config)
        self.assertEqual(adapter.config.include_soul_state, False)
        self.assertEqual(adapter.config.include_recent_memory, False)

    def test_build_persona_prompt(self):
        """测试构建人格提示词"""
        adapter = OpenAIInjectionAdapter()
        prompt = adapter._build_persona_prompt()
        self.assertGreater(len(prompt), 0)
        self.assertIn("你的身份", prompt)

    def test_build_soul_state_prompt(self):
        """测试构建情绪状态提示词"""
        adapter = OpenAIInjectionAdapter()
        prompt = adapter._build_soul_state_prompt()
        self.assertGreater(len(prompt), 0)
        self.assertIn("当前情绪状态", prompt)

    def test_inject_context_empty(self):
        """测试注入到空消息列表"""
        adapter = OpenAIInjectionAdapter()
        messages = [{"role": "user", "content": "Hello"}]
        injected = adapter.inject_context(messages)
        # 应该注入了系统消息在顶部
        self.assertEqual(len(injected), 2)
        self.assertEqual(injected[0]["role"], "system")
        self.assertEqual(injected[1]["role"], "user")

    def test_inject_context_existing_system(self):
        """测试注入到已有系统消息"""
        adapter = OpenAIInjectionAdapter()
        messages = [
            {"role": "system", "content": "Original system"},
            {"role": "user", "content": "Hello"}
        ]
        injected = adapter.inject_context(messages)
        self.assertEqual(len(injected), 2)
        # 应该合并到现有系统消息
        self.assertIn("Original system", injected[0]["content"])
        self.assertEqual(injected[1]["role"], "user")

    def test_get_version(self):
        """测试获取版本"""
        adapter = OpenAIInjectionAdapter()
        version = adapter.get_version()
        self.assertIsNotNone(version.version)
        self.assertIsNotNone(version.timestamp)

    def test_str_representation(self):
        """测试字符串表示"""
        adapter = OpenAIInjectionAdapter()
        repr_str = str(adapter)
        self.assertIn("OpenAIInjectionAdapter", repr_str)


class TestInjectionConfig(unittest.TestCase):
    """测试注入配置"""

    def test_default_config(self):
        """测试默认配置"""
        config = InjectionConfig()
        self.assertTrue(config.include_persona)
        self.assertTrue(config.include_soul_state)
        self.assertEqual(config.max_memory_tokens, 1000)
        self.assertEqual(config.system_prompt_position, "top")


if __name__ == "__main__":
    unittest.main()
