"""
AgentSoul · Google Gemini 适配器测试
=========================

测试 Gemini 注入适配器功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
import tempfile
from pathlib import Path

from src import (
    GeminiInjectionAdapter,
    GeminiInjectionConfig,
)
from src.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestGeminiAdapter(BaseTest):
    """测试 Gemini 注入适配器"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)

        # 创建必要目录结构
        (self.project_root / "config").mkdir()

        # 创建测试人格配置
        persona_config = {
            "ai": {
                "name": "TestAgent",
                "role": "Test Assistant",
                "personality": ["friendly", "helpful"],
                "core_values": ["user_first"],
                "interaction_style": {
                    "tone": "friendly",
                    "language": "chinese",
                }
            },
            "master": {
                "name": "TestUser",
            }
        }
        import yaml
        with open(self.project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_adapter_construction(self):
        """测试适配器初始化"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
            soul_state_storage=LocalSoulStateStorage(self.project_root),
            memory_storage=LocalMemoryStorage(self.project_root),
        )
        self.assertIsNotNone(adapter)
        self.assertIsNotNone(adapter.storage)
        self.assertIsNotNone(adapter.config)

    def test_custom_config(self):
        """测试自定义配置"""
        config = GeminiInjectionConfig(
            include_persona=True,
            include_soul_state=False,
            include_recent_memory=False,
            include_rules=False,
        )
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
            config=config,
        )
        self.assertEqual(adapter.config.include_soul_state, False)
        self.assertEqual(adapter.config.include_recent_memory, False)

    def test_build_persona_prompt(self):
        """测试构建人格提示词"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        prompt = adapter._build_persona_prompt()
        self.assertNotEmpty(prompt)
        self.assertIn("TestAgent", prompt)
        self.assertIn("Test Assistant", prompt)
        self.assertIn("friendly", prompt)
        self.assertIn("TestUser", prompt)

    def test_build_soul_state_prompt(self):
        """测试构建情绪状态提示词"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        prompt = adapter._build_soul_state_prompt()
        self.assertNotEmpty(prompt)
        self.assertIn("愉悦度", prompt)
        self.assertIn("唤醒度", prompt)
        self.assertIn("支配度", prompt)

    def test_inject_context_empty(self):
        """测试注入到空消息列表"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        result = adapter.inject_context([], use_system_instruction=False)
        messages = result["messages"]
        self.assertEqual(len(messages), 1)
        self.assertEqual(messages[0]["role"], "system")
        self.assertNotEmpty(messages[0]["parts"][0]["text"])

    def test_inject_context_with_system_instruction(self):
        """测试使用 Gemini system_instruction 特性"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        messages = [
            {"role": "user", "parts": [{"text": "Hello"}]}
        ]
        result = adapter.inject_context(messages, "Existing system prompt")
        self.assertIn("system_instruction", result)
        self.assertNotEmpty(result["system_instruction"])
        self.assertIn("Existing system prompt", result["system_instruction"])
        # 消息列表保持不变
        self.assertEqual(len(result["messages"]), 1)

    def test_inject_context_to_list(self):
        """测试简化接口直接返回消息列表"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        messages = [
            {"role": "user", "parts": [{"text": "Hello"}]}
        ]
        result = adapter.inject_context_to_list(messages)
        self.assertEqual(len(result), 2)
        # 系统提示在顶部
        self.assertEqual(result[0]["role"], "system")

    def test_get_version(self):
        """测试获取版本信息"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        version = adapter.get_version()
        self.assertNotEmpty(version.version)
        self.assertNotEmpty(version.timestamp)

    def test_str_representation(self):
        """测试字符串表示"""
        adapter = GeminiInjectionAdapter(
            persona_storage=LocalPersonaStorage(self.project_root),
        )
        string_repr = str(adapter)
        self.assertNotEmpty(string_repr)
        self.assertIn("GeminiInjectionAdapter", string_repr)
        self.assertIn("TestAgent", string_repr)


if __name__ == "__main__":
    unittest.main()
