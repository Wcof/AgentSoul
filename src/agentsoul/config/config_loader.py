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
from typing import Any

import yaml

from agentsoul.common import get_project_root
from agentsoul.common.cache import TTLCacheBase
from agentsoul.config.config_manager.validator import ConfigValidator, ValidationError


@dataclass
class ExpressionDNA:
    """表达 DNA - 定义 Agent 的语言风格特征"""
    sentence_length: str = "medium"  # short/medium/long
    question_ratio: str = "moderate"  # low/moderate/high
    analogy_density: str = "low"  # low/moderate/high
    certainty_style: str = "calibrated"  # bold/calibrated/hedging
    structure_preference: str = "concise"  # concise/balanced/detailed
    taboo_phrases: list[str] = field(default_factory=list)
    signature_moves: list[str] = field(default_factory=list)


@dataclass
class HonestBoundaries:
    """诚实边界 - 定义 Agent 的知识边界声明策略"""
    limitations: list[str] = field(default_factory=list)
    blind_spots: list[str] = field(default_factory=list)
    stale_info_policy: str = "verify_before_answer"
    uncertainty_policy: str = "state_confidence_and_basis"


@dataclass
class InternalTension:
    """内在张力 - 定义 Agent 内部的冲突与解决规则"""
    name: str = ""
    description: str = ""
    resolution_rule: str = ""


@dataclass
class CapabilityProfile:
    """能力画像 - 定义 Agent 的能力边界"""
    strong_at: list[str] = field(default_factory=list)
    weak_at: list[str] = field(default_factory=list)
    must_use_tools_when: list[str] = field(default_factory=list)
    must_refuse_when: list[str] = field(default_factory=list)


@dataclass
class AgentConfig:
    name: str = "Agent"
    nickname: str = ""
    naming_mode: str = "default"
    role: str = "AI Assistant"
    personality: list[str] = field(default_factory=list)
    core_values: list[str] = field(default_factory=list)
    interaction_style: dict[str, Any] = field(default_factory=dict)
    expression_dna: ExpressionDNA = field(default_factory=ExpressionDNA)
    honest_boundaries: HonestBoundaries = field(default_factory=HonestBoundaries)
    internal_tensions: list[InternalTension] = field(default_factory=list)
    capability_profile: CapabilityProfile = field(default_factory=CapabilityProfile)
    
    # New Pet Attributes
    species: str = "slime"
    stage: str = "baby"
    level: int = 1
    xp: int = 0
    hunger: int = 100
    energy: int = 100
    intimacy: int = 0
    active_skin: str = "default"
    unlocked_skins: list[str] = field(default_factory=list)
    unlocked_skills: list[str] = field(default_factory=list)
    api_key: str = ""
    api_url: str = ""
    model: str = ""


@dataclass
class MasterConfig:
    name: str = ""
    nickname: list[str] = field(default_factory=list)
    timezone: str = "Asia/Shanghai"
    labels: list[str] = field(default_factory=list)


@dataclass
class QualityGates:
    """质量门控 - 定义 Agent 行为的质量检查点"""
    persona_boundary_required: bool = True
    expression_dna_required: bool = True
    tool_protocol_required: bool = True


@dataclass
class AgenticProtocol:
    """代理协议 - 定义 Agent 的行为协议"""
    classify_before_answer: bool = True
    research_when_freshness_matters: bool = True
    memory_read_before_topic: bool = True
    memory_write_after_topic: bool = True
    confidence_required: bool = True


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
    quality_gates: QualityGates = field(default_factory=QualityGates)
    agentic_protocol: AgenticProtocol = field(default_factory=AgenticProtocol)


@dataclass
class PersonaConfig:
    active_character: str = "slime"
    characters: dict[str, AgentConfig] = field(default_factory=dict)
    master: MasterConfig = field(default_factory=MasterConfig)

    @property
    def ai(self) -> AgentConfig:
        """Dynamic fallback property returning the active character's configuration."""
        if self.active_character in self.characters:
            return self.characters[self.active_character]
        if self.characters:
            return next(iter(self.characters.values()))
        fallback = AgentConfig()
        self.characters[self.active_character] = fallback
        return fallback


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

    def _parse_agent_config(self, ai_data: Any) -> AgentConfig:
        if not isinstance(ai_data, dict):
            ai_data = {}
        return AgentConfig(
            name=self._safe_get(ai_data, "name", self.DEFAULT_AGENT_NAME),
            nickname=self._safe_get(ai_data, "nickname", ""),
            naming_mode=self._safe_get(ai_data, "naming_mode", "default"),
            role=self._safe_get(ai_data, "role", self.DEFAULT_ROLE),
            personality=self._to_list(ai_data.get("personality", [])),
            core_values=self._to_list(ai_data.get("core_values", [])),
            interaction_style=ai_data.get("interaction_style", {}),
            expression_dna=self._parse_expression_dna(ai_data.get("expression_dna", {})),
            honest_boundaries=self._parse_honest_boundaries(ai_data.get("honest_boundaries", {})),
            internal_tensions=self._parse_internal_tensions(ai_data.get("internal_tensions", [])),
            capability_profile=self._parse_capability_profile(ai_data.get("capability_profile", {})),
            species=self._safe_get(ai_data, "species", "slime"),
            stage=self._safe_get(ai_data, "stage", "baby"),
            level=int(self._safe_get(ai_data, "level", 1)),
            xp=int(self._safe_get(ai_data, "xp", 0)),
            hunger=int(self._safe_get(ai_data, "hunger", 100)),
            energy=int(self._safe_get(ai_data, "energy", 100)),
            intimacy=int(self._safe_get(ai_data, "intimacy", 0)),
            active_skin=self._safe_get(ai_data, "active_skin", "default"),
            unlocked_skins=self._to_list(ai_data.get("unlocked_skins", ["default"])),
            unlocked_skills=self._to_list(ai_data.get("unlocked_skills", ["chat"])),
            api_key=self._safe_get(ai_data, "api_key", ""),
            api_url=self._safe_get(ai_data, "api_url", ""),
            model=self._safe_get(ai_data, "model", "")
        )

    def load_persona_config(self, persona_path: Path | None = None) -> PersonaConfig:
        if self._cache_is_valid():
            assert self._persona_cache is not None
            return self._persona_cache

        if persona_path is None:
            persona_path = self.project_root / "config" / "persona.yaml"

        raw_config = self.load_yaml(persona_path)
        self._config_cache = raw_config

        active_char = raw_config.get("active_character", "slime")
        characters_data = raw_config.get("characters", {})

        characters = {}
        if not characters_data and ("agent" in raw_config or "ai" in raw_config or "persona" in raw_config):
            # v1 legacy config migration
            legacy_data = raw_config.get("agent") or raw_config.get("ai") or raw_config.get("persona", {})
            if isinstance(legacy_data, dict) and "ai" in legacy_data:
                legacy_data = legacy_data.get("ai", legacy_data)
            
            parsed_agent = self._parse_agent_config(legacy_data)
            characters[active_char] = parsed_agent
        else:
            for char_id, char_data in characters_data.items():
                characters[char_id] = self._parse_agent_config(char_data)

        if not characters:
            characters[active_char] = AgentConfig(name="Slimey", species="slime")

        master_data = raw_config.get("master", {})

        master_config = MasterConfig(
            name=self._safe_get(master_data, "name", self.DEFAULT_MASTER_NAME),
            nickname=self._to_list(
                master_data.get("nickname", master_data.get("nicknames", []))
            ),
            timezone=self._safe_get(master_data, "timezone", "Asia/Shanghai"),
            labels=self._to_list(master_data.get("labels", [])),
        )

        self._persona_cache = PersonaConfig(
            active_character=active_char,
            characters=characters,
            master=master_config
        )
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

    @staticmethod
    def _parse_expression_dna(data: Any) -> ExpressionDNA:
        if not isinstance(data, dict):
            return ExpressionDNA()
        return ExpressionDNA(
            sentence_length=data.get("sentence_length", "medium"),
            question_ratio=data.get("question_ratio", "moderate"),
            analogy_density=data.get("analogy_density", "low"),
            certainty_style=data.get("certainty_style", "calibrated"),
            structure_preference=data.get("structure_preference", "concise"),
            taboo_phrases=data.get("taboo_phrases", []),
            signature_moves=data.get("signature_moves", []),
        )

    @staticmethod
    def _parse_honest_boundaries(data: Any) -> HonestBoundaries:
        if not isinstance(data, dict):
            return HonestBoundaries()
        return HonestBoundaries(
            limitations=data.get("limitations", []),
            blind_spots=data.get("blind_spots", []),
            stale_info_policy=data.get("stale_info_policy", "verify_before_answer"),
            uncertainty_policy=data.get("uncertainty_policy", "state_confidence_and_basis"),
        )

    @staticmethod
    def _parse_internal_tensions(data: Any) -> list[InternalTension]:
        if not isinstance(data, list):
            return []
        result = []
        for item in data:
            if isinstance(item, dict):
                result.append(InternalTension(
                    name=item.get("name", ""),
                    description=item.get("description", ""),
                    resolution_rule=item.get("resolution_rule", ""),
                ))
        return result

    @staticmethod
    def _parse_capability_profile(data: Any) -> CapabilityProfile:
        if not isinstance(data, dict):
            return CapabilityProfile()
        return CapabilityProfile(
            strong_at=data.get("strong_at", []),
            weak_at=data.get("weak_at", []),
            must_use_tools_when=data.get("must_use_tools_when", []),
            must_refuse_when=data.get("must_refuse_when", []),
        )

    @staticmethod
    def _parse_quality_gates(data: Any) -> QualityGates:
        if not isinstance(data, dict):
            return QualityGates()
        return QualityGates(
            persona_boundary_required=data.get("persona_boundary_required", True),
            expression_dna_required=data.get("expression_dna_required", True),
            tool_protocol_required=data.get("tool_protocol_required", True),
        )

    @staticmethod
    def _parse_agentic_protocol(data: Any) -> AgenticProtocol:
        if not isinstance(data, dict):
            return AgenticProtocol()
        return AgenticProtocol(
            classify_before_answer=data.get("classify_before_answer", True),
            research_when_freshness_matters=data.get("research_when_freshness_matters", True),
            memory_read_before_topic=data.get("memory_read_before_topic", True),
            memory_write_after_topic=data.get("memory_write_after_topic", True),
            confidence_required=data.get("confidence_required", True),
        )

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
        ai = config.ai
        return {
            "ai": {
                "name": ai.name,
                "nickname": ai.nickname,
                "naming_mode": ai.naming_mode,
                "role": ai.role,
                "personality": ai.personality,
                "core_values": ai.core_values,
                "interaction_style": ai.interaction_style,
                "expression_dna": {
                    "sentence_length": ai.expression_dna.sentence_length,
                    "question_ratio": ai.expression_dna.question_ratio,
                    "analogy_density": ai.expression_dna.analogy_density,
                    "certainty_style": ai.expression_dna.certainty_style,
                    "structure_preference": ai.expression_dna.structure_preference,
                    "taboo_phrases": ai.expression_dna.taboo_phrases,
                    "signature_moves": ai.expression_dna.signature_moves,
                },
                "honest_boundaries": {
                    "limitations": ai.honest_boundaries.limitations,
                    "blind_spots": ai.honest_boundaries.blind_spots,
                    "stale_info_policy": ai.honest_boundaries.stale_info_policy,
                    "uncertainty_policy": ai.honest_boundaries.uncertainty_policy,
                },
                "internal_tensions": [
                    {"name": t.name, "description": t.description, "resolution_rule": t.resolution_rule}
                    for t in ai.internal_tensions
                ],
                "capability_profile": {
                    "strong_at": ai.capability_profile.strong_at,
                    "weak_at": ai.capability_profile.weak_at,
                    "must_use_tools_when": ai.capability_profile.must_use_tools_when,
                    "must_refuse_when": ai.capability_profile.must_refuse_when,
                },
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
            quality_gates=self._parse_quality_gates(raw_config.get("quality_gates", {})),
            agentic_protocol=self._parse_agentic_protocol(raw_config.get("agentic_protocol", {})),
        )

        self._behavior_cache = behavior
        # Update cache timestamp when we reload
        self._update_cache_timestamp()
        return behavior

    def save_persona_config(self, config: PersonaConfig, persona_path: Path | None = None) -> None:
        if persona_path is None:
            persona_path = self.project_root / "config" / "persona.yaml"
        
        characters_dict = {}
        for char_id, char in config.characters.items():
            characters_dict[char_id] = {
                "name": char.name,
                "nickname": char.nickname,
                "naming_mode": char.naming_mode,
                "role": char.role,
                "personality": char.personality,
                "core_values": char.core_values,
                "interaction_style": char.interaction_style,
                "expression_dna": {
                    "sentence_length": char.expression_dna.sentence_length,
                    "question_ratio": char.expression_dna.question_ratio,
                    "analogy_density": char.expression_dna.analogy_density,
                    "certainty_style": char.expression_dna.certainty_style,
                    "structure_preference": char.expression_dna.structure_preference,
                    "taboo_phrases": char.expression_dna.taboo_phrases,
                    "signature_moves": char.expression_dna.signature_moves,
                },
                "honest_boundaries": {
                    "limitations": char.honest_boundaries.limitations,
                    "blind_spots": char.honest_boundaries.blind_spots,
                    "stale_info_policy": char.honest_boundaries.stale_info_policy,
                    "uncertainty_policy": char.honest_boundaries.uncertainty_policy,
                },
                "internal_tensions": [
                    {"name": t.name, "description": t.description, "resolution_rule": t.resolution_rule}
                    for t in char.internal_tensions
                ],
                "capability_profile": {
                    "strong_at": char.capability_profile.strong_at,
                    "weak_at": char.capability_profile.weak_at,
                    "must_use_tools_when": char.capability_profile.must_use_tools_when,
                    "must_refuse_when": char.capability_profile.must_refuse_when,
                },
                "species": char.species,
                "stage": char.stage,
                "level": char.level,
                "xp": char.xp,
                "hunger": char.hunger,
                "energy": char.energy,
                "intimacy": char.intimacy,
                "active_skin": char.active_skin,
                "unlocked_skins": char.unlocked_skins,
                "unlocked_skills": char.unlocked_skills,
                "api_key": char.api_key,
                "api_url": char.api_url,
                "model": char.model,
            }
        
        data = {
            "active_character": config.active_character,
            "characters": characters_dict,
            "master": {
                "name": config.master.name,
                "nickname": config.master.nickname,
                "timezone": config.master.timezone,
                "labels": config.master.labels,
            }
        }
        
        with open(persona_path, "w", encoding="utf-8") as f:
            yaml.dump(data, f, allow_unicode=True, sort_keys=False)

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
