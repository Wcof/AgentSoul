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

__all__ = [
    "log",
    "icons",
    "load_config",
    "get_project_root",
    "__version__",
    "ConfigLoader",
    "PathResolver",
    "resolve_path",
]
