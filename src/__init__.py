#!/usr/bin/env python3
"""
AgentSoul · 通用模块初始化
提供日志、配置加载等通用功能
"""

import sys
from pathlib import Path
from typing import Optional

__version__ = "1.0.0"

PROJECT_ROOT = Path(__file__).parent.parent


def get_project_root() -> Path:
    return PROJECT_ROOT


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


def load_config(project_root: Optional[Path] = None) -> dict:
    if project_root is None:
        project_root = PROJECT_ROOT

    try:
        from src.config_loader import ConfigLoader
        loader = ConfigLoader(project_root)
        return loader.load_persona_config()
    except Exception:
        return {}


def icons() -> dict:
    return {
        "check": "✅",
        "cross": "❌",
        "warn": "⚠️",
        "info": "ℹ️",
        "gear": "⚙️",
        "sparkle": "✨",
    }