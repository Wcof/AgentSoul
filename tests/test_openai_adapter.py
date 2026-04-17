"""
AgentSoul · OpenAI 适配器测试
==========================

测试 OpenAI 注入适配器功能
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest

from agentsoul import InjectionConfig, OpenAIInjectionAdapter
from agentsoul.abstract import UnifiedSoulStorage
from agentsoul.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSkillStorage,
    LocalSoulStateStorage,
)


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


    def test_inject_context_no_injected_content(self):
        """测试当没有任何注入内容时返回原始消息"""
        config = InjectionConfig(
            include_persona=False,
            include_soul_state=False,
            include_recent_memory=False,
            include_rules=False
        )
        adapter = OpenAIInjectionAdapter(config=config)
        messages = [{"role": "user", "content": "Hello"}]
        result = adapter.inject_context(messages)
        self.assertEqual(result, messages)

    def test_inject_context_system_prompt_position_bottom(self):
        """测试系统提示插入到底部"""
        config = InjectionConfig(
            system_prompt_position="bottom"
        )
        adapter = OpenAIInjectionAdapter(config=config)
        messages = [
            {"role": "user", "content": "Hello"}
        ]
        result = adapter.inject_context(messages)
        # Injected system should be last message
        self.assertEqual(len(result), 2)
        self.assertEqual(result[-1]["role"], "system")

    def test_inject_context_system_prompt_bottom_with_existing_system(self):
        """测试系统提示插入到底部找到最后一个系统消息后"""
        config = InjectionConfig(
            system_prompt_position="bottom"
        )
        adapter = OpenAIInjectionAdapter(config=config)
        messages = [
            {"role": "system", "content": "First system"},
            {"role": "user", "content": "User message"},
            {"role": "system", "content": "Second system"},
            {"role": "assistant", "content": "Response"}
        ]
        original_length = len(messages)
        result = adapter.inject_context(messages)
        self.assertEqual(len(result), original_length + 1)
        # Inserted after last system at index 2
        self.assertEqual(result[3]["role"], "system")

    def test_inject_context_system_prompt_bottom_no_existing_system(self):
        """测试系统提示插入到底部没有已有系统消息，直接追加"""
        config = InjectionConfig(
            system_prompt_position="bottom"
        )
        adapter = OpenAIInjectionAdapter(config=config)
        messages = [
            {"role": "user", "content": "Hello"}
        ]
        result = adapter.inject_context(messages)
        self.assertEqual(len(result), 2)
        self.assertEqual(result[-1]["role"], "system")

    def test_save_daily_summary(self):
        """测试保存对话摘要"""
        import tempfile
        from pathlib import Path
        temp_dir = tempfile.TemporaryDirectory()
        project_root = Path(temp_dir.name)
        (project_root / "var" / "data" / "memory" / "day").mkdir(parents=True)

        from agentsoul.storage.local import LocalMemoryStorage

        adapter = OpenAIInjectionAdapter(
            memory_storage=LocalMemoryStorage(project_root))

        conversation = [
            {"role": "user", "content": "Hello world"},
            {"role": "assistant", "content": "Hi there"}
        ]

        result = adapter.save_daily_summary(conversation, "Test summary")
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

        adapter = OpenAIInjectionAdapter(
            memory_storage=LocalMemoryStorage(project_root))

        conversation = [
            {"role": "user", "content": "First question"},
            {"role": "assistant", "content": "First answer"},
            {"role": "user", "content": "Second question with very long content that should be truncated because it exceeds two hundred characters... " * 10},
        ]

        result = adapter.save_daily_summary(conversation)
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
        adapter = OpenAIInjectionAdapter(persona_storage=LocalPersonaStorage(project_root))
        prompt = adapter._build_persona_prompt()

        self.assertIn("Minimal", prompt)
        self.assertIn("Assistant", prompt)
        # No personality section should not be present
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
        adapter = OpenAIInjectionAdapter(memory_storage=LocalMemoryStorage(project_root))
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
        (project_root / "src" / "agentsoul" / "templates").mkdir(parents=True)

        from agentsoul.storage.local import LocalSkillStorage
        adapter = OpenAIInjectionAdapter(skill_storage=LocalSkillStorage(project_root))
        with open(project_root / "src" / "agentsoul" / "templates" / "SKILL.md", "w", encoding="utf-8") as f:
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
        (project_root / "src" / "agentsoul" / "templates").mkdir(parents=True)

        from agentsoul.storage.local import LocalSkillStorage
        adapter = OpenAIInjectionAdapter(skill_storage=LocalSkillStorage(project_root))
        prompt = adapter._build_base_rules()

        self.assertEqual(prompt, "")
        temp_dir.cleanup()

    def test_generate_simple_summary_truncation(self):
        """测试生成简单摘要超长截断"""
        adapter = OpenAIInjectionAdapter()
        long_text = "x" * 300
        conversation = [
            {"role": "user", "content": long_text},
            {"role": "assistant", "content": "Response"},
        ]
        summary = adapter._generate_simple_summary(conversation)
        self.assertIn("...", summary)
        self.assertLessEqual(len(summary), 500)


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
