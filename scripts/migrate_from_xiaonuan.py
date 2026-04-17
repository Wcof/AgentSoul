#!/usr/bin/env python3
"""
AgentSoul · 向后迁移脚本 v1.0

功能：
- 从 xiaonuan 项目迁移数据到 AgentSoul
- 转换配置文件格式
- 生成迁移报告

用法：
    python3 scripts/migrate_from_xiaonuan.py                          # 交互式
    python3 scripts/migrate_from_xiaonuan.py --source ~/.xiaonuan    # 指定源路径
    python3 scripts/migrate_from_xiaonuan.py --dry-run               # 预览模式
"""

import argparse
import shutil
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime
import yaml

# Add project root to path
import sys
sys.path.insert(0, str(PROJECT_ROOT := Path(__file__).parent.parent))

from agentsoul.config.config_loader import ConfigLoader, create_default_persona
from agentsoul.runtime.path_compat import PathResolver, convert_legacy_path

DEFAULT_XIAONUAN_PATHS = [
    Path.home() / ".xiaonuan",
    Path.home() / ".openclaw" / "workspace" / "xiaonuan",
    Path.home() / "xiaonuan",
]


@dataclass
class MigrationRecord:
    source: str
    destination: str
    status: str
    action: str
    details: str = ""


@dataclass
class MigrationReport:
    start_time: str = ""
    end_time: str = ""
    source_path: str = ""
    total_files: int = 0
    migrated_files: int = 0
    skipped_files: int = 0
    failed_files: int = 0
    records: List[MigrationRecord] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


class XiaonuanMigrator:
    def __init__(self, source_root: Path, dry_run: bool = False):
        self.source_root = source_root
        self.target_root = PROJECT_ROOT
        self.dry_run = dry_run
        self.report = MigrationReport()
        self.config_loader = ConfigLoader(PROJECT_ROOT)
        self.path_resolver = PathResolver(PROJECT_ROOT)

    def detect_source(self) -> Optional[Path]:
        for path in DEFAULT_XIAONUAN_PATHS:
            if path.exists() and (path / "_xiaonuan_installed").exists():
                return path
        if self.source_root.exists():
            return self.source_root
        return None

    def convert_persona_config(self, source_path: Path) -> Tuple[Dict, List[str]]:
        # Start with default template from create_default_persona
        converted = {
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
        warnings = []

        if not source_path.exists():
            return converted, warnings

        try:
            with open(source_path, "r", encoding="utf-8") as f:
                source_config = yaml.safe_load(f) or {}

            old_persona = source_config.get("persona", source_config.get("ai", {}))
            old_ai = old_persona.get("ai", old_persona)

            if old_ai:
                agent_name = old_ai.get("name", "")
                if agent_name and not any(char in agent_name for char in ["暖"]):
                    converted["agent"]["name"] = agent_name
                elif any(char in agent_name for char in ["暖"]):
                    warnings.append(f"AI名称 '{agent_name}' 已重置为 'Agent'（通用化）")

                converted["agent"]["nickname"] = old_ai.get("nickname", "")
                converted["agent"]["naming_mode"] = old_ai.get("naming_mode", "default")
                converted["agent"]["role"] = old_ai.get("role", "AI Assistant")
                converted["agent"]["personality"] = self.config_loader._to_list(
                    old_ai.get("personality", [])
                )
                converted["agent"]["core_values"] = self.config_loader._to_list(
                    old_ai.get("core_values", [])
                )
                if "interaction_style" in old_ai:
                    converted["agent"]["interaction_style"].update(old_ai["interaction_style"])

            old_master = old_persona.get("master", {})
            if old_master:
                master_name = old_master.get("name", "")
                if master_name and not any(char in master_name for char in ["辉"]):
                    converted["master"]["name"] = master_name
                elif any(char in master_name for char in ["辉"]):
                    warnings.append(f"主人姓名 '{master_name}' 已脱敏（通用化）")

                converted["master"]["nickname"] = self.config_loader._to_list(
                    old_master.get("nickname", old_master.get("nicknames", []))
                )
                converted["master"]["timezone"] = old_master.get(
                    "timezone", "Asia/Shanghai"
                )
                converted["master"]["labels"] = self.config_loader._to_list(
                    old_master.get("labels", [])
                )

        except Exception as e:
            warnings.append(f"配置转换失败: {e}")

        return converted, warnings

    def migrate_file(self, source: Path, target: Path) -> MigrationRecord:
        rel_path = str(source.relative_to(self.source_root))
        target.parent.mkdir(parents=True, exist_ok=True)

        if self.dry_run:
            return MigrationRecord(
                source=rel_path,
                destination=str(target.relative_to(self.target_root)),
                status="dry_run",
                action="would_copy",
                details=f"将复制到 {target}"
            )

        try:
            if source.suffix == ".yaml" and "persona" in source.name:
                config, warnings = self.convert_persona_config(source)
                with open(target, "w", encoding="utf-8") as f:
                    yaml.dump(config, f, allow_unicode=True, sort_keys=False)
                for w in warnings:
                    self.report.warnings.append(f"{rel_path}: {w}")
                return MigrationRecord(
                    source=rel_path,
                    destination=str(target.relative_to(self.target_root)),
                    status="success",
                    action="converted",
                    details=f"配置已转换，包含 {len(warnings)} 个警告"
                )
            else:
                shutil.copy2(source, target)
                return MigrationRecord(
                    source=rel_path,
                    destination=str(target.relative_to(self.target_root)),
                    status="success",
                    action="copied",
                    details=f"已复制"
                )
        except Exception as e:
            self.report.errors.append(f"{rel_path}: {e}")
            return MigrationRecord(
                source=rel_path,
                destination=str(target.relative_to(self.target_root)),
                status="error",
                action="failed",
                details=str(e)
            )

    def scan_and_migrate(self) -> MigrationReport:
        self.report.start_time = datetime.now().isoformat()
        self.report.source_path = str(self.source_root)

        if not self.source_root.exists():
            self.report.errors.append(f"源路径不存在: {self.source_root}")
            return self.report

        for source_path in self.source_root.rglob("*"):
            if not source_path.is_file():
                continue

            rel_path = str(source_path.relative_to(self.source_root))
            self.report.total_files += 1

            if "xiaonuan" in rel_path.lower() and "_xiaonuan_installed" not in rel_path:
                new_rel = rel_path.replace("xiaonuan", "agent", 1)
            else:
                new_rel = rel_path

            target_path = self.target_root / new_rel

            record = self.migrate_file(source_path, target_path)
            self.report.records.append(record)

            if record.status == "success":
                self.report.migrated_files += 1
            elif record.status == "skipped":
                self.report.skipped_files += 1
            else:
                self.report.failed_files += 1

        self.report.end_time = datetime.now().isoformat()
        return self.report

    def generate_report(self) -> str:
        lines = [
            "# 迁移报告",
            "",
            f"**迁移时间**: {self.report.start_time}",
            f"**完成时间**: {self.report.end_time}",
            f"**源路径**: {self.report.source_path}",
            f"**目标路径**: {self.target_root}",
            "",
            "## 统计",
            "",
            f"| 指标 | 数值 |",
            f"|------|------|",
            f"| 总文件数 | {self.report.total_files} |",
            f"| 成功迁移 | {self.report.migrated_files} |",
            f"| 跳过 | {self.report.skipped_files} |",
            f"| 失败 | {self.report.failed_files} |",
        ]

        if self.report.warnings:
            lines.extend(["", "## 警告", ""])
            for w in self.report.warnings:
                lines.append(f"- ⚠️ {w}")

        if self.report.errors:
            lines.extend(["", "## 错误", ""])
            for e in self.report.errors:
                lines.append(f"- ❌ {e}")

        if not self.dry_run and self.report.migrated_files > 0:
            lines.extend([
                "",
                "---",
                "",
                "## 后续步骤",
                "",
                "1. 检查迁移报告中的警告和错误",
                "2. 验证关键数据文件是否正确迁移",
                "3. 运行 `python3 install.py --persona` 重新生成人格包",
                "4. 如需完全分离，可删除原 xiaonuan 数据",
            ])

        if self.dry_run:
            lines.extend(["", "---", "", "**注意**: 这是预览模式，未实际执行迁移。"])

        return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser(description="AgentSoul 迁移工具")
    parser.add_argument(
        "--source", type=str,
        help="xiaonuan 源路径（默认自动检测）"
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="预览模式，不实际执行迁移"
    )
    parser.add_argument(
        "--output", type=str,
        help="报告输出路径"
    )

    args = parser.parse_args()

    source_path = Path(args.source) if args.source else None
    migrator = XiaonuanMigrator(source_path or PROJECT_ROOT, dry_run=args.dry_run)

    detected = migrator.detect_source()
    if not detected:
        print("❌ 未找到 xiaonuan 源数据")
        print("请使用 --source 参数指定路径")
        return 1

    print(f"🔍 检测到源路径: {detected}")
    migrator.source_root = detected

    print("📦 开始扫描和迁移...")
    report = migrator.scan_and_migrate()

    report_md = migrator.generate_report()

    if args.output:
        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(report_md, encoding="utf-8")
        print(f"✅ 报告已生成: {output_path}")
    else:
        print(report_md)

    if report.failed_files > 0:
        print(f"\n⚠️ 迁移完成，但有 {report.failed_files} 个文件失败")

    return 0 if report.failed_files == 0 else 1


if __name__ == "__main__":
    exit(main())