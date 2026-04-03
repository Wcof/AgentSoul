"""
AgentSoul · 配置验证器
提供配置文件格式验证、字段检查和数值范围验证
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any

from common import log


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

    def validate(self, config: Dict[str, Any]) -> List[ValidationError]:
        errors = []
        errors.extend(self._validate_agent_config(config))
        errors.extend(self._validate_master_config(config))
        errors.extend(self._validate_interaction_style(config))
        errors.extend(self._validate_behavior_config(config))
        return errors

    def is_valid(self, config: Dict[str, Any]) -> bool:
        errors = self.validate(config)
        return not any(e.severity == "error" for e in errors)

    def print_errors(self, errors: List[ValidationError]) -> None:
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

    def _validate_agent_config(self, config: Dict[str, Any]) -> List[ValidationError]:
        errors = []
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

    def _validate_master_config(self, config: Dict[str, Any]) -> List[ValidationError]:
        errors = []
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

    def _validate_interaction_style(self, config: Dict[str, Any]) -> List[ValidationError]:
        errors = []
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

    def validate_pad_value(self, value: float, field_name: str) -> Optional[ValidationError]:
        if not isinstance(value, (int, float)):
            return ValidationError(
                field=field_name,
                message=f"值必须是数字类型，当前类型: {type(value).__name__}",
                severity="error"
            )

        if not (-1.0 <= value <= 1.0):
            return ValidationError(
                field=field_name,
                message=f"值必须在 -1.0 到 1.0 之间，当前值: {value}",
                severity="error"
            )

        return None

    def _add_error(self, errors: List[ValidationError], field: str, message: str, severity: str) -> None:
        errors.append(ValidationError(field=field, message=message, severity=severity))

    def _validate_choice(
        self,
        errors: List[ValidationError],
        value: Optional[str],
        field: str,
        allowed_values: List[str],
        label: str
    ) -> None:
        if value and value not in allowed_values:
            self._add_error(
                errors,
                field,
                f"{label} '{value}' 无效，有效值: {', '.join(allowed_values)}",
                "error"
            )

    def _validate_behavior_config(self, config: Dict[str, Any]) -> List[ValidationError]:
        """Validate behavior configuration structure.

        Handles both cases:
        - Behavior config embedded inside a full persona config (under 'behavior' key)
        - Standalone behavior config (root is the behavior dict)
        """
        errors = []

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

        return errors

    def _is_valid_timezone_format(self, timezone: str) -> bool:
        if not timezone:
            return True
        parts = timezone.split("/")
        return len(parts) >= 2
