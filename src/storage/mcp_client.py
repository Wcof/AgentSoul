"""
AgentSoul · MCP 客户端存储实现
=============================

通过 MCP 协议连接到 AgentSoul 服务，使用远程存储。
支持：
- 自动断连重连
- 请求重试机制
- 超时处理
"""
from __future__ import annotations

import json
import subprocess
import time
from dataclasses import dataclass
from typing import Any

from common import get_project_root, log
from src.abstract import (
    BaseMemoryStorage,
    BasePersonaStorage,
    BaseSkillStorage,
    BaseSoulStateStorage,
    MemoryConflict,
    SoulVersion,
)


@dataclass
class McpRetryConfig:
    """MCP 客户端重试配置"""
    max_retries: int = 3          # 最大重试次数
    retry_delay_ms: int = 100      # 重试基础延迟（毫秒）
    max_retry_delay_ms: int = 5000 # 最大重试延迟（毫秒）
    connection_timeout_sec: int = 30 # 连接超时（秒）
    request_timeout_sec: int = 60  # 请求超时（秒）
    auto_reconnect: bool = True    # 是否自动重连


class McpClientError(Exception):
    """MCP 客户端错误基类"""
    pass


class McpConnectionError(McpClientError):
    """MCP 连接错误"""
    pass


class McpRequestError(McpClientError):
    """MCP 请求错误"""
    pass


class McpPersonaStorage(BasePersonaStorage):
    """通过 MCP 服务存储人格配置"""

    def __init__(
        self,
        server_command: str | None = None,
        retry_config: McpRetryConfig | None = None
    ):
        self.server_command = server_command or self._default_server_command()
        self.retry_config = retry_config or McpRetryConfig()
        self._process: subprocess.Popen | None = None
        self._connected = False

    def _default_server_command(self) -> str:
        """获取默认服务器命令"""
        project_root = get_project_root()
        server_path = project_root / "mcp_server" / "dist" / "index.js"
        return f"node {server_path}"

    def _connect(self) -> None:
        """连接到 MCP 服务器，带重试"""
        if self._connected and self._process is not None:
            return

        retry_config = self.retry_config
        last_error: Exception | None = None

        for attempt in range(retry_config.max_retries):
            try:
                cmd_parts = self.server_command.split()
                self._process = subprocess.Popen(
                    cmd_parts,
                    stdin=subprocess.PIPE,
                    stdout=subprocess.PIPE,
                    stderr=subprocess.PIPE,
                    text=True
                )
                self._connected = True
                log(f"Connected to AgentSoul MCP server (attempt {attempt + 1})", level="INFO")
                return
            except Exception as e:
                last_error = e
                delay = min(
                    retry_config.retry_delay_ms * (2 ** attempt),
                    retry_config.max_retry_delay_ms
                ) / 1000
                log(f"MCP connection failed (attempt {attempt + 1}), retrying in {delay}s: {e}", level="WARNING")
                time.sleep(delay)

        raise McpConnectionError(f"Failed to connect after {retry_config.max_retries} attempts: {last_error}")

    def _send_request(self, request: dict[str, Any]) -> dict[str, Any]:
        """发送请求到 MCP 服务器，带重试和断连自动重连"""
        retry_config = self.retry_config
        last_error: Exception | None = None

        for attempt in range(retry_config.max_retries):
            try:
                if not self._connected or self._process is None or self._process.poll() is not None:
                    # 连接断开，尝试重连
                    if retry_config.auto_reconnect:
                        log("MCP connection disconnected, reconnecting...", level="WARNING")
                        self._close()
                        self._connect()
                    else:
                        raise McpConnectionError("Not connected to MCP server")

                # 发送请求
                assert self._process is not None
                assert self._process.stdin is not None
                assert self._process.stdout is not None

                json_line = json.dumps(request) + "\n"
                self._process.stdin.write(json_line)
                self._process.stdin.flush()

                # 读取响应
                response_line = self._process.stdout.readline()
                if not response_line:
                    raise McpRequestError("Empty response from MCP server")

                response: dict[str, Any] = json.loads(response_line)
                return response

            except Exception as e:
                last_error = e
                delay = min(
                    retry_config.retry_delay_ms * (2 ** attempt),
                    retry_config.max_retry_delay_ms
                ) / 1000
                log(f"MCP request failed (attempt {attempt + 1}), retrying in {delay}s: {e}", level="WARNING")
                time.sleep(delay)

        raise McpRequestError(f"Request failed after {retry_config.max_retries} attempts: {last_error}")

    def _call_tool(self, name: str, params: dict[str, Any]) -> Any:
        """调用 MCP 工具"""
        request = {
            "jsonrpc": "2.0",
            "id": int(time.time() * 1000),
            "method": "callTool",
            "params": {
                "name": name,
                "arguments": params
            }
        }
        response = self._send_request(request)

        if "error" in response:
            raise McpRequestError(f"MCP tool error: {response['error']}")

        # 提取结果文本并解析 JSON
        content = response.get("result", {}).get("content", [])
        if not content:
            return {}
        text = content[0].get("text", "{}")
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            return text

    def read_persona_config(self) -> dict[str, Any]:
        result = self._call_tool("get_persona_config", {})
        if isinstance(result, str):
            config: dict[str, Any] = json.loads(result)
            return config
        return result if isinstance(result, dict) else {}

    def write_persona_config(self, config: dict[str, Any]) -> bool:
        # MCP 服务器端不支持直接写入，需要通过文件系统
        log("write_persona_config not supported via MCP client, use local storage", level="WARNING")
        return False

    def get_version(self) -> SoulVersion:
        # 通过读取配置获取版本信息
        config = self.read_persona_config()
        # 基于配置内容计算简单版本
        config_str = json.dumps(config, sort_keys=True)
        import hashlib
        checksum = hashlib.md5(config_str.encode()).hexdigest()[:8]
        return SoulVersion(
            version="mcp-1.0",
            timestamp=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            checksum=checksum,
            description="MCP remote persona storage"
        )

    def _close(self) -> None:
        """关闭连接"""
        if self._process is not None:
            try:
                self._process.terminate()
                self._process.wait(timeout=5)
            except Exception:
                self._process.kill()
            self._connected = False
            self._process = None

    def __del__(self) -> None:
        """析构时关闭连接"""
        self._close()


class McpSoulStateStorage(BaseSoulStateStorage):
    """通过 MCP 服务存储灵魂状态"""

    def __init__(self, client: McpPersonaStorage):
        self.client = client

    def read_soul_state(self) -> dict[str, Any]:
        result = self.client._call_tool("get_soul_state", {})
        assert isinstance(result, dict)
        return result

    def write_soul_state(self, state: dict[str, Any]) -> bool:
        # 需要使用 update_soul_state，但参数是增量更新
        # 这里为了兼容接口，转换为增量更新
        result = self.client._call_tool("update_soul_state", {
            "pleasure": state.get("pleasure"),
            "arousal": state.get("arousal"),
            "dominance": state.get("dominance"),
            "trigger": "full_state_update"
        })
        assert isinstance(result, dict)
        success = result.get("success", False)
        assert isinstance(success, bool)
        return success

    def rollback(self, to_version: str) -> bool:
        # MCP 服务端版本回滚需要本地存储支持
        log("rollback not supported via MCP, use local storage for version history", level="ERROR")
        return False


class McpMemoryStorage(BaseMemoryStorage):
    """通过 MCP 服务存储分层记忆"""

    def __init__(self, client: McpPersonaStorage):
        self.client = client

    def read_daily_memory(self, date: str) -> str | None:
        result = self.client._call_tool("read_memory_day", {"date": date})
        return result if isinstance(result, str) else None

    def write_daily_memory(self, date: str, content: str, append: bool = False) -> bool:
        result = self.client._call_tool("write_memory_day", {"date": date, "content": content})
        return "success" in result if isinstance(result, dict) else False

    def read_weekly_memory(self, year_week: str) -> str | None:
        result = self.client._call_tool("read_memory_week", {"year_week": year_week})
        return result if isinstance(result, str) else None

    def write_weekly_memory(self, year_week: str, content: str, append: bool = False) -> bool:
        result = self.client._call_tool("write_memory_week", {"year_week": year_week, "content": content})
        return "success" in result if isinstance(result, dict) else False

    def read_monthly_memory(self, year_month: str) -> str | None:
        result = self.client._call_tool("read_memory_month", {"year_month": year_month})
        return result if isinstance(result, str) else None

    def write_monthly_memory(self, year_month: str, content: str, append: bool = False) -> bool:
        result = self.client._call_tool("write_memory_month", {"year_month": year_month, "content": content})
        return "success" in result if isinstance(result, dict) else False

    def read_yearly_memory(self, year: str) -> str | None:
        result = self.client._call_tool("read_memory_year", {"year": year})
        return result if isinstance(result, str) else None

    def write_yearly_memory(self, year: str, content: str, append: bool = False) -> bool:
        result = self.client._call_tool("write_memory_year", {"year": year, "content": content})
        return "success" in result if isinstance(result, dict) else False

    def read_topic_memory(self, topic: str) -> str | None:
        result = self.client._call_tool("read_memory_topic", {"topic": topic})
        return result if isinstance(result, str) else None

    def write_topic_memory(self, topic: str, content: str, append: bool = False) -> bool:
        result = self.client._call_tool("write_memory_topic", {"topic": topic, "content": content})
        return "success" in result if isinstance(result, dict) else False

    def list_topics(self, status: str = "active") -> list[dict[str, str]]:
        result = self.client._call_tool("list_memory_topics", {"status": status})
        return result if isinstance(result, list) else []

    def archive_topic(self, topic: str) -> bool:
        result = self.client._call_tool("archive_memory_topic", {"topic": topic})
        return result.get("success", False) if isinstance(result, dict) else False

    def detect_conflict(self, topic: str, new_content: str) -> MemoryConflict | None:
        # 冲突检测在客户端进行
        existing = self.read_topic_memory(topic)
        if existing is None or len(existing.strip()) == 0:
            return None
        # 使用与本地存储相同的检测逻辑
        if len(new_content) > len(existing) * 10:
            return MemoryConflict(
                topic=topic,
                existing_content=existing[:200] + ("..." if len(existing) > 200 else ""),
                new_content=new_content[:200] + ("..." if len(new_content) > 200 else ""),
                conflict_type="size_mismatch",
                resolution=None
            )
        return None

    def resolve_conflict(self, conflict: MemoryConflict, resolution: str) -> bool:
        if resolution == "keep_existing":
            return True
        elif resolution == "overwrite":
            return self.write_topic_memory(conflict.topic, conflict.new_content, append=False)
        elif resolution == "merge_append":
            existing = self.read_topic_memory(conflict.topic) or ""
            merged = existing + "\n\n---\n" + conflict.new_content
            return self.write_topic_memory(conflict.topic, merged, append=False)
        return False


class McpSkillStorage(BaseSkillStorage):
    """通过 MCP 服务获取技能规则"""

    def __init__(self, client: McpPersonaStorage):
        self.client = client

    def read_base_rule(self, name: str) -> str | None:
        result = self.client._call_tool("get_base_rules", {"name": name})
        return result if isinstance(result, str) else None

    def list_available_rules(self) -> list[str]:
        # MCP doesn't provide this via API, return empty
        return []
