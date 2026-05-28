"""
AgentSoul · Persona Kit CLI
提供 init、validate、apply、export、summarize 命令
"""
from __future__ import annotations

import argparse
import json
import shutil
import sys
from datetime import datetime
from pathlib import Path

import yaml
from agentsoul.common import get_project_root, log

from agentsoul.persona_kit.quality_check import PersonaKitChecker, check_persona_kit
from agentsoul.persona_kit.scaffold import init_persona_kit


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="agentsoul.persona_kit",
        description="AgentSoul Persona Kit 管理工具",
    )
    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    # init
    init_parser = subparsers.add_parser("init", help="初始化一个新的人格包")
    init_parser.add_argument("name", help="人格包名称")
    init_parser.add_argument("--output-dir", type=Path, help="输出目录")
    init_parser.add_argument("--description", default="", help="人格包描述")

    # validate
    validate_parser = subparsers.add_parser("validate", help="验证人格包质量")
    validate_parser.add_argument("path", type=Path, help="人格包目录路径")
    validate_parser.add_argument("--summary-json", action="store_true", help="输出 JSON 格式")
    validate_parser.add_argument("--min-score", type=int, default=0, help="最低分数阈值")

    # apply
    apply_parser = subparsers.add_parser("apply", help="应用人格包到当前配置")
    apply_parser.add_argument("path", type=Path, help="人格包目录路径")
    apply_parser.add_argument("--no-backup", action="store_true", help="不备份当前配置")
    apply_parser.add_argument("--force", action="store_true", help="跳过质量检查强制应用")

    # export
    export_parser = subparsers.add_parser("export", help="导出人格包为 zip")
    export_parser.add_argument("path", type=Path, help="人格包目录路径")
    export_parser.add_argument("--format", default="zip", choices=["zip"], help="导出格式")

    # list-backups
    subparsers.add_parser("list-backups", help="列出所有备份")

    # rollback
    rollback_parser = subparsers.add_parser("rollback", help="从备份恢复配置")
    rollback_parser.add_argument("backup_path", type=Path, help="备份目录路径")

    # summarize
    summarize_parser = subparsers.add_parser("summarize", help="输出人格包摘要")
    summarize_parser.add_argument("path", type=Path, help="人格包目录路径")

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 1

    if args.command == "init":
        return _cmd_init(args)
    elif args.command == "validate":
        return _cmd_validate(args)
    elif args.command == "apply":
        return _cmd_apply(args)
    elif args.command == "export":
        return _cmd_export(args)
    elif args.command == "list-backups":
        return _cmd_list_backups(args)
    elif args.command == "rollback":
        return _cmd_rollback(args)
    elif args.command == "summarize":
        return _cmd_summarize(args)
    else:
        parser.print_help()
        return 1


def _cmd_init(args: argparse.Namespace) -> int:
    try:
        kit_dir = init_persona_kit(
            name=args.name,
            output_dir=args.output_dir,
            description=args.description,
        )
        log(f"人格包已创建: {kit_dir}", "OK")
        return 0
    except Exception as e:
        log(f"初始化失败: {e}", "ERROR")
        return 1


def _cmd_validate(args: argparse.Namespace) -> int:
    kit_path = args.path.resolve()
    if not kit_path.exists():
        log(f"路径不存在: {kit_path}", "ERROR")
        return 1

    report = check_persona_kit(
        kit_path=kit_path,
        summary_json=args.summary_json,
        min_score=args.min_score,
    )

    if args.min_score > 0 and report.score < args.min_score:
        return 1
    return 0 if report.passed else 1


def _cmd_apply(args: argparse.Namespace) -> int:
    """应用人格包到当前配置，支持备份和回滚。"""
    kit_path = args.path.resolve()
    if not kit_path.exists():
        log(f"路径不存在: {kit_path}", "ERROR")
        return 1

    project_root = get_project_root()
    config_dir = project_root / "config"

    # Quality check (unless --force)
    if not args.force:
        checker = PersonaKitChecker()
        report = checker.check(kit_path)
        if not report.passed:
            log(f"质量检查未通过 (得分: {report.score}/100)。使用 --force 强制应用。", "ERROR")
            report.print_report()
            return 1

    # Backup current config (unless --no-backup)
    backup_dir = project_root / "var" / "persona_kit_backups"
    if not args.no_backup:
        backup_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_subdir = backup_dir / f"backup_{timestamp}"
        backup_subdir.mkdir(exist_ok=True)

        for fname in ["persona.yaml", "behavior.yaml"]:
            src = config_dir / fname
            if src.exists():
                shutil.copy2(src, backup_subdir / fname)
                log(f"已备份: {fname} → {backup_subdir / fname}", "OK")

        # Write backup metadata
        meta = {
            "timestamp": timestamp,
            "source_kit": str(kit_path),
            "backed_up_files": [f for f in ["persona.yaml", "behavior.yaml"] if (config_dir / f).exists()],
        }
        with open(backup_subdir / "metadata.json", "w", encoding="utf-8") as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

    # Apply kit config files
    applied = []
    for fname in ["persona.yaml", "behavior.yaml"]:
        src = kit_path / fname
        dst = config_dir / fname
        if src.exists():
            shutil.copy2(src, dst)
            applied.append(fname)
            log(f"已应用: {fname}", "OK")

    if not applied:
        log("人格包中没有找到可应用的配置文件", "ERROR")
        return 1

    # Write version record
    version_file = kit_path / ".applied_version.json"
    version_record = {
        "applied_at": datetime.now().isoformat(),
        "kit_path": str(kit_path),
        "files_applied": applied,
        "backup_path": str(backup_subdir) if not args.no_backup else None,
    }
    with open(version_file, "w", encoding="utf-8") as f:
        json.dump(version_record, f, ensure_ascii=False, indent=2)

    log(f"\n人格包 '{kit_path.name}' 已成功应用！", "OK")
    log(f"已应用文件: {', '.join(applied)}", "INFO")
    if not args.no_backup:
        log(f"备份位置: {backup_subdir}", "INFO")
    log("提示: 运行 health check 验证配置一致性", "INFO")

    return 0


def _cmd_export(args: argparse.Namespace) -> int:
    """导出人格包为 zip 文件。"""
    import zipfile

    kit_path = args.path.resolve()
    if not kit_path.exists():
        log(f"路径不存在: {kit_path}", "ERROR")
        return 1

    output_path = kit_path.parent / f"{kit_path.name}.zip"
    with zipfile.ZipFile(output_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file in kit_path.rglob("*"):
            if file.is_file() and not file.name.startswith("."):
                arcname = file.relative_to(kit_path.parent)
                zf.write(file, arcname)

    log(f"已导出: {output_path}", "OK")
    return 0


def _cmd_list_backups(_args: argparse.Namespace) -> int:
    """列出所有备份。"""
    project_root = get_project_root()
    backup_dir = project_root / "var" / "persona_kit_backups"

    if not backup_dir.exists():
        log("没有找到任何备份", "INFO")
        return 0

    backups = sorted(backup_dir.iterdir(), reverse=True)
    if not backups:
        log("没有找到任何备份", "INFO")
        return 0

    log(f"\n{'='*50}", "INFO")
    log("Persona Kit 备份列表", "INFO")
    log(f"{'='*50}", "INFO")

    for backup in backups:
        if not backup.is_dir():
            continue
        meta_path = backup / "metadata.json"
        if meta_path.exists():
            with open(meta_path, encoding="utf-8") as f:
                meta = json.load(f)
            log(f"\n  {backup.name}", "INFO")
            log(f"    时间: {meta.get('timestamp', '?')}", "INFO")
            log(f"    来源: {meta.get('source_kit', '?')}", "INFO")
            log(f"    文件: {', '.join(meta.get('backed_up_files', []))}", "INFO")
        else:
            log(f"\n  {backup.name} (无元数据)", "INFO")

    return 0


def _cmd_rollback(args: argparse.Namespace) -> int:
    """从备份恢复配置。"""
    backup_path = args.backup_path.resolve()
    if not backup_path.exists():
        log(f"备份路径不存在: {backup_path}", "ERROR")
        return 1

    project_root = get_project_root()
    config_dir = project_root / "config"

    restored = []
    for fname in ["persona.yaml", "behavior.yaml"]:
        src = backup_path / fname
        dst = config_dir / fname
        if src.exists():
            shutil.copy2(src, dst)
            restored.append(fname)
            log(f"已恢复: {fname}", "OK")

    if not restored:
        log("备份中没有找到可恢复的配置文件", "ERROR")
        return 1

    log(f"\n已从备份 {backup_path.name} 恢复配置！", "OK")
    log(f"已恢复文件: {', '.join(restored)}", "INFO")
    return 0


def _cmd_summarize(args: argparse.Namespace) -> int:
    kit_path = args.path.resolve()
    if not kit_path.exists():
        log(f"路径不存在: {kit_path}", "ERROR")
        return 1


    # Load package.yaml
    pkg_path = kit_path / "package.yaml"
    if pkg_path.exists():
        with open(pkg_path, encoding="utf-8") as f:
            pkg = yaml.safe_load(f) or {}
        log(f"\n{'='*40}", "INFO")
        log(f"Persona Kit: {pkg.get('name', kit_path.name)}", "INFO")
        log(f"版本: {pkg.get('version', '未指定')}", "INFO")
        log(f"描述: {pkg.get('description', '无')}", "INFO")
        log(f"运行档位: {', '.join(pkg.get('runtime_levels', []))}", "INFO")

    # Load persona.yaml summary
    persona_path = kit_path / "persona.yaml"
    if persona_path.exists():
        with open(persona_path, encoding="utf-8") as f:
            persona = yaml.safe_load(f) or {}
        agent = persona.get("agent", {})
        log(f"\nAgent: {agent.get('name', '未设置')}", "INFO")
        log(f"角色: {agent.get('role', '未设置')}", "INFO")
        log(f"性格: {', '.join(agent.get('personality', []))}", "INFO")

        edna = agent.get("expression_dna", {})
        if edna:
            log(f"表达 DNA: 句长={edna.get('sentence_length', '?')}, "
                f"问句比={edna.get('question_ratio', '?')}, "
                f"确定性={edna.get('certainty_style', '?')}", "INFO")

        hb = agent.get("honest_boundaries", {})
        if hb:
            log(f"能力边界: {len(hb.get('limitations', []))} 条限制, "
                f"{len(hb.get('blind_spots', []))} 条盲区", "INFO")

    # Show applied version if exists
    version_file = kit_path / ".applied_version.json"
    if version_file.exists():
        with open(version_file, encoding="utf-8") as f:
            ver = json.load(f)
        log(f"\n上次应用: {ver.get('applied_at', '?')}", "INFO")
        log(f"应用文件: {', '.join(ver.get('files_applied', []))}", "INFO")
        if ver.get("backup_path"):
            log(f"备份位置: {ver['backup_path']}", "INFO")

    # Run quality check
    checker = PersonaKitChecker()
    report = checker.check(kit_path)
    log(f"\n质量得分: {report.score}/100", "INFO")
    log(f"状态: {'通过' if report.passed else '未通过'}", "INFO")
    log(f"错误: {report.error_count}  警告: {report.warning_count}", "INFO")

    return 0


if __name__ == "__main__":
    sys.exit(main())
