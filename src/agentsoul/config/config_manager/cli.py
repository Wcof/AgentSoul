#!/usr/bin/env python3
"""
AgentSoul · 配置管理命令行工具
提供模板列表、预览、应用和配置验证功能
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path
from typing import Any

import yaml

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from agentsoul.common import get_project_root, log
from agentsoul.config.config_manager.templates import TemplateManager
from agentsoul.config.config_manager.validator import ConfigValidator


def _resolve_path(path_str: str | None, default: Path) -> Path:
    return Path(path_str) if path_str else default


def _check_file_exists(file_path: Path, error_msg: str) -> None:
    if not file_path.exists():
        log(error_msg, "ERROR")
        sys.exit(1)


def _load_config(config_path: Path) -> dict[str, Any]:
    try:
        with open(config_path, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as e:
        log(f"读取配置文件失败: {e}", "ERROR")
        sys.exit(1)


def list_templates() -> None:
    """列出所有可用的配置模板"""
    manager = TemplateManager()
    templates = manager.list_templates()

    if not templates:
        log("没有找到配置模板", "WARN")
        return

    log(f"找到 {len(templates)} 个配置模板:", "INFO")
    print()
    for i, template in enumerate(templates, 1):
        print(f"  {i}. {template.name}")
        print(f"     {template.description}")
    print()


def preview_template(name: str) -> None:
    """预览指定的配置模板"""
    manager = TemplateManager()
    preview = manager.preview_template(name)
    print()
    print(preview)
    print()


def apply_template(name: str, target_path: str | None = None, no_backup: bool = False) -> None:
    """应用配置模板"""
    manager = TemplateManager()
    target = _resolve_path(target_path, get_project_root() / "config" / "persona.yaml")

    success = manager.apply_template(
        name=name,
        target_path=target,
        backup=not no_backup
    )

    print()
    log("模板应用成功！", "OK") if success else log("模板应用失败", "ERROR")
    sys.exit(0 if success else 1)


def validate_config(config_path: str | None = None) -> None:
    """验证配置文件"""
    resolved_config_path = _resolve_path(config_path, get_project_root() / "config" / "persona.yaml")
    _check_file_exists(resolved_config_path, f"配置文件不存在: {resolved_config_path}")

    config = _load_config(resolved_config_path)
    validator = ConfigValidator()
    errors = validator.validate(config)

    print()
    log(f"验证配置文件: {config_path}", "INFO")
    validator.print_errors(errors)

    if not validator.is_valid(config):
        sys.exit(1)


def export_config(output_path: str | None = None) -> None:
    """导出当前配置"""
    source_path = get_project_root() / "config" / "persona.yaml"
    resolved_output_path = _resolve_path(output_path, get_project_root() / "exported_config.yaml")

    _check_file_exists(source_path, f"配置文件不存在: {source_path}")

    try:
        shutil.copy2(source_path, resolved_output_path)
        log(f"配置已导出到: {resolved_output_path}", "OK")
    except Exception as e:
        log(f"导出配置失败: {e}", "ERROR")
        sys.exit(1)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="AgentSoul 配置管理工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  python -m src.config_manager.cli list-templates
  python -m src.config_manager.cli preview-template friendly
  python -m src.config_manager.cli apply-template professional
  python -m src.config_manager.cli validate-config
        """
    )

    subparsers = parser.add_subparsers(title="命令", dest="command", required=True)

    subparsers.add_parser("list-templates", help="列出所有可用的配置模板")

    preview_parser = subparsers.add_parser("preview-template", help="预览指定的配置模板")
    preview_parser.add_argument("name", help="模板名称")

    apply_parser = subparsers.add_parser("apply-template", help="应用配置模板")
    apply_parser.add_argument("name", help="模板名称")
    apply_parser.add_argument("--target", help="目标配置文件路径")
    apply_parser.add_argument("--no-backup", action="store_true", help="不创建备份")

    validate_parser = subparsers.add_parser("validate-config", help="验证配置文件")
    validate_parser.add_argument("--path", help="配置文件路径")

    export_parser = subparsers.add_parser("export-config", help="导出当前配置")
    export_parser.add_argument("--output", help="输出文件路径")

    args = parser.parse_args()

    if args.command == "list-templates":
        list_templates()
    elif args.command == "preview-template":
        preview_template(args.name)
    elif args.command == "apply-template":
        apply_template(args.name, args.target, args.no_backup)
    elif args.command == "validate-config":
        validate_config(args.path)
    elif args.command == "export-config":
        export_config(args.output)


if __name__ == "__main__":
    main()
