"""
AgentSoul · 配置管理模块
提供配置模板、验证和命令行工具功能
"""
from __future__ import annotations

from .cli import main as cli_main
from .templates import PERSONA_TEMPLATES, get_template, list_templates
from .validator import ConfigValidator, ValidationError

__version__ = "1.0.0"
__all__ = [
    "get_template",
    "list_templates",
    "PERSONA_TEMPLATES",
    "ConfigValidator",
    "ValidationError",
    "cli_main"
]
