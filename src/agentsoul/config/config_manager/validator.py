"""
AgentSoul · 配置验证器
提供配置文件格式验证、字段检查和数值范围验证
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from agentsoul.common import log


@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"


class ConfigValidator:
    ALLOWED_TONES = ["neutral", "friendly", "professional", "casual"]
    ALLOWED_LANGUAGES = ["chinese", "english"]
    ALLOWED_EMOJI_FREQS = ["minimal", "moderate", "frequent"]
    ALLOWED_BOOLEAN_FIELDS = ["enabled", "auto_memory", "emotional_response", "task_scheduling", "memory_daily_summary"]
    ALLOWED_SENTENCE_LENGTHS = ["short", "medium", "long"]
    ALLOWED_QUESTION_RATIOS = ["low", "moderate", "high"]
    ALLOWED_ANALOGY_DENSITIES = ["low", "moderate", "high"]
    ALLOWED_CERTAINTY_STYLES = ["bold", "calibrated", "hedging"]
    ALLOWED_STRUCTURE_PREFERENCES = ["concise", "balanced", "detailed"]

    def validate(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        
        # Check if v2 config (multi-character)
        if "characters" in config:
            active_char = config.get("active_character")
            if not active_char:
                self._add_error(errors, "active_character", "缺少 active_character 字段", "error")
            elif not isinstance(active_char, str):
                self._add_error(errors, "active_character", "active_character 必须是字符串", "error")
            
            characters = config.get("characters", {})
            if not isinstance(characters, dict):
                self._add_error(errors, "characters", "characters 必须是字典类型", "error")
            else:
                if active_char and active_char not in characters:
                    self._add_error(errors, "active_character", f"active_character '{active_char}' 不在 characters 列表中", "error")
                
                for char_id, char_data in characters.items():
                    if not isinstance(char_data, dict):
                        self._add_error(errors, f"characters.{char_id}", f"角色 {char_id} 的配置必须是字典类型", "error")
                        continue
                    
                    # Wrap char_data under "agent" so existing _validate methods can run unchanged
                    wrapped = {"agent": char_data}
                    
                    # Validate this character
                    errors.extend(self._validate_agent_config(wrapped))
                    errors.extend(self._validate_interaction_style(wrapped))
                    errors.extend(self._validate_expression_dna(wrapped))
                    errors.extend(self._validate_honest_boundaries(wrapped))
                    errors.extend(self._validate_internal_tensions(wrapped))
                    errors.extend(self._validate_capability_profile(wrapped))
        else:
            # v1 single agent validation
            errors.extend(self._validate_agent_config(config))
            errors.extend(self._validate_interaction_style(config))
            errors.extend(self._validate_expression_dna(config))
            errors.extend(self._validate_honest_boundaries(config))
            errors.extend(self._validate_internal_tensions(config))
            errors.extend(self._validate_capability_profile(config))

        errors.extend(self._validate_master_config(config))
        errors.extend(self._validate_behavior_config(config))
        return errors

    def is_valid(self, config: dict[str, Any]) -> bool:
        errors = self.validate(config)
        return not any(e.severity == "error" for e in errors)

    def print_errors(self, errors: list[ValidationError]) -> None:
        if not errors:
            log("配置验证通过！", "OK")
            return

        error_count = sum(1 for e in errors if e.severity == "error")
        warning_count = sum(1 for e in errors if e.severity == "warning")

        if error_count > 0:
            log(f"发现 {error_count} 个错误，{warning_count} 个警告", "ERROR")
        elif warning_count > 0:
            log(f"发现 {warning_count} 个警告", "WARN")

        for error in errors:
            prefix = "❌" if error.severity == "error" else "⚠️"
            log(f"{prefix} [{error.field}] {error.message}", error.severity.upper())

    def _validate_agent_config(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        agent = config.get("agent", config.get("ai", {}))

        if not agent:
            self._add_error(errors, "agent", "缺少 agent 配置", "error")
            return errors

        if not agent.get("name"):
            self._add_error(errors, "agent.name", "Agent 名称不能为空", "error")

        # Check personality is a list
        personality = agent.get("personality")
        if personality is not None:
            if not isinstance(personality, list):
                self._add_error(
                    errors,
                    "agent.personality",
                    f"personality 必须是列表类型，当前类型: {type(personality).__name__}",
                    "error"
                )
            else:
                for item in personality:
                    if not isinstance(item, str):
                        self._add_error(
                            errors,
                            "agent.personality",
                            f"personality 列表元素必须是字符串类型，当前: {type(item).__name__}",
                            "warning"
                        )

        # Check core_values is a list
        core_values = agent.get("core_values")
        if core_values is not None:
            if not isinstance(core_values, list):
                self._add_error(
                    errors,
                    "agent.core_values",
                    f"core_values 必须是列表类型，当前类型: {type(core_values).__name__}",
                    "error"
                )
            else:
                for item in core_values:
                    if not isinstance(item, str):
                        self._add_error(
                            errors,
                            "agent.core_values",
                            f"core_values 列表元素必须是字符串类型，当前: {type(item).__name__}",
                            "warning"
                        )

        return errors

    def _validate_master_config(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        master = config.get("master", {})

        if not master:
            self._add_error(errors, "master", "缺少 master 配置", "warning")
            return errors

        timezone = master.get("timezone")
        if timezone and not self._is_valid_timezone_format(timezone):
            self._add_error(
                errors,
                "master.timezone",
                f"时区格式不正确: {timezone}，建议使用 Region/City 格式",
                "warning"
            )

        return errors

    def _validate_interaction_style(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        agent = config.get("agent", config.get("ai", {}))
        style = agent.get("interaction_style", {})

        if not style:
            return errors

        self._validate_choice(
            errors,
            style.get("tone"),
            "agent.interaction_style.tone",
            self.ALLOWED_TONES,
            "语气"
        )

        self._validate_choice(
            errors,
            style.get("language"),
            "agent.interaction_style.language",
            self.ALLOWED_LANGUAGES,
            "语言"
        )

        self._validate_choice(
            errors,
            style.get("emoji_usage"),
            "agent.interaction_style.emoji_usage",
            self.ALLOWED_EMOJI_FREQS,
            "Emoji 使用频率"
        )

        return errors

    def validate_pad_value(self, value: Any, field_name: str) -> ValidationError | None:
        if not isinstance(value, (int, float)):
            return ValidationError(
                field=field_name,
                message=f"值必须是数字类型，当前类型: {type(value).__name__}",
                severity="error"
            )

        float_value = float(value)
        if not (-1.0 <= float_value <= 1.0):
            return ValidationError(
                field=field_name,
                message=f"值必须在 -1.0 到 1.0 之间，当前值: {value}",
                severity="error"
            )

        return None

    def _add_error(self, errors: list[ValidationError], field: str, message: str, severity: str) -> None:
        errors.append(ValidationError(field=field, message=message, severity=severity))

    def _validate_choice(
        self,
        errors: list[ValidationError],
        value: str | None,
        field: str,
        allowed_values: list[str],
        label: str
    ) -> None:
        if value and value not in allowed_values:
            self._add_error(
                errors,
                field,
                f"{label} '{value}' 无效，有效值: {', '.join(allowed_values)}",
                "error"
            )

    def _validate_behavior_config(self, config: dict[str, Any]) -> list[ValidationError]:
        """Validate behavior configuration structure.

        Handles both cases:
        - Behavior config embedded inside a full persona config (under 'behavior' key)
        - Standalone behavior config (root is the behavior dict)
        """
        errors: list[ValidationError] = []

        # Check if behavior config exists
        if "behavior" in config:
            # Embedded in full persona config
            behavior = config["behavior"]
        elif "enabled" in config and isinstance(config["enabled"], bool):
            # This looks like a standalone behavior config, use root
            behavior = config
        else:
            behavior = None

        if behavior is None:
            self._add_error(errors, "behavior", "缺少 behavior 配置", "warning")
            return errors

        if not isinstance(behavior, dict):
            self._add_error(errors, "behavior", "behavior 必须是字典类型", "error")
            return errors

        # Check boolean fields
        for field_name in self.ALLOWED_BOOLEAN_FIELDS:
            if field_name in behavior:
                value = behavior[field_name]
                if not isinstance(value, bool):
                    self._add_error(
                        errors,
                        f"behavior.{field_name}",
                        f"{field_name} 必须是布尔类型 (true/false)，当前类型: {type(value).__name__}",
                        "error"
                    )

        # Check priority field
        priority = behavior.get("priority")
        if priority is not None:
            if not isinstance(priority, list):
                self._add_error(
                    errors,
                    "behavior.priority",
                    f"priority 必须是列表类型，当前类型: {type(priority).__name__}",
                    "error"
                )
            else:
                for item in priority:
                    if not isinstance(item, str):
                        self._add_error(
                            errors,
                            "behavior.priority",
                            f"priority 列表元素必须是字符串类型，当前: {type(item).__name__}",
                            "warning"
                        )

        # Check forbidden_topics and allowed_topics
        for field_name in ["forbidden_topics", "allowed_topics"]:
            if field_name in behavior:
                value = behavior[field_name]
                if not isinstance(value, list):
                    self._add_error(
                        errors,
                        f"behavior.{field_name}",
                        f"{field_name} 必须是列表类型，当前类型: {type(value).__name__}",
                        "error"
                    )

        # Check response_length_limit
        if "response_length_limit" in behavior:
            value = behavior["response_length_limit"]
            if not isinstance(value, (int, float)) or value < 0:
                self._add_error(
                    errors,
                    "behavior.response_length_limit",
                    f"response_length_limit 必须是非负数字，当前值: {value}",
                    "error"
                )

        # Check quality_gates
        quality_gates = behavior.get("quality_gates")
        if quality_gates is not None:
            if not isinstance(quality_gates, dict):
                self._add_error(
                    errors,
                    "behavior.quality_gates",
                    f"quality_gates 必须是字典类型，当前类型: {type(quality_gates).__name__}",
                    "error"
                )
            else:
                for qg_field in ["persona_boundary_required", "expression_dna_required", "tool_protocol_required"]:
                    if qg_field in quality_gates:
                        if not isinstance(quality_gates[qg_field], bool):
                            self._add_error(
                                errors,
                                f"behavior.quality_gates.{qg_field}",
                                f"{qg_field} 必须是布尔类型 (true/false)，当前类型: {type(quality_gates[qg_field]).__name__}",
                                "error"
                            )

        # Check agentic_protocol
        agentic_protocol = behavior.get("agentic_protocol")
        if agentic_protocol is not None:
            if not isinstance(agentic_protocol, dict):
                self._add_error(
                    errors,
                    "behavior.agentic_protocol",
                    f"agentic_protocol 必须是字典类型，当前类型: {type(agentic_protocol).__name__}",
                    "error"
                )
            else:
                for ap_field in ["classify_before_answer", "research_when_freshness_matters",
                                 "memory_read_before_topic", "memory_write_after_topic", "confidence_required"]:
                    if ap_field in agentic_protocol:
                        if not isinstance(agentic_protocol[ap_field], bool):
                            self._add_error(
                                errors,
                                f"behavior.agentic_protocol.{ap_field}",
                                f"{ap_field} 必须是布尔类型 (true/false)，当前类型: {type(agentic_protocol[ap_field]).__name__}",
                                "error"
                            )

        return errors

    def _is_valid_timezone_format(self, timezone: str) -> bool:
        if not timezone:
            return True
        parts = timezone.split("/")
        return len(parts) >= 2

    def _validate_expression_dna(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        agent = config.get("agent", config.get("ai", {}))
        edna = agent.get("expression_dna") if isinstance(agent, dict) else None
        if not edna or not isinstance(edna, dict):
            return errors

        self._validate_choice(
            errors, edna.get("sentence_length"),
            "agent.expression_dna.sentence_length",
            self.ALLOWED_SENTENCE_LENGTHS, "sentence_length"
        )
        self._validate_choice(
            errors, edna.get("question_ratio"),
            "agent.expression_dna.question_ratio",
            self.ALLOWED_QUESTION_RATIOS, "question_ratio"
        )
        self._validate_choice(
            errors, edna.get("analogy_density"),
            "agent.expression_dna.analogy_density",
            self.ALLOWED_ANALOGY_DENSITIES, "analogy_density"
        )
        self._validate_choice(
            errors, edna.get("certainty_style"),
            "agent.expression_dna.certainty_style",
            self.ALLOWED_CERTAINTY_STYLES, "certainty_style"
        )
        self._validate_choice(
            errors, edna.get("structure_preference"),
            "agent.expression_dna.structure_preference",
            self.ALLOWED_STRUCTURE_PREFERENCES, "structure_preference"
        )
        return errors

    def _validate_honest_boundaries(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        agent = config.get("agent", config.get("ai", {}))
        hb = agent.get("honest_boundaries") if isinstance(agent, dict) else None
        if not hb or not isinstance(hb, dict):
            return errors

        for field_name in ["limitations", "blind_spots"]:
            if field_name in hb:
                value = hb[field_name]
                if not isinstance(value, list):
                    self._add_error(
                        errors,
                        f"agent.honest_boundaries.{field_name}",
                        f"{field_name} 必须是列表类型，当前类型: {type(value).__name__}",
                        "error"
                    )
        return errors

    def _validate_internal_tensions(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        agent = config.get("agent", config.get("ai", {}))
        tensions = agent.get("internal_tensions") if isinstance(agent, dict) else None
        if not tensions or not isinstance(tensions, list):
            return errors

        for i, item in enumerate(tensions):
            if not isinstance(item, dict):
                self._add_error(
                    errors,
                    f"agent.internal_tensions[{i}]",
                    "internal_tensions 元素必须是字典类型",
                    "error"
                )
                continue
            if not item.get("name"):
                self._add_error(
                    errors,
                    f"agent.internal_tensions[{i}].name",
                    "internal_tension name 为空，建议填写以便追踪",
                    "warning"
                )
            if not item.get("resolution_rule"):
                self._add_error(
                    errors,
                    f"agent.internal_tensions[{i}].resolution_rule",
                    "internal_tension resolution_rule 为空，建议填写解决规则",
                    "warning"
                )
        return errors

    def _validate_capability_profile(self, config: dict[str, Any]) -> list[ValidationError]:
        errors: list[ValidationError] = []
        agent = config.get("agent", config.get("ai", {}))
        cp = agent.get("capability_profile") if isinstance(agent, dict) else None
        if not cp or not isinstance(cp, dict):
            return errors

        for field_name in ["strong_at", "weak_at", "must_use_tools_when", "must_refuse_when"]:
            if field_name in cp:
                value = cp[field_name]
                if not isinstance(value, list):
                    self._add_error(
                        errors,
                        f"agent.capability_profile.{field_name}",
                        f"{field_name} 必须是列表类型，当前类型: {type(value).__name__}",
                        "error"
                    )
        return errors
