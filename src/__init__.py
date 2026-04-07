#!/usr/bin/env python3
"""
AgentSoul · 核心模块初始化
提供重新导出公共符号
"""
from __future__ import annotations

from common import (
    __version__,
    get_project_root,
    icons,
    load_config,
    log,
)
from src.abstract import (
    BaseMemoryStorage,
    BasePersonaStorage,
    BaseSkillStorage,
    BaseSoulStateStorage,
    InjectionRollback,
    MemoryConflict,
    SoulVersion,
    UnifiedSoulStorage,
)
from src.adapters import (
    GeminiInjectionAdapter,
    GeminiInjectionConfig,
    GeminiMessage,
    InjectionConfig,
    OpenAIInjectionAdapter,
)
from src.config_loader import ConfigLoader
from src.entry_detect import (
    EntryCapability,
    check_agentsoul_installed,
    detect_environment,
    generate_report,
    get_injection_template,
    print_report,
)
from src.health_check import (
    HealthChecker,
    HealthIssue,
    HealthReport,
)
from src.migration import (
    CrossPlatformMigrator,
    LocalToMcpMigrator,
    McpToLocalMigrator,
    MigrationResult,
    export_archive,
    import_archive,
)
from src.path_compat import PathResolver, resolve_path
from src.snapshot import (
    SnapshotManager,
    SoulSnapshot,
    VersionRollback,
)
from src.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSkillStorage,
    LocalSoulStateStorage,
)
from src.storage.mcp_client import (
    McpClientError,
    McpConnectionError,
    McpMemoryStorage,
    McpPersonaStorage,
    McpRequestError,
    McpRetryConfig,
    McpSkillStorage,
    McpSoulStateStorage,
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
    # Entry capability detection
    "EntryCapability",
    "detect_environment",
    "check_agentsoul_installed",
    "get_injection_template",
    "generate_report",
    "print_report",
]
