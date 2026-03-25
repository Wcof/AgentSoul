"""
AgentSoul · 通用工具模块
提供日志、配置加载等通用功能
"""

import sys
from pathlib import Path
from typing import Optional

# 从 src 重新导出，避免重复定义
from src.config_loader import ConfigLoader
from src.path_compat import PathResolver, resolve_path

__version__ = "1.0.0"
__all__ = ["log", "icons", "load_config", "get_project_root", "ConfigLoader", "PathResolver", "resolve_path"]

PROJECT_ROOT = Path(__file__).parent.parent


def get_project_root() -> Path:
    if "__file__" in globals():
        return Path(__file__).parent.parent
    return Path.cwd()


def log(message: str, level: str = "INFO") -> None:
    symbols = {
        "INFO": "ℹ️",
        "OK": "✅",
        "WARN": "⚠️",
        "ERROR": "❌",
        "STEP": "🔧"
    }
    symbol = symbols.get(level, "ℹ️")
    print(f"{symbol} {message}")


def icons() -> dict:
    return {
        "check": "✅",
        "cross": "❌",
        "warn": "⚠️",
        "info": "ℹ️",
        "gear": "⚙️",
        "sparkle": "✨",
    }


def load_config(project_root: Optional[Path] = None) -> dict:
    if project_root is None:
        project_root = PROJECT_ROOT

    config_path = project_root / "config" / "persona.yaml"
    if not config_path.exists():
        return {}

    try:
        import yaml
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}