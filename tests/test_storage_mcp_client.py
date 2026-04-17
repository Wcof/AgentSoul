"""
AgentSoul · MCP 客户端存储测试
=============================

测试 McpClient 功能，使用 mock 避免实际启动 MCP 服务器
"""
from __future__ import annotations

import os
import sys
import json
from unittest.mock import Mock, patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest
from pathlib import Path

from agentsoul.storage.mcp_client import (
    McpRetryConfig,
    McpClientError,
    McpConnectionError,
    McpRequestError,
    McpPersonaStorage,
    McpSoulStateStorage,
    McpMemoryStorage,
    McpSkillStorage,
)


class BaseTest(unittest.TestCase):
    """基础测试类提供公共断言"""

    def assertNotEmpty(self, value):
        """断言不为空"""
        self.assertTrue(bool(value))


class TestMcpRetryConfig(BaseTest):
    """测试重试配置"""

    def test_default_config(self):
        """测试默认配置"""
        config = McpRetryConfig()
        self.assertEqual(config.max_retries, 3)
        self.assertEqual(config.retry_delay_ms, 100)
        self.assertEqual(config.max_retry_delay_ms, 5000)
        self.assertEqual(config.connection_timeout_sec, 30)
        self.assertEqual(config.request_timeout_sec, 60)
        self.assertTrue(config.auto_reconnect)

    def test_custom_config(self):
        """测试自定义配置"""
        config = McpRetryConfig(
            max_retries=5,
            retry_delay_ms=200,
            max_retry_delay_ms=10000,
            auto_reconnect=False
        )
        self.assertEqual(config.max_retries, 5)
        self.assertEqual(config.retry_delay_ms, 200)
        self.assertEqual(config.max_retry_delay_ms, 10000)
        self.assertFalse(config.auto_reconnect)


class TestExceptions(BaseTest):
    """测试异常类"""

    def test_exception_hierarchy(self):
        """测试异常继承关系"""
        self.assertTrue(issubclass(McpConnectionError, McpClientError))
        self.assertTrue(issubclass(McpRequestError, McpClientError))

    def test_exception_message(self):
        """测试异常可以携带消息"""
        err = McpClientError("test error")
        self.assertEqual(str(err), "test error")

        conn_err = McpConnectionError("connection failed")
        self.assertEqual(str(conn_err), "connection failed")

        req_err = McpRequestError("request failed")
        self.assertEqual(str(req_err), "request failed")


class TestMcpPersonaStorage(BaseTest):
    """测试 MCP 人格存储 - 使用 mock"""

    def test_default_command_construction(self):
        """测试默认命令构造"""
        storage = McpPersonaStorage(server_command="echo test")
        self.assertEqual(storage.server_command, "echo test")
        self.assertIsInstance(storage.retry_config, McpRetryConfig)

    def test_custom_retry_config(self):
        """测试自定义重试配置"""
        custom_config = McpRetryConfig(max_retries=5)
        storage = McpPersonaStorage(
            server_command="echo test",
            retry_config=custom_config
        )
        self.assertIs(storage.retry_config, custom_config)
        self.assertEqual(storage.retry_config.max_retries, 5)

    def test_read_persona_config_success(self):
        """测试成功读取人格配置"""
        storage = McpPersonaStorage(server_command="echo test")

        # Mock the _send_request method
        mock_response = {
            "result": {
                "content": [
                    {"text": '{"ai": {"name": "Test"}, "master": {"name": "User"}}'}
                ]
            }
        }
        with patch.object(storage, '_send_request', return_value=mock_response):
            result = storage.read_persona_config()
            self.assertIsInstance(result, dict)
            self.assertEqual(result["ai"]["name"], "Test")

    def test_read_persona_config_not_json(self):
        """测试返回非 JSON 文本返回空字典"""
        storage = McpPersonaStorage(server_command="echo test")

        mock_response = {
            "result": {
                "content": [
                    {"text": 'plain text not json'}
                ]
            }
        }
        with patch.object(storage, '_send_request', return_value=mock_response):
            result = storage.read_persona_config()
            # Returns empty dict when JSON decode fails
            self.assertEqual(result, {})

    def test_read_persona_config_empty(self):
        """测试返回空内容"""
        storage = McpPersonaStorage(server_command="echo test")

        mock_response = {
            "result": {
                "content": []
            }
        }
        with patch.object(storage, '_send_request', return_value=mock_response):
            result = storage.read_persona_config()
            self.assertEqual(result, {})

    def test_write_persona_config_returns_false(self):
        """测试 write_persona_config 不支持返回 False"""
        storage = McpPersonaStorage(server_command="echo test")
        result = storage.write_persona_config({})
        self.assertFalse(result)

    def test_get_version(self):
        """测试获取版本信息"""
        storage = McpPersonaStorage(server_command="echo test")

        mock_config = {"ai": {"name": "Test"}, "master": {"name": "User"}}
        with patch.object(storage, 'read_persona_config', return_value=mock_config):
            version = storage.get_version()
            self.assertEqual(version.version, "mcp-1.0")
            self.assertNotEmpty(version.timestamp)
            self.assertNotEmpty(version.checksum)
            self.assertEqual(version.description, "MCP remote persona storage")

    def test_close_when_not_connected(self):
        """测试关闭连接时未连接不报错"""
        storage = McpPersonaStorage(server_command="echo test")
        # Should not raise
        storage._close()

    def test_call_tool_with_error(self):
        """测试调用工具返回错误"""
        storage = McpPersonaStorage(server_command="echo test")

        mock_response = {"error": "Tool not found"}
        with patch.object(storage, '_send_request', return_value=mock_response):
            with self.assertRaises(McpRequestError):
                storage._call_tool("nonexistent", {})

    def test_default_server_command(self):
        """测试默认服务器命令构造正确路径"""
        storage = McpPersonaStorage()
        cmd = storage._default_server_command()
        self.assertIn("apps/mcp-server/dist/index.js", cmd)
        self.assertTrue(cmd.startswith("node "))


class TestMcpSoulStateStorage(BaseTest):
    """测试 MCP 灵魂状态存储"""

    def setUp(self):
        self.mock_client = Mock(spec=McpPersonaStorage)
        self.storage = McpSoulStateStorage(self.mock_client)

    def test_read_soul_state(self):
        """测试读取灵魂状态"""
        expected = {"pleasure": 0.5, "arousal": 0.3, "dominance": 0.2}
        self.mock_client._call_tool.return_value = expected

        result = self.storage.read_soul_state()
        self.assertEqual(result, expected)
        self.mock_client._call_tool.assert_called_once_with("get_soul_state", {})

    def test_write_soul_state_success(self):
        """测试写入灵魂状态成功"""
        state = {"pleasure": 0.5, "arousal": 0.3, "dominance": 0.2}
        self.mock_client._call_tool.return_value = {"success": True}

        result = self.storage.write_soul_state(state)
        self.assertTrue(result)
        self.mock_client._call_tool.assert_called_once()

    def test_write_soul_state_failure(self):
        """测试写入灵魂状态失败"""
        state = {"pleasure": 0.5, "arousal": 0.3, "dominance": 0.2}
        self.mock_client._call_tool.return_value = {"success": False}

        result = self.storage.write_soul_state(state)
        self.assertFalse(result)

    def test_rollback_returns_false(self):
        """测试回滚不支持返回 False"""
        result = self.storage.rollback("some-version")
        self.assertFalse(result)


class TestMcpMemoryStorage(BaseTest):
    """测试 MCP 记忆存储"""

    def setUp(self):
        self.mock_client = Mock(spec=McpPersonaStorage)
        self.storage = McpMemoryStorage(self.mock_client)

    def test_read_daily_memory_success(self):
        """测试读取日记忆成功"""
        self.mock_client._call_tool.return_value = "memory content"
        result = self.storage.read_daily_memory("2024-01-01")
        self.assertEqual(result, "memory content")
        self.mock_client._call_tool.assert_called_once_with(
            "read_memory_day", {"date": "2024-01-01"}
        )

    def test_read_daily_memory_not_string(self):
        """测试读取日记忆返回非字符串返回 None"""
        self.mock_client._call_tool.return_value = {}
        result = self.storage.read_daily_memory("2024-01-01")
        self.assertIsNone(result)

    def test_write_daily_memory_success(self):
        """测试写入日记忆成功"""
        self.mock_client._call_tool.return_value = {"success": True}
        result = self.storage.write_daily_memory("2024-01-01", "content")
        self.assertTrue(result)

    def test_write_daily_memory_failure(self):
        """测试写入日记忆失败"""
        self.mock_client._call_tool.return_value = {"error": "some error"}
        result = self.storage.write_daily_memory("2024-01-01", "content")
        self.assertFalse(result)

    def test_read_weekly_memory(self):
        """测试读取周记忆"""
        self.mock_client._call_tool.return_value = "weekly content"
        result = self.storage.read_weekly_memory("2024-01")
        self.assertEqual(result, "weekly content")

    def test_write_weekly_memory(self):
        """测试写入周记忆"""
        self.mock_client._call_tool.return_value = {"success": True}
        result = self.storage.write_weekly_memory("2024-01", "content")
        self.assertTrue(result)

    def test_read_monthly_memory(self):
        """测试读取月记忆"""
        self.mock_client._call_tool.return_value = "monthly content"
        result = self.storage.read_monthly_memory("2024-01")
        self.assertEqual(result, "monthly content")

    def test_write_monthly_memory(self):
        """测试写入月记忆"""
        self.mock_client._call_tool.return_value = {"success": True}
        result = self.storage.write_monthly_memory("2024-01", "content")
        self.assertTrue(result)

    def test_read_yearly_memory(self):
        """测试读取年记忆"""
        self.mock_client._call_tool.return_value = "yearly content"
        result = self.storage.read_yearly_memory("2024")
        self.assertEqual(result, "yearly content")

    def test_write_yearly_memory(self):
        """测试写入年记忆"""
        self.mock_client._call_tool.return_value = {"success": True}
        result = self.storage.write_yearly_memory("2024", "content")
        self.assertTrue(result)

    def test_read_topic_memory(self):
        """测试读取主题记忆"""
        self.mock_client._call_tool.return_value = "topic content"
        result = self.storage.read_topic_memory("test-topic")
        self.assertEqual(result, "topic content")

    def test_write_topic_memory(self):
        """测试写入主题记忆"""
        self.mock_client._call_tool.return_value = {"success": True}
        result = self.storage.write_topic_memory("test-topic", "content")
        self.assertTrue(result)

    def test_list_topics(self):
        """测试列出主题"""
        expected = [{"name": "topic1", "status": "active"}, {"name": "topic2", "status": "active"}]
        self.mock_client._call_tool.return_value = expected
        result = self.storage.list_topics("active")
        self.assertEqual(result, expected)

    def test_list_topics_empty_when_not_list(self):
        """测试非列表返回空列表"""
        self.mock_client._call_tool.return_value = {}
        result = self.storage.list_topics("active")
        self.assertEqual(result, [])

    def test_archive_topic_success(self):
        """测试归档主题成功"""
        self.mock_client._call_tool.return_value = {"success": True}
        result = self.storage.archive_topic("test-topic")
        self.assertTrue(result)

    def test_archive_topic_failure(self):
        """测试归档主题失败"""
        self.mock_client._call_tool.return_value = {"success": False}
        result = self.storage.archive_topic("test-topic")
        self.assertFalse(result)

    def test_detect_conflict_none_when_no_existing(self):
        """测试没有现有内容返回 None"""
        self.mock_client._call_tool.return_value = None
        conflict = self.storage.detect_conflict("test-topic", "new content")
        self.assertIsNone(conflict)

    def test_detect_conflict_none_when_empty_existing(self):
        """测试现有内容为空返回 None"""
        self.mock_client._call_tool.return_value = "   \n  "
        conflict = self.storage.detect_conflict("test-topic", "new content")
        self.assertIsNone(conflict)

    def test_detect_conflict_size_mismatch(self):
        """检测到大内容差异返回冲突"""
        self.mock_client._call_tool.return_value = "short"
        # New content is more than 10x longer
        new_content = "x" * 100
        conflict = self.storage.detect_conflict("test-topic", new_content)
        self.assertIsNotNone(conflict)
        self.assertEqual(conflict.topic, "test-topic")
        self.assertEqual(conflict.conflict_type, "size_mismatch")

    def test_detect_conflict_no_conflict(self):
        """测试没有冲突返回 None"""
        self.mock_client._call_tool.return_value = "existing content"
        new_content = "new content"  # Similar length
        conflict = self.storage.detect_conflict("test-topic", new_content)
        self.assertIsNone(conflict)

    def test_resolve_conflict_keep_existing(self):
        """测试保持现有解决方案"""
        conflict = Mock()
        result = self.storage.resolve_conflict(conflict, "keep_existing")
        self.assertTrue(result)

    def test_resolve_conflict_overwrite(self):
        """测试覆盖解决方案"""
        conflict = Mock()
        conflict.topic = "test"
        conflict.new_content = "new content"
        self.mock_client._call_tool.return_value = {"success": True}

        result = self.storage.resolve_conflict(conflict, "overwrite")
        self.assertTrue(result)

    def test_resolve_conflict_merge_append(self):
        """测试合并追加解决方案"""
        from agentsoul.abstract import MemoryConflict
        conflict = MemoryConflict(
            topic="test",
            existing_content="existing",
            new_content="new",
            conflict_type="size_mismatch",
            resolution=None
        )

        # First read_topic_memory returns "existing", then write returns success
        self.mock_client._call_tool.return_value = "existing"
        # First call is read_topic_memory, second call is write_topic_memory
        def mock_call(name, params):
            if self.mock_client._call_tool.call_count == 1:
                # First call - read_topic_memory
                return "existing"
            else:
                # Second call - write_topic_memory
                return {"success": True}

        self.mock_client._call_tool.side_effect = mock_call

        result = self.storage.resolve_conflict(conflict, "merge_append")
        self.assertTrue(result)
        # Check that content was merged - find the second call (write)
        call_args = self.mock_client._call_tool.call_args_list[1]
        positional_args = call_args[0]
        # _call_tool(name, params) → params is at index 1
        params = positional_args[1]
        self.assertIn("existing\n\n---\nnew", params["content"])

    def test_resolve_conflict_unknown_strategy(self):
        """测试未知策略返回 False"""
        conflict = Mock()
        result = self.storage.resolve_conflict(conflict, "unknown_strategy")
        self.assertFalse(result)


class TestMcpSkillStorage(BaseTest):
    """测试 MCP 技能存储"""

    def setUp(self):
        self.mock_client = Mock(spec=McpPersonaStorage)
        self.storage = McpSkillStorage(self.mock_client)

    def test_read_base_rule_success(self):
        """测试成功读取基础规则"""
        self.mock_client._call_tool.return_value = "# Rule Title\n\ncontent"
        result = self.storage.read_base_rule("SKILL")
        self.assertEqual(result, "# Rule Title\n\ncontent")

    def test_read_base_rule_not_string(self):
        """测试非字符串返回 None"""
        self.mock_client._call_tool.return_value = {}
        result = self.storage.read_base_rule("SKILL")
        self.assertIsNone(result)

    def test_list_available_rules_returns_empty(self):
        """测试 list_available_rules 返回空列表"""
        result = self.storage.list_available_rules()
        self.assertEqual(result, [])


class TestSendRequestReconnect(BaseTest):
    """测试发送请求时自动重连逻辑"""

    def test_auto_reconnect_when_disconnected(self):
        """测试断开连接时自动重连"""
        config = McpRetryConfig(max_retries=1, auto_reconnect=True)
        storage = McpPersonaStorage(server_command="echo test", retry_config=config)
        storage._connected = False
        storage._process = None

        with patch.object(storage, '_connect') as mock_connect:
            # After connect, still no process so it will fail after one attempt
            with self.assertRaises(McpRequestError):
                storage._send_request({})
            mock_connect.assert_called_once()

    def test_no_auto_reconnect_when_disconnected(self):
        """测试禁用自动重连，断开时抛出异常"""
        config = McpRetryConfig(max_retries=1, auto_reconnect=False)
        storage = McpPersonaStorage(
            server_command="echo test",
            retry_config=config
        )
        storage._connected = False
        storage._process = None

        # With max_retries=1, it will fail immediately after the first attempt
        with self.assertRaises((McpConnectionError, McpRequestError)):
            storage._send_request({})


if __name__ == "__main__":
    unittest.main()
