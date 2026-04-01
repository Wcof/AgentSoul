"""
AgentSoul · 配置模板管理
提供配置模板的加载、预览和应用功能
"""

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Any
import yaml
import shutil
from datetime import datetime

from common import log, get_project_root
from src.config_loader import ConfigLoader


@dataclass
class ConfigTemplate:
    name: str
    description: str
    config: Dict[str, Any]
    file_path: Path


class TemplateManager:
    def __init__(self, templates_dir: Optional[Path] = None):
        if templates_dir is None:
            templates_dir = get_project_root() / "config" / "templates"
        self.templates_dir = templates_dir
        self._templates_cache: Optional[List[ConfigTemplate]] = None

    def list_templates(self, use_cache: bool = True) -> List[ConfigTemplate]:
        if use_cache and self._templates_cache is not None:
            return self._templates_cache
        
        templates = []
        if not self.templates_dir.exists():
            self._templates_cache = templates
            return templates

        for yaml_file in self.templates_dir.glob("*.yaml"):
            try:
                template = self._load_template(yaml_file)
                if template:
                    templates.append(template)
            except Exception as e:
                log(f"Failed to load template {yaml_file}: {e}", "WARN")

        self._templates_cache = sorted(templates, key=lambda t: t.name)
        return self._templates_cache

    def get_template(self, name: str) -> Optional[ConfigTemplate]:
        templates = self.list_templates()
        for template in templates:
            if template.name.lower() == name.lower():
                return template
        return None
    
    def refresh_cache(self) -> None:
        self._templates_cache = None

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
        target_path: Optional[Path] = None,
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

    def _load_template(self, file_path: Path) -> Optional[ConfigTemplate]:
        if not file_path.exists():
            return None

        try:
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

    def _extract_description(self, config: Dict[str, Any]) -> str:
        agent = config.get("agent", {})
        role = agent.get("role", "AI Assistant")
        personality = agent.get("personality", [])

        if personality:
            return f"{role} - {', '.join(personality[:3])}"
        return role
