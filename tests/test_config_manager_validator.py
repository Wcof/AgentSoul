"""
AgentSoul · 配置验证器测试
=============================

测试 src/config_manager/validator.py ConfigValidator
"""
from __future__ import annotations

import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from agentsoul.config.config_manager.validator import (
    ValidationError,
    ConfigValidator,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestValidationError(BaseTest):
    """测试 ValidationError dataclass"""

    def test_creation_default_severity(self):
        """测试创建验证错误默认 severity"""
        error = ValidationError(field="name", message="cannot be empty")
        self.assertEqual(error.field, "name")
        self.assertEqual(error.message, "cannot be empty")
        self.assertEqual(error.severity, "error")

    def test_creation_custom_severity(self):
        """测试创建验证错误自定义 severity"""
        error = ValidationError(field="field", message="warning", severity="warning")
        self.assertEqual(error.severity, "warning")


class TestConfigValidator(BaseTest):
    """测试 ConfigValidator"""

    def setUp(self):
        self.validator = ConfigValidator()

    def test_valid_empty_config(self):
        """测试空配置返回错误"""
        config = {}
        errors = self.validator.validate(config)
        self.assertGreater(len(errors), 0)
        # Should have error about missing agent
        self.assertTrue(any(e.field == "agent" for e in errors))

    def test_valid_minimal_valid_config(self):
        """测试最小有效配置"""
        config = {
            "agent": {
                "name": "TestAgent"
            }
        }
        errors = self.validator.validate(config)
        # Only warnings about missing master/behavior
        error_count = sum(1 for e in errors if e.severity == "error")
        self.assertEqual(error_count, 0)
        self.assertTrue(self.validator.is_valid(config))

    def test_valid_full_valid_config(self):
        """测试完整有效配置"""
        config = {
            "agent": {
                "name": "TestAgent",
                "role": "Test Assistant",
                "personality": ["friendly", "helpful"],
                "core_values": ["user_privacy"],
                "interaction_style": {
                    "tone": "friendly",
                    "language": "chinese",
                    "emoji_usage": "minimal"
                }
            },
            "master": {
                "name": "User",
                "timezone": "Asia/Shanghai"
            },
            "behavior": {
                "enabled": True,
                "auto_memory": True,
                "emotional_response": True,
                "task_scheduling": False,
                "memory_daily_summary": True,
                "priority": ["privacy", "task_completion"]
            }
        }
        errors = self.validator.validate(config)
        error_count = sum(1 for e in errors if e.severity == "error")
        self.assertEqual(error_count, 0)
        self.assertTrue(self.validator.is_valid(config))

    def test_invalid_personality_not_list(self):
        """测试 personality 不是列表"""
        config = {
            "agent": {
                "name": "Test",
                "personality": "friendly"  # should be list
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("personality 必须是列表类型" in e.message for e in errors))

    def test_invalid_personality_item_not_string(self):
        """测试 personality 列表元素不是字符串"""
        config = {
            "agent": {
                "name": "Test",
                "personality": [123, "friendly"]
            }
        }
        errors = self.validator.validate(config)
        # Should be a warning
        self.assertTrue(any("personality 列表元素必须是字符串类型" in e.message for e in errors))
        # Still passes validation (only warning)
        self.assertTrue(self.validator.is_valid(config))

    def test_invalid_tone(self):
        """测试无效的 tone"""
        config = {
            "agent": {
                "name": "Test",
                "interaction_style": {
                    "tone": "invalid"
                }
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("语气 'invalid' 无效" in e.message for e in errors))
        self.assertFalse(self.validator.is_valid(config))

    def test_invalid_language(self):
        """测试无效的 language"""
        config = {
            "agent": {
                "name": "Test",
                "interaction_style": {
                    "language": "french"
                }
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("语言 'french' 无效" in e.message for e in errors))

    def test_invalid_emoji_usage(self):
        """测试无效的 emoji_usage"""
        config = {
            "agent": {
                "name": "Test",
                "interaction_style": {
                    "emoji_usage": "many"
                }
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("Emoji 使用频率 'many' 无效" in e.message for e in errors))

    def test_invalid_timezone_format(self):
        """测试无效的时区格式"""
        config = {
            "agent": {
                "name": "Test"
            },
            "master": {
                "timezone": "Shanghai"  # should be Region/City
            }
        }
        errors = self.validator.validate(config)
        # Should be a warning
        self.assertTrue(any("时区格式不正确" in e.message for e in errors))
        self.assertTrue(self.validator.is_valid(config))  # still valid (warning only)

    def test_invalid_behavior_not_dict(self):
        """测试 behavior 不是字典"""
        config = {
            "agent": {
                "name": "Test"
            },
            "behavior": "enabled"  # should be dict
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("behavior 必须是字典类型" in e.message for e in errors))
        self.assertFalse(self.validator.is_valid(config))

    def test_invalid_boolean_field(self):
        """测试布尔字段不是布尔类型"""
        config = {
            "agent": {
                "name": "Test"
            },
            "behavior": {
                "enabled": "true"  # should be bool
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("enabled 必须是布尔类型" in e.message for e in errors))
        self.assertFalse(self.validator.is_valid(config))

    def test_invalid_priority_not_list(self):
        """测试 priority 不是列表"""
        config = {
            "agent": {
                "name": "Test"
            },
            "behavior": {
                "enabled": True,
                "priority": "privacy"  # should be list
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("priority 必须是列表类型" in e.message for e in errors))
        self.assertFalse(self.validator.is_valid(config))

    def test_invalid_response_length_limit_negative(self):
        """测试 response_length_limit 负数无效"""
        config = {
            "agent": {
                "name": "Test"
            },
            "behavior": {
                "enabled": True,
                "response_length_limit": -100
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("response_length_limit 必须是非负数字" in e.message for e in errors))
        self.assertFalse(self.validator.is_valid(config))

    def test_standalone_behavior_config(self):
        """测试独立 behavior 配置（embedded 检查）"""
        # When we have a standalone behavior config, it should still validate correctly
        config = {
            "enabled": True,
            "auto_memory": True,
            "priority": ["privacy"]
        }
        errors = self.validator.validate(config)
        # agent is missing → error
        self.assertTrue(any(e.field == "agent" for e in errors))

    def test_validate_pad_value_valid(self):
        """测试验证 PAD 值有效范围"""
        error = self.validator.validate_pad_value(0.5, "pleasure")
        self.assertIsNone(error)

        error = self.validator.validate_pad_value(-1.0, "pleasure")
        self.assertIsNone(error)

        error = self.validator.validate_pad_value(1.0, "pleasure")
        self.assertIsNone(error)

    def test_validate_pad_value_out_of_range(self):
        """测试验证 PAD 值超出范围"""
        error = self.validator.validate_pad_value(1.5, "pleasure")
        self.assertIsNotNone(error)
        self.assertIn("必须在 -1.0 到 1.0 之间", error.message)

        error = self.validator.validate_pad_value(-1.5, "pleasure")
        self.assertIsNotNone(error)

    def test_validate_pad_value_not_number(self):
        """测试验证 PAD 值不是数字"""
        error = self.validator.validate_pad_value("not a number", "pleasure")
        self.assertIsNotNone(error)
        self.assertIn("必须是数字类型", error.message)

    def test_is_valid_returns_false_when_has_errors(self):
        """测试 is_valid 在有错误时返回 False"""
        config = {
            "agent": {
                "interaction_style": {
                    "tone": "invalid"
                }
            }
        }
        self.assertFalse(self.validator.is_valid(config))

    def test_print_errors_no_errors_logs_ok(self):
        """测试 print_errors 无错误输出 OK"""
        with patch('agentsoul.config_manager.validator.log') as mock_log:
            self.validator.print_errors([])
            self.assertTrue(any("配置验证通过" in str(call) for call in mock_log.call_args_list))

    def test_print_errors_with_errors_counts_correctly(self):
        """测试 print_errors 正确统计错误和警告"""
        errors = [
            ValidationError("f1", "error1", "error"),
            ValidationError("f2", "error2", "error"),
            ValidationError("f3", "warn1", "warning"),
        ]
        with patch('agentsoul.config_manager.validator.log') as mock_log:
            self.validator.print_errors(errors)
            # Should log the count
            self.assertTrue(any("发现 2 个错误，1 个警告" in str(call) for call in mock_log.call_args_list))

    def test_missing_master_config_warning(self):
        """测试缺少 master 配置只产生警告"""
        config = {
            "agent": {
                "name": "Test"
            }
        }
        errors = self.validator.validate(config)
        warnings = [e for e in errors if e.severity == "warning"]
        errors_err = [e for e in errors if e.severity == "error"]
        # Missing master AND missing behavior → 2 warnings
        self.assertEqual(len(warnings), 2)
        self.assertEqual(len(errors_err), 0)
        self.assertTrue(self.validator.is_valid(config))

    def test_missing_behavior_config_warning(self):
        """测试缺少 behavior 配置只产生警告"""
        config = {
            "agent": {
                "name": "Test"
            },
            "master": {
                "name": "User"
            }
        }
        errors = self.validator.validate(config)
        warnings = [e for e in errors if e.severity == "warning"]
        errors_err = [e for e in errors if e.severity == "error"]
        self.assertEqual(len(warnings), 1)
        self.assertEqual(len(errors_err), 0)
        self.assertTrue(self.validator.is_valid(config))

    def test_forbidden_topics_not_list_error(self):
        """测试 forbidden_topics 不是列表产生错误"""
        config = {
            "agent": {
                "name": "Test"
            },
            "behavior": {
                "enabled": True,
                "forbidden_topics": "politics"
            }
        }
        errors = self.validator.validate(config)
        self.assertTrue(any("forbidden_topics 必须是列表类型" in e.message for e in errors))
        self.assertFalse(self.validator.is_valid(config))


if __name__ == "__main__":
    unittest.main()
