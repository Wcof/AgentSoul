"""
AgentSoul · Google Gemini 适配器测试
=========================

测试 Gemini 注入适配器功能
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import tempfile
import unittest
from pathlib import Path

from agentsoul import (
    GeminiInjectionAdapter,
    GeminiInjectionConfig,
)
from agentsoul.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSoulStateStorage,
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


    def test_inject_context_no_injected_content(self):
        """测试当没有任何注入内容时返回原始消息"""
        config = GeminiInjectionConfig(
            include_persona=False,
            include_soul_state=False,
            include_recent_memory=False,
            include_rules=False
        )
        adapter = GeminiInjectionAdapter(config=config)
        messages = [{"role": "user", "parts": [{"text": "Hello"}]}]
        result = adapter.inject_context(messages)
        self.assertEqual(result["messages"], messages)
        self.assertNotIn("system_instruction", result)

    def test_inject_context_without_system_instruction(self):
        """测试不使用 system_instruction 特性，直接插入消息"""
        config = GeminiInjectionConfig(
            use_system_instruction=False
        )
        adapter = GeminiInjectionAdapter(config=config)
        messages = [{"role": "user", "parts": [{"text": "Hello"}]}]
        result = adapter.inject_context(messages)
        self.assertIn("messages", result)
        messages_result = result["messages"]
        self.assertEqual(len(messages_result), 2)
        self.assertEqual(messages_result[0]["role"], "system")

    def test_inject_context_without_system_instruction_existing_system(self):
        """测试不使用 system_instruction 特性，合并到已有 system 消息"""
        config = GeminiInjectionConfig(
            use_system_instruction=False
        )
        adapter = GeminiInjectionAdapter(config=config)
        messages = [
            {"role": "system", "parts": [{"text": "Existing system"}]},
            {"role": "user", "parts": [{"text": "Hello"}]}
        ]
        result = adapter.inject_context(messages)
        messages_result = result["messages"]
        self.assertEqual(len(messages_result), 2)
        # Merged into existing system
        self.assertIn("Existing system", messages_result[0]["parts"][0]["text"])

    def test_inject_context_with_existing_system_instruction(self):
        """测试合并已有的 system_instruction"""
        adapter = GeminiInjectionAdapter()
        messages = [{"role": "user", "parts": [{"text": "Hello"}]}]
        result = adapter.inject_context(messages, existing_system_instruction="Original prompt")
        self.assertIn("system_instruction", result)
        self.assertIn("Original prompt", result["system_instruction"])

    def test_save_daily_summary(self):
        """测试保存对话摘要"""
        import tempfile
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "var" / "data" / "memory" / "day").mkdir(parents=True)

        from agentsoul.storage.local import LocalMemoryStorage

        adapter = GeminiInjectionAdapter(
            memory_storage=LocalMemoryStorage(project_root))

        conversation = [
            {"role": "user", "parts": [{"text": "Hello world"}]}
        ]

        result = adapter.save_daily_summary(conversation, "Response text", "Test summary")
        self.assertTrue(result)
        temp_dir.cleanup()

    def test_save_daily_summary_auto_generate(self):
        """测试自动生成对话摘要"""
        import tempfile
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "var" / "data" / "memory" / "day").mkdir(parents=True)

        from agentsoul.storage.local import LocalMemoryStorage

        adapter = GeminiInjectionAdapter(
            memory_storage=LocalMemoryStorage(project_root))

        conversation = [
            {"role": "user", "parts": [{"text": "First question"}]},
            {"role": "model", "parts": [{"text": "First answer"}]},
            {"role": "user", "parts": [{"text": "Second question " * 20}]},
        ]

        result = adapter.save_daily_summary(conversation, "Last response")
        self.assertTrue(result)
        temp_dir.cleanup()

    def test_build_persona_prompt_minimal(self):
        """测试构建人格提示词最小配置（没有可选字段）"""
        import tempfile
        import yaml
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "config").mkdir()

        persona_config = {
            "ai": {
                "name": "Minimal",
                "role": "Assistant"
            },
            "master": {}
        }
        with open(project_root / "config" / "persona.yaml", "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        from agentsoul.storage.local import LocalPersonaStorage
        adapter = GeminiInjectionAdapter(persona_storage=LocalPersonaStorage(project_root))
        prompt = adapter._build_persona_prompt()

        self.assertIn("Minimal", prompt)
        self.assertIn("Assistant", prompt)
        self.assertNotIn("性格", prompt)
        self.assertNotIn("核心价值观", prompt)
        self.assertNotIn("交互风格", prompt)

        temp_dir.cleanup()

    def test_build_recent_memory_prompt_with_content(self):
        """测试构建最近记忆提示词有内容的情况"""
        import tempfile
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "var" / "data" / "memory" / "day").mkdir(parents=True)

        from agentsoul.storage.local import LocalMemoryStorage
        adapter = GeminiInjectionAdapter(memory_storage=LocalMemoryStorage(project_root))
        today = adapter._today
        with open(project_root / "var" / "data" / "memory" / "day" / f"{today}.md", "w", encoding="utf-8") as f:
            f.write("# Today's memory content")

        prompt = adapter._build_recent_memory_prompt()

        self.assertIn("今日记忆", prompt)
        self.assertIn("memory content", prompt)
        temp_dir.cleanup()

    def test_build_base_rules(self):
        """测试构建基础规则"""
        import tempfile
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "src").mkdir(parents=True)

        from agentsoul.storage.local import LocalSkillStorage
        adapter = GeminiInjectionAdapter(skill_storage=LocalSkillStorage(project_root))
        with open(project_root / "src" / "SKILL.md", "w", encoding="utf-8") as f:
            f.write("# SKILL rules content")

        prompt = adapter._build_base_rules()

        self.assertIn("系统规则", prompt)
        self.assertIn("SKILL", prompt)
        self.assertIn("rules content", prompt)
        temp_dir.cleanup()

    def test_build_base_rules_empty(self):
        """测试构建基础规则没有规则文件"""
        import tempfile
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "src").mkdir(parents=True)

        from agentsoul.storage.local import LocalSkillStorage
        adapter = GeminiInjectionAdapter(skill_storage=LocalSkillStorage(project_root))
        prompt = adapter._build_base_rules()

        self.assertEqual(prompt, "")
        temp_dir.cleanup()

    def test_generate_simple_summary_truncation(self):
        """测试生成简单摘要超长截断"""
        adapter = GeminiInjectionAdapter()
        long_text = "x" * 300
        conversation = [
            {"role": "user", "parts": [{"text": long_text}]},
        ]
        summary = adapter._generate_simple_summary(conversation, "Response text")
        self.assertIn("...", summary)


if __name__ == "__main__":
    unittest.main()
