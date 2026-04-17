"""
AgentSoul · 配置加载器测试
=========================

测试 src/config_loader.py ConfigLoader 和数据类
"""
from __future__ import annotations

import os
import sys
import unittest
import tempfile
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pathlib import Path
import yaml

from agentsoul.config.config_loader import (
    AgentConfig,
    MasterConfig,
    BehaviorConfig,
    PersonaConfig,
    ConfigLoader,
    create_default_persona,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestDataClasses(BaseTest):
    """测试数据类默认值"""

    def test_agent_config_defaults(self):
        """测试 AgentConfig 默认值"""
        config = AgentConfig()
        assert config.name == "Agent"
        assert config.nickname == ""
        assert config.role == "AI Assistant"
        assert config.personality == []
        assert config.core_values == []

    def test_master_config_defaults(self):
        """测试 MasterConfig 默认值"""
        config = MasterConfig()
        assert config.name == ""
        assert config.nickname == []
        assert config.timezone == "Asia/Shanghai"
        assert config.labels == []

    def test_behavior_config_defaults(self):
        """测试 BehaviorConfig 默认值"""
        config = BehaviorConfig()
        assert config.enabled is True
        assert config.auto_memory is True
        assert config.emotional_response is True
        assert config.task_scheduling is True
        assert config.memory_daily_summary is True
        assert config.response_length_limit == 0
        assert config.forbidden_topics == []

    def test_persona_config_defaults(self):
        """测试 PersonaConfig 默认值"""
        config = PersonaConfig()
        assert isinstance(config.ai, AgentConfig)
        assert isinstance(config.master, MasterConfig)


class TestConfigLoader(BaseTest):
    """测试 ConfigLoader 功能"""

    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.TemporaryDirectory()
        self.project_root = Path(self.temp_dir.name)
        (self.project_root / "config").mkdir()

    def tearDown(self):
        """清理临时目录"""
        self.temp_dir.cleanup()

    def test_loader_construction(self):
        """测试加载器初始化"""
        loader = ConfigLoader(self.project_root)
        assert loader.project_root == self.project_root
        assert loader._persona_cache is None
        assert loader._behavior_cache is None

    def test_invalidate_cache(self):
        """测试清空缓存"""
        loader = ConfigLoader(self.project_root)
        # Create some cached data
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "Test"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        loader.load_persona_config(persona_path)
        assert loader._persona_cache is not None

        loader.invalidate_cache()
        assert loader._persona_cache is None
        assert loader._behavior_cache is None

    def test_load_yaml_file_not_exists(self):
        """测试加载不存在的 YAML 返回空字典"""
        loader = ConfigLoader(self.project_root)
        result = loader.load_yaml(self.project_root / "nonexistent.yaml")
        assert result == {}

    def test_load_yaml_empty_file(self):
        """测试加载空 YAML 返回空字典"""
        loader = ConfigLoader(self.project_root)
        fpath = self.project_root / "empty.yaml"
        fpath.touch()
        result = loader.load_yaml(fpath)
        assert result == {}

    def test_load_persona_minimal_config(self):
        """测试加载最小配置"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {
                "name": "TestAgent"
            },
            "master": {
                "name": "TestUser"
            }
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        config = loader.load_persona_config(persona_path)
        assert config.ai.name == "TestAgent"
        assert config.master.name == "TestUser"
        # Defaults should be filled
        assert config.ai.role == "AI Assistant"
        assert config.ai.personality == []

    def test_load_persona_full_config(self):
        """测试加载完整配置"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {
                "name": "FullAgent",
                "nickname": "Fully",
                "role": "Full Test Assistant",
                "personality": ["friendly", "helpful"],
                "core_values": ["privacy", "quality"],
                "interaction_style": {
                    "tone": "friendly",
                    "language": "chinese"
                }
            },
            "master": {
                "name": "FullUser",
                "nicknames": ["User", "Master"],
                "timezone": "America/New_York",
                "labels": ["developer", "tester"]
            }
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        config = loader.load_persona_config(persona_path)
        assert config.ai.name == "FullAgent"
        assert config.ai.nickname == "Fully"
        assert config.ai.role == "Full Test Assistant"
        assert config.ai.personality == ["friendly", "helpful"]
        assert config.ai.core_values == ["privacy", "quality"]
        assert config.ai.interaction_style == {"tone": "friendly", "language": "chinese"}
        assert config.master.name == "FullUser"
        assert config.master.nickname == ["User", "Master"]
        assert config.master.timezone == "America/New_York"
        assert config.master.labels == ["developer", "tester"]

    def test_safe_get_non_dict_data(self):
        """测试_safe_get 处理非字典数据返回默认值"""
        loader = ConfigLoader(self.project_root)
        result = loader._safe_get("not a dict", "key", "default")
        assert result == "default"

    def test_safe_get_key_missing(self):
        """测试_safe_get 键缺失返回默认值"""
        loader = ConfigLoader(self.project_root)
        result = loader._safe_get({"a": 1}, "b", "default")
        assert result == "default"

    def test_safe_get_value_none(self):
        """测试_safe_get 值为 None 返回默认值"""
        loader = ConfigLoader(self.project_root)
        result = loader._safe_get({"a": None}, "a", "default")
        assert result == "default"

    def test_safe_get_empty_string_preserved(self):
        """测试_safe_get 保留空字符串（用户明确设置的）"""
        loader = ConfigLoader(self.project_root)
        result = loader._safe_get({"name": ""}, "name", "default")
        assert result == ""

    def test_to_list_already_list(self):
        """测试_to_list 已经是列表直接返回"""
        loader = ConfigLoader(self.project_root)
        result = loader._to_list([1, 2, 3])
        assert result == [1, 2, 3]

    def test_to_list_tuple(self):
        """测试_to_list 元组转换为列表"""
        loader = ConfigLoader(self.project_root)
        result = loader._to_list((1, 2, 3))
        assert result == [1, 2, 3]

    def test_to_list_comma_separated_string(self):
        """测试_to_list 逗号分隔字符串转换为列表"""
        loader = ConfigLoader(self.project_root)
        result = loader._to_list("a, b, c")
        assert result == ["a", "b", "c"]

    def test_to_list_single_string(self):
        """测试_to_list 单个字符串转换为单元素列表"""
        loader = ConfigLoader(self.project_root)
        result = loader._to_list("single")
        assert result == ["single"]

    def test_to_list_empty_string(self):
        """测试_to_list 空字符串返回空列表"""
        loader = ConfigLoader(self.project_root)
        result = loader._to_list("")
        assert result == []

    def test_to_list_other_type(self):
        """测试_to_list 其他类型返回空列表"""
        loader = ConfigLoader(self.project_root)
        result = loader._to_list(123)
        assert result == []

    def test_get_agent_name(self):
        """测试获取 Agent 名称"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "MyAgent"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        name = loader.get_agent_name(persona_path)
        assert name == "MyAgent"

    def test_get_agent_name_empty_uses_default(self):
        """测试空 Agent 名称使用默认值"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": ""}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        name = loader.get_agent_name(persona_path)
        assert name == "Agent"  # Default

    def test_get_master_name_empty_returns_default_text(self):
        """测试空 Master 名称返回默认文本"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "Test"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        name = loader.get_master_name(persona_path)
        assert name == "主人"

    def test_get_master_nicknames_empty_returns_default(self):
        """测试空昵称返回默认['主人']"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "Test"},
            "master": {"name": "User"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        nicks = loader.get_master_nicknames(persona_path)
        assert nicks == ["主人"]

    def test_get_effective_master_name_uses_nickname_first(self):
        """测试获取有效 Master 名称优先使用昵称第一个"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "Test"},
            "master": {
                "name": "Full Name",
                "nicknames": ["Nick", "Two"]
            }
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        name = loader.get_effective_master_name(persona_path)
        assert name == "Nick"

    def test_get_effective_master_name_falls_back_to_name(self):
        """测试获取有效 Master 名称没有昵称回退到名称"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "Test"},
            "master": {"name": "UserName"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        name = loader.get_effective_master_name(persona_path)
        assert name == "UserName"

    def test_is_config_valid_file_not_exists(self):
        """测试配置文件不存在返回 False"""
        loader = ConfigLoader(self.project_root)
        result = loader.is_config_valid(self.project_root / "nonexistent.yaml")
        assert result is False

    def test_is_config_valid_valid_config(self):
        """测试有效配置返回 True"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "Test"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        result = loader.is_config_valid(persona_path)
        assert result is True

    def test_is_config_valid_no_agent_name_returns_false(self):
        """测试没有 Agent 名称返回 False
        _safe_get preserves explicitly set empty string, so name becomes "" → bool("") is False
        """
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": ""}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        result = loader.is_config_valid(persona_path)
        assert result is False

    def test_is_config_valid_exception_returns_false(self):
        """测试异常时返回 False"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        # Invalid YAML
        with open(persona_path, "w", encoding="utf-8") as f:
            f.write("invalid: yaml: :::")

        result = loader.is_config_valid(persona_path)
        assert result is False

    def test_load_behavior_defaults_when_file_missing(self):
        """测试行为配置文件缺失使用所有默认值"""
        loader = ConfigLoader(self.project_root)
        behavior = loader.load_behavior_config(self.project_root / "nonexistent.yaml")
        assert behavior.enabled is True
        assert behavior.auto_memory is True
        assert behavior.emotional_response is True

    def test_load_behavior_custom_values(self):
        """测试加载自定义行为配置"""
        loader = ConfigLoader(self.project_root)
        behavior_path = self.project_root / "config" / "behavior.yaml"
        behavior_config = {
            "enabled": True,
            "auto_memory": False,
            "emotional_response": True,
            "task_scheduling": False,
            "response_length_limit": 1000,
            "forbidden_topics": "politics, religion",
            "custom_settings": {
                "custom_key": "custom_value"
            }
        }
        with open(behavior_path, "w", encoding="utf-8") as f:
            yaml.dump(behavior_config, f)

        behavior = loader.load_behavior_config(behavior_path)
        assert behavior.enabled is True
        assert behavior.auto_memory is False
        assert behavior.emotional_response is True
        assert behavior.task_scheduling is False
        assert behavior.response_length_limit == 1000
        assert behavior.forbidden_topics == ["politics", "religion"]
        assert behavior.custom_settings == {"custom_key": "custom_value"}

    def test_cache_returns_cached_when_valid(self):
        """测试缓存有效时返回缓存"""
        loader = ConfigLoader(self.project_root, default_ttl=300)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {"name": "CacheTest"}
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        # First load
        first = loader.load_persona_config(persona_path)
        assert first.ai.name == "CacheTest"
        # Second load should hit cache
        second = loader.load_persona_config(persona_path)
        assert second is first  # Same object cached

    def test_to_legacy_format(self):
        """测试转换为传统格式"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {
                "name": "LegacyTest",
                "nickname": "Legacy",
                "role": "Test Role",
                "personality": ["test"],
                "core_values": ["value"],
                "interaction_style": {"key": "val"}
            },
            "master": {
                "name": "LegacyUser",
                "nickname": ["User"],
                "timezone": "Europe/London",
                "labels": ["test"]
            }
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        legacy = loader.to_legacy_format(persona_path)
        assert legacy["ai"]["name"] == "LegacyTest"
        assert legacy["ai"]["nickname"] == "Legacy"
        assert legacy["master"]["name"] == "LegacyUser"
        assert legacy["master"]["timezone"] == "Europe/London"

    def test_create_default_persona(self):
        """测试创建默认人格配置文件"""
        output_path = self.project_root / "config" / "persona.yaml"
        create_default_persona(output_path)
        assert output_path.exists()
        with open(output_path, encoding="utf-8") as f:
            data = yaml.safe_load(f)
        assert "agent" in data
        assert "master" in data
        assert data["agent"]["name"] == "Agent"

    def test_cache_is_valid_returns_false_when_no_cache(self):
        """测试缓存不存在时返回 False"""
        loader = ConfigLoader(self.project_root)
        assert not loader._cache_is_valid()

    def test_behavior_uses_cache_when_valid(self):
        """测试行为配置使用缓存"""
        loader = ConfigLoader(self.project_root)
        behavior_path = self.project_root / "config" / "behavior.yaml"
        with open(behavior_path, "w", encoding="utf-8") as f:
            yaml.dump({"enabled": False}, f)

        # Need to load persona first to get cache validity
        persona_path = self.project_root / "config" / "persona.yaml"
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump({"agent": {"name": "Test"}}, f)
        loader.load_persona_config(persona_path)

        first = loader.load_behavior_config(behavior_path)
        assert first.enabled is False
        # Second load should hit cache (same object identity) when cache is valid
        second = loader.load_behavior_config(behavior_path)
        assert second is first

    def test_validate_current_config(self):
        """测试验证当前配置"""
        loader = ConfigLoader(self.project_root)
        persona_path = self.project_root / "config" / "persona.yaml"
        persona_config = {
            "agent": {
                "name": "Test",
                "interaction_style": {
                    "tone": "invalid"  # Invalid tone
                }
            }
        }
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(persona_config, f)

        errors = loader.validate_current_config(persona_path, log_errors=False)
        # Should have an error for invalid tone
        assert len(errors) > 0
        assert any("语气" in err.message for err in errors)


if __name__ == "__main__":
    import pytest
    pytest.main([__file__, "-v"])
