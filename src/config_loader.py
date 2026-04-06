"""
AgentSoul · 配置加载器
============

配置加载模块提供类型安全的配置解析，支持：
- PersonaConfig: 人格主配置（AI身份和用户信息）
- BehaviorConfig: 行为配置（功能开关、限制、自定义设置）
- 空值 fallback 逻辑保证配置缺失时的健壮性
- 内存缓存加速重复读取
- 向后兼容传统配置格式
"""

# AgentSoul · 配置加载器 v1.0
# 支持通用Agent配置模型，含空值fallback逻辑

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, List, Dict

import yaml

from common import get_project_root
from src.common.cache import TTLCacheBase
from src.config_manager.validator import ConfigValidator, ValidationError


@dataclass
class AgentConfig:
    name: str = "Agent"
    nickname: str = ""
    naming_mode: str = "default"
    role: str = "AI Assistant"
    personality: list[str] = field(default_factory=list)
    core_values: list[str] = field(default_factory=list)
    interaction_style: dict[str, Any] = field(default_factory=dict)


@dataclass
class MasterConfig:
    name: str = ""
    nickname: list[str] = field(default_factory=list)
    timezone: str = "Asia/Shanghai"
    labels: list[str] = field(default_factory=list)


@dataclass
class BehaviorConfig:
    """行为配置数据类"""
    enabled: bool = True
    auto_memory: bool = True
    emotional_response: bool = True
    task_scheduling: bool = True
    memory_daily_summary: bool = True
    response_length_limit: int = 0
    forbidden_topics: list[str] = field(default_factory=list)
    allowed_topics: list[str] = field(default_factory=list)
    custom_settings: dict[str, Any] = field(default_factory=dict)


@dataclass
class PersonaConfig:
    ai: AgentConfig = field(default_factory=AgentConfig)
    master: MasterConfig = field(default_factory=MasterConfig)


class ConfigLoader(TTLCacheBase):
    DEFAULT_AGENT_NAME = "Agent"
    DEFAULT_MASTER_NAME = ""
    DEFAULT_ROLE = "AI Assistant"

    def __init__(self, project_root: Path | None = None, default_ttl: int = 300):
        super().__init__(default_ttl)
        self.project_root = project_root or get_project_root()
        self._config_cache: dict[str, Any] | None = None
        self._persona_cache: PersonaConfig | None = None
        self._behavior_cache: BehaviorConfig | None = None

    def invalidate_cache(self) -> None:
        """Invalidate all cached configuration - force reload on next load."""
        self._config_cache = None
        self._persona_cache = None
        self._behavior_cache = None
        super().invalidate_cache()

    def _cache_is_valid(self) -> bool:
        """Check if cache is still valid based on TTL."""
        if self._persona_cache is None:
            return False
        return super()._cache_is_valid()

    def load_yaml(self, file_path: Path) -> dict[str, Any]:
        if not file_path.exists():
            return {}
        with open(file_path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}

    def load_persona_config(self, persona_path: Path | None = None) -> PersonaConfig:
        if self._cache_is_valid():
            assert self._persona_cache is not None
            return self._persona_cache

        if persona_path is None:
            persona_path = self.project_root / "config" / "persona.yaml"

        raw_config = self.load_yaml(persona_path)
        self._config_cache = raw_config

        ai_data = raw_config.get("agent") or raw_config.get("ai") or raw_config.get("persona", {})
        if isinstance(ai_data, dict):
            ai_data = ai_data.get("ai", ai_data)

        master_data = raw_config.get("master", {})

        ai_config = AgentConfig(
            name=self._safe_get(ai_data, "name", self.DEFAULT_AGENT_NAME),
            nickname=self._safe_get(ai_data, "nickname", ""),
            naming_mode=self._safe_get(ai_data, "naming_mode", "default"),
            role=self._safe_get(ai_data, "role", self.DEFAULT_ROLE),
            personality=self._to_list(ai_data.get("personality", [])),
            core_values=self._to_list(ai_data.get("core_values", [])),
            interaction_style=ai_data.get("interaction_style", {}),
        )

        master_config = MasterConfig(
            name=self._safe_get(master_data, "name", self.DEFAULT_MASTER_NAME),
            nickname=self._to_list(
                master_data.get("nickname", master_data.get("nicknames", []))
            ),
            timezone=self._safe_get(master_data, "timezone", "Asia/Shanghai"),
            labels=self._to_list(master_data.get("labels", [])),
        )

        self._persona_cache = PersonaConfig(ai=ai_config, master=master_config)
        self._update_cache_timestamp()
        return self._persona_cache

    @staticmethod
    def _safe_get(data: Any, key: str, default: Any) -> Any:
        if not isinstance(data, dict):
            return default
        if key not in data:
            return default
        value = data[key]
        if value is None:
            return default
        # If key exists and is explicitly set to empty string, preserve it
        # This allows users to intentionally clear the default value
        return value

    @staticmethod
    def _to_list(value: Any) -> list[Any]:
        if isinstance(value, (list, tuple)):
            return list(value)
        if isinstance(value, str):
            if "," in value:
                return [v.strip() for v in value.split(",") if v.strip()]
            return [value.strip()] if value.strip() else []
        return []

    def get_agent_name(self, persona_path: Path | None = None) -> str:
        config = self.load_persona_config(persona_path)
        name = config.ai.name or self.DEFAULT_AGENT_NAME
        return name.strip() or self.DEFAULT_AGENT_NAME

    def get_agent_nickname(self, persona_path: Path | None = None) -> str:
        config = self.load_persona_config(persona_path)
        return config.ai.nickname or ""

    def get_master_name(self, persona_path: Path | None = None) -> str:
        config = self.load_persona_config(persona_path)
        master_name = config.master.name
        if not master_name or not master_name.strip():
            return "主人"
        return master_name.strip()

    def get_master_nicknames(self, persona_path: Path | None = None) -> list[str]:
        config = self.load_persona_config(persona_path)
        nicknames = config.master.nickname
        if not nicknames:
            return ["主人"]
        return [n for n in nicknames if n]

    def get_effective_master_name(
        self, persona_path: Path | None = None
    ) -> str:
        nicknames = self.get_master_nicknames(persona_path)
        if nicknames and nicknames[0] != "主人":
            assert isinstance(nicknames[0], str)
            return nicknames[0]
        return self.get_master_name(persona_path)

    def is_config_valid(self, persona_path: Path | None = None) -> bool:
        try:
            check_path = persona_path or (self.project_root / "config" / "persona.yaml")
            if not check_path.exists():
                return False
            config = self.load_persona_config(persona_path)
            return bool(config.ai.name)
        except Exception:
            return False

    def validate_current_config(self, persona_path: Path | None = None, log_errors: bool = True) -> list[ValidationError]:
        """Validate current configuration and return list of validation errors.

        Args:
            persona_path: Optional custom path to persona config
            log_errors: Whether to log errors/warnings via the logger

        Returns:
            List of ValidationError objects (empty list means valid)
        """
        validator = ConfigValidator()

        if persona_path is None:
            persona_path = self.project_root / "config" / "persona.yaml"

        raw_config = self.load_yaml(persona_path)
        errors = validator.validate(raw_config)

        if log_errors and errors:
            validator.print_errors(errors)

        return errors

    def to_legacy_format(self, persona_path: Path | None = None) -> dict[str, Any]:
        config = self.load_persona_config(persona_path)
        return {
            "ai": {
                "name": config.ai.name,
                "nickname": config.ai.nickname,
                "naming_mode": config.ai.naming_mode,
                "role": config.ai.role,
                "personality": config.ai.personality,
                "core_values": config.ai.core_values,
                "interaction_style": config.ai.interaction_style,
            },
            "master": {
                "name": config.master.name,
                "nickname": config.master.nickname,
                "timezone": config.master.timezone,
                "labels": config.master.labels,
            },
        }

    def load_behavior_config(self, behavior_path: Path | None = None) -> BehaviorConfig:
        """加载行为配置
        Args:
            behavior_path: 可选的自定义 behavior.yaml 路径
        Returns:
            验证后的 BehaviorConfig 对象
        """
        # Use same cache TTL as persona config
        if self._cache_is_valid() and self._behavior_cache is not None:
            return self._behavior_cache

        if behavior_path is None:
            behavior_path = self.project_root / "config" / "behavior.yaml"

        raw_config = self.load_yaml(behavior_path)

        behavior = BehaviorConfig(
            enabled=self._safe_get(raw_config, "enabled", True),
            auto_memory=self._safe_get(raw_config, "auto_memory", True),
            emotional_response=self._safe_get(raw_config, "emotional_response", True),
            task_scheduling=self._safe_get(raw_config, "task_scheduling", True),
            memory_daily_summary=self._safe_get(raw_config, "memory_daily_summary", True),
            response_length_limit=self._safe_get(raw_config, "response_length_limit", 0),
            forbidden_topics=self._to_list(raw_config.get("forbidden_topics", [])),
            allowed_topics=self._to_list(raw_config.get("allowed_topics", [])),
            custom_settings=raw_config.get("custom_settings", {}),
        )

        self._behavior_cache = behavior
        # Update cache timestamp when we reload
        self._update_cache_timestamp()
        return behavior
# Default persona configuration data - created once at module load
DEFAULT_PERSONA_DATA: dict[str, Any] = {
    "agent": {
        "name": "Agent",
        "nickname": "",
        "naming_mode": "default",
        "role": "AI Assistant",
        "personality": [],
        "core_values": [],
        "interaction_style": {
            "tone": "neutral",
            "language": "chinese",
            "emoji_usage": "minimal",
        },
    },
    "master": {
        "name": "",
        "nickname": [],
        "timezone": "Asia/Shanghai",
        "labels": [],
    },
}


def create_default_persona(output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with open(output_path, "w", encoding="utf-8") as f:
        yaml.dump(DEFAULT_PERSONA_DATA, f, allow_unicode=True, sort_keys=False)


if __name__ == "__main__":
    loader = ConfigLoader()

    agent_name = loader.get_agent_name()
    master_name = loader.get_master_name()
    master_nicknames = loader.get_master_nicknames()

    print(f"Agent Name: {agent_name}")
    print(f"Master Name: {master_name}")
    print(f"Master Nicknames: {master_nicknames}")
    print(f"Config Valid: {loader.is_config_valid()}")
