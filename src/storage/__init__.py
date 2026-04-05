"""
AgentSoul · 存储实现
==================

提供具体存储实现：
- local: 本地文件系统存储（用于 OpenAI 链路和独立模式）
- mcp_client: MCP 客户端存储（用于连接远程 MCP 服务）
"""

from .local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
    LocalSkillStorage,
)
from .mcp_client import (
    McpPersonaStorage,
    McpSoulStateStorage,
    McpMemoryStorage,
    McpSkillStorage,
    McpRetryConfig,
    McpClientError,
    McpConnectionError,
    McpRequestError,
)

__all__ = [
    "LocalPersonaStorage",
    "LocalSoulStateStorage",
    "LocalMemoryStorage",
    "LocalSkillStorage",
    "McpPersonaStorage",
    "McpSoulStateStorage",
    "McpMemoryStorage",
    "McpSkillStorage",
    "McpRetryConfig",
    "McpClientError",
    "McpConnectionError",
    "McpRequestError",
]
