"""
AgentSoul · MCP 客户端测试
========================

测试 MCP 客户端配置和重试机制
"""
from __future__ import annotations

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

import unittest

from agentsoul import McpClientError, McpConnectionError, McpRequestError, McpRetryConfig


class TestMcpRetryConfig(unittest.TestCase):
    """测试 MCP 重试配置"""

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
            auto_reconnect=False
        )
        self.assertEqual(config.max_retries, 5)
        self.assertEqual(config.retry_delay_ms, 200)
        self.assertFalse(config.auto_reconnect)


class TestMcpExceptions(unittest.TestCase):
    """测试 MCP 异常类"""

    def test_mcp_client_error(self):
        """测试基础异常"""
        err = McpClientError("test error")
        self.assertEqual(str(err), "test error")
        self.assertIsInstance(err, Exception)

    def test_mcp_connection_error(self):
        """测试连接异常"""
        err = McpConnectionError("connection failed")
        self.assertEqual(str(err), "connection failed")
        self.assertIsInstance(err, McpClientError)

    def test_mcp_request_error(self):
        """测试请求异常"""
        err = McpRequestError("request failed")
        self.assertEqual(str(err), "request failed")
        self.assertIsInstance(err, McpClientError)


if __name__ == "__main__":
    unittest.main()
