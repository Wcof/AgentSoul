"""
AgentSoul · 通用工具模块
提供日志、配置加载等通用功能
"""

import sys
from pathlib import Path
from typing import Optional

__version__ = "1.0.0"
__all__ = ["log", "icons", "load_config", "get_project_root", "ConfigLoader"]

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


class ConfigLoader:
    DEFAULT_AGENT_NAME = "Agent"
    DEFAULT_MASTER_NAME = ""

    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or PROJECT_ROOT
        self._config_cache = None

    def load_persona_config(self):
        from dataclasses import dataclass, field
        from typing import Any, Dict, Union, List

        @dataclass
        class AgentConfig:
            name: str = "Agent"
            nickname: str = ""
            naming_mode: str = "default"
            role: str = "AI Assistant"
            personality: List = field(default_factory=list)
            core_values: List = field(default_factory=list)
            interaction_style: Dict = field(default_factory=dict)

        @dataclass
        class MasterConfig:
            name: str = ""
            nickname: List = field(default_factory=list)
            timezone: str = "Asia/Shanghai"
            labels: List = field(default_factory=list)

        @dataclass
        class PersonaConfig:
            ai: AgentConfig = field(default_factory=AgentConfig)
            master: MasterConfig = field(default_factory=MasterConfig)

        persona_path = self.project_root / "config" / "persona.yaml"
        if not persona_path.exists():
            return PersonaConfig()

        try:
            import yaml
            with open(persona_path, "r", encoding="utf-8") as f:
                raw = yaml.safe_load(f) or {}
        except Exception:
            return PersonaConfig()

        agent_data = raw.get("agent", raw.get("ai", {}))
        master_data = raw.get("master", {})

        def safe_get(d, key, default):
            if not isinstance(d, dict):
                return default
            v = d.get(key, default)
            return default if v is None else v

        def to_list(v):
            if isinstance(v, (list, tuple)):
                return list(v)
            if isinstance(v, str):
                if "," in v:
                    return [x.strip() for x in v.split(",") if x.strip()]
                return [v.strip()] if v.strip() else []
            return []

        ai_config = AgentConfig(
            name=safe_get(agent_data, "name", "Agent"),
            nickname=safe_get(agent_data, "nickname", ""),
            naming_mode=safe_get(agent_data, "naming_mode", "default"),
            role=safe_get(agent_data, "role", "AI Assistant"),
            personality=to_list(agent_data.get("personality", [])),
            core_values=to_list(agent_data.get("core_values", [])),
            interaction_style=agent_data.get("interaction_style", {}),
        )

        master_config = MasterConfig(
            name=safe_get(master_data, "name", ""),
            nickname=to_list(master_data.get("nickname", [])),
            timezone=safe_get(master_data, "timezone", "Asia/Shanghai"),
            labels=to_list(master_data.get("labels", [])),
        )

        return PersonaConfig(ai=ai_config, master=master_config)

    def get_agent_name(self) -> str:
        config = self.load_persona_config()
        name = config.ai.name or "Agent"
        return name.strip() or "Agent"

    def get_master_name(self) -> str:
        config = self.load_persona_config()
        name = config.master.name
        if not name or not name.strip():
            return "主人"
        return name.strip()

    def get_master_nicknames(self) -> List[str]:
        config = self.load_persona_config()
        nicknames = config.master.nickname
        if not nicknames:
            return ["主人"]
        return [n for n in nicknames if n]

    def is_config_valid(self) -> bool:
        try:
            config = self.load_persona_config()
            return bool(config.ai.name)
        except Exception:
            return False