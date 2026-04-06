"""
AgentSoul · 配置模板管理
提供配置模板的加载、预览和应用功能
"""
from __future__ import annotations

import shutil
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

import yaml

from common import get_project_root, log
from src.common.cache import TTLCacheBase


@dataclass
class ConfigTemplate:
    name: str
    description: str
    config: dict[str, Any]
    file_path: Path


class TemplateManager(TTLCacheBase):
    def __init__(self, templates_dir: Path | None = None, default_ttl: int = 300):
        super().__init__(default_ttl)
        if templates_dir is None:
            templates_dir = get_project_root() / "config" / "templates"
        self.templates_dir = templates_dir
        self._templates_cache: list[ConfigTemplate] | None = None

    def list_templates(self, use_cache: bool = True) -> list[ConfigTemplate]:
        # Return cached copy if still valid
        if use_cache and self._cache_is_valid():
            return self._templates_cache if self._templates_cache is not None else []

        templates: list[ConfigTemplate] = []
        if not self.templates_dir.exists():
            self._templates_cache = templates
            self._update_cache_timestamp()
            return templates

        for yaml_file in self.templates_dir.glob("*.yaml"):
            try:
                template = self._load_template(yaml_file)
                if template:
                    templates.append(template)
            except Exception as e:
                log(f"Failed to load template {yaml_file}: {e}", "WARN")

        self._templates_cache = sorted(templates, key=lambda t: t.name)
        self._update_cache_timestamp()
        return self._templates_cache

    def get_template(self, name: str) -> ConfigTemplate | None:
        templates = self.list_templates()
        for template in templates:
            if template.name.lower() == name.lower():
                return template
        return None

    def invalidate_cache(self) -> None:
        """Invalidate the templates cache - force reload on next list."""
        self._templates_cache = None
        super().invalidate_cache()

    def refresh_cache(self) -> None:
        """Alias for invalidate_cache for backward compatibility."""
        self.invalidate_cache()

    def _cache_is_valid(self) -> bool:
        """Check if cache is still valid based on TTL."""
        if self._templates_cache is None:
            return False
        return super()._cache_is_valid()

    def preview_template(self, name: str) -> str:
        template = self.get_template(name)
        if not template:
            return f"Template '{name}' not found."

        lines = [f"=== 模板: {template.name} ==="]
        lines.append(f"描述: {template.description}")
        lines.append("")
        lines.append("配置内容:")
        lines.append(yaml.dump(template.config, allow_unicode=True, sort_keys=False))
        return "\n".join(lines)

    def apply_template(
        self,
        name: str,
        target_path: Path | None = None,
        backup: bool = True
    ) -> bool:
        template = self.get_template(name)
        if not template:
            log(f"Template '{name}' not found.", "ERROR")
            return False

        if target_path is None:
            target_path = get_project_root() / "config" / "persona.yaml"

        if backup and target_path.exists():
            backup_path = target_path.with_suffix(f".yaml.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
            shutil.copy2(target_path, backup_path)
            log(f"Backup created: {backup_path}", "OK")

        target_path.parent.mkdir(parents=True, exist_ok=True)
        with open(target_path, "w", encoding="utf-8") as f:
            yaml.dump(template.config, f, allow_unicode=True, sort_keys=False)

        log(f"Template '{name}' applied to {target_path}", "OK")
        return True

    def _load_template(self, file_path: Path) -> ConfigTemplate | None:
        if not file_path.exists():
            return None

        try:
            from src.config_loader import ConfigLoader
            loader = ConfigLoader()
            config = loader.load_yaml(file_path)

            name = file_path.stem
            description = self._extract_description(config)

            return ConfigTemplate(
                name=name,
                description=description,
                config=config,
                file_path=file_path
            )
        except Exception as e:
            log(f"Error loading template {file_path}: {e}", "ERROR")
            return None

    def _extract_description(self, config: dict[str, Any]) -> str:
        agent = config.get("agent", {})
        role = agent.get("role", "AI Assistant")
        personality = agent.get("personality", [])

        if personality:
            assert isinstance(role, str)
            return f"{role} - {', '.join(personality[:3])}"
        assert isinstance(role, str)
        return role


# === Convenience module-level functions for backward compatibility and easy access ===

# Pre-defined persona templates (will be populated from disk on access)
PERSONA_TEMPLATES: list[str] = []


def get_template(name: str) -> ConfigTemplate | None:
    """Get a template by name (convenience function)."""
    manager = TemplateManager()
    return manager.get_template(name)


def list_templates() -> list[ConfigTemplate]:
    """List all available templates (convenience function)."""
    global PERSONA_TEMPLATES
    manager = TemplateManager()
    templates = manager.list_templates()
    PERSONA_TEMPLATES = sorted([t.name for t in templates])
    return templates
