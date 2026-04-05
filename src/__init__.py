#!/usr/bin/env python3
"""
AgentSoul · 核心模块初始化
提供重新导出公共符号
"""

from common import (
    log,
    icons,
    load_config,
    get_project_root,
    __version__,
)
from src.config_loader import ConfigLoader
from src.path_compat import PathResolver, resolve_path
from src.abstract import (
    BasePersonaStorage,
    BaseSoulStateStorage,
    BaseMemoryStorage,
    BaseSkillStorage,
    UnifiedSoulStorage,
    InjectionRollback,
    MemoryConflict,
    SoulVersion,
)
from src.health_check import (
    HealthChecker,
    HealthReport,
    HealthIssue,
)
from src.adapters import (
    OpenAIInjectionAdapter,
    InjectionConfig,
    GeminiInjectionAdapter,
    GeminiInjectionConfig,
    GeminiMessage,
)
from src.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
    LocalSkillStorage,
)
from src.storage.mcp_client import (
    McpPersonaStorage,
    McpSoulStateStorage,
    McpMemoryStorage,
    McpSkillStorage,
    McpRetryConfig,
    McpClientError,
    McpConnectionError,
    McpRequestError,
)
from src.snapshot import (
    SnapshotManager,
    SoulSnapshot,
    VersionRollback,
)
from src.migration import (
    CrossPlatformMigrator,
    LocalToMcpMigrator,
    McpToLocalMigrator,
    MigrationResult,
    export_archive,
    import_archive,
)

__all__ = [
    "log",
    "icons",
    "load_config",
    "get_project_root",
    "__version__",
    "ConfigLoader",
    "PathResolver",
    "resolve_path",
    # Unified abstraction for dual-link compatibility
    "BasePersonaStorage",
    "BaseSoulStateStorage",
    "BaseMemoryStorage",
    "BaseSkillStorage",
    "UnifiedSoulStorage",
    "InjectionRollback",
    "MemoryConflict",
    "SoulVersion",
    # Health checking
    "HealthChecker",
    "HealthReport",
    "HealthIssue",
    # Local storage implementation
    "LocalPersonaStorage",
    "LocalSoulStateStorage",
    "LocalMemoryStorage",
    "LocalSkillStorage",
    # MCP client implementation with retry
    "McpPersonaStorage",
    "McpSoulStateStorage",
    "McpMemoryStorage",
    "McpSkillStorage",
    "McpRetryConfig",
    "McpClientError",
    "McpConnectionError",
    "McpRequestError",
    # OpenAI adapter
    "OpenAIInjectionAdapter",
    "InjectionConfig",
    # Google Gemini adapter
    "GeminiInjectionAdapter",
    "GeminiInjectionConfig",
    "GeminiMessage",
    # Snapshot and version rollback
    "SnapshotManager",
    "SoulSnapshot",
    "VersionRollback",
    # Cross-platform migration
    "CrossPlatformMigrator",
    "LocalToMcpMigrator",
    "McpToLocalMigrator",
    "MigrationResult",
    "export_archive",
    "import_archive",
]
