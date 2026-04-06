"""
AgentSoul · 灵魂一致性健康检测
============================

健康检测功能检查：
1. 数据目录结构完整性
2. 配置文件格式合法性
3. 灵魂状态版本兼容性
4. 记忆文件完整性
5. 权限检查
6. 输出健康报告和修复建议
"""

import sys
import os
import json
import yaml
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime

# Add project root to path for proper imports
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from common import get_project_root, log
from src.config_loader import ConfigLoader, ValidationError


@dataclass
class HealthIssue:
    """单个健康问题"""
    level: str  # "error", "warning", "info"
    category: str  # "directory", "config", "memory", "soul_state", "permission"
    message: str
    location: Optional[str] = None
    fix_suggestion: Optional[str] = None


@dataclass
class HealthReport:
    """健康检测报告"""
    timestamp: str
    total_checks: int
    errors: int
    warnings: int
    issues: List[HealthIssue]
    is_healthy: bool
    soul_version: Optional[str] = None


class HealthChecker:
    """灵魂一致性健康检测器"""

    def __init__(self, project_root: Optional[Path] = None):
        self.project_root = project_root or get_project_root()
        self.data_root = self.project_root / "data"
        self.config_root = self.project_root / "config"

    def check_directory_structure(self) -> List[HealthIssue]:
        """检查目录结构是否完整"""
        issues = []
        required_dirs = [
            ("data", False),
            ("data/soul", False),
            ("data/soul/soul_variable", False),
            ("data/memory", False),
            ("data/memory/day", False),
            ("data/memory/week", False),
            ("data/memory/month", False),
            ("data/memory/year", False),
            ("data/memory/topic", False),
            ("data/memory/topic/archive", False),
            ("data/entity-memory", False),
            ("data/core-memory", False),
            ("data/kv-cache", False),
            ("config", False),
        ]

        for dir_path, required in required_dirs:
            full_path = self.project_root / dir_path
            if not full_path.exists():
                if required:
                    issues.append(HealthIssue(
                        level="error",
                        category="directory",
                        message=f"Missing required directory: {dir_path}",
                        location=str(full_path),
                        fix_suggestion=f"Run `mkdir -p {dir_path}` to create it"
                    ))
                else:
                    issues.append(HealthIssue(
                        level="info",
                        category="directory",
                        message=f"Optional directory doesn't exist: {dir_path}",
                        location=str(full_path),
                        fix_suggestion=f"Will be created automatically on first write"
                    ))
            else:
                # Check directory permissions
                if not os.access(full_path, os.W_OK):
                    issues.append(HealthIssue(
                        level="error",
                        category="permission",
                        message=f"Directory not writable: {dir_path}",
                        location=str(full_path),
                        fix_suggestion=f"Check permissions: chmod -R u+w {dir_path}"
                    ))

        return issues

    def check_config_files(self) -> List[HealthIssue]:
        """检查配置文件"""
        issues = []
        loader = ConfigLoader(self.project_root)

        persona_path = self.config_root / "persona.yaml"
        if not persona_path.exists():
            issues.append(HealthIssue(
                level="error",
                category="config",
                message="persona.yaml not found",
                location=str(persona_path),
                fix_suggestion="Run installation to generate default config"
            ))
            return issues

        # Try to validate config
        try:
            errors = loader.validate_current_config(persona_path, log_errors=False)
            for err in errors:
                level = "error" if err.severity == "error" else "warning"
                issues.append(HealthIssue(
                    level=level,
                    category="config",
                    message=f"Config validation: {err.message}",
                    location=f"{persona_path}:{err.field}",
                    fix_suggestion=None
                ))
        except Exception as e:
            issues.append(HealthIssue(
                level="error",
                category="config",
                message=f"Failed to parse config: {str(e)}",
                location=str(persona_path),
                fix_suggestion="Check YAML syntax"
            ))

        # Check behavior.yaml
        behavior_path = self.config_root / "behavior.yaml"
        if not behavior_path.exists():
            issues.append(HealthIssue(
                level="warning",
                category="config",
                message="behavior.yaml not found (using defaults)",
                location=str(behavior_path),
                fix_suggestion="Copy from default template if you need custom behavior settings"
            ))

        # Try to load persona config
        try:
            config = loader.load_persona_config(persona_path)
            if not config.ai.name:
                issues.append(HealthIssue(
                    level="warning",
                    category="config",
                    message="Agent name is not set",
                    location="persona.yaml.agent.name",
                    fix_suggestion="Set a meaningful name for your agent"
                ))
        except Exception as e:
            issues.append(HealthIssue(
                level="error",
                category="config",
                message=f"Failed to load config: {str(e)}",
                location=str(persona_path)
            ))

        return issues

    def check_soul_state(self) -> List[HealthIssue]:
        """检查灵魂状态文件"""
        issues = []
        state_path = self.data_root / "soul" / "soul_variable" / "state_vector.json"

        if not state_path.exists():
            issues.append(HealthIssue(
                level="warning",
                category="soul_state",
                message="Soul state file doesn't exist yet",
                location=str(state_path),
                fix_suggestion="Will be created automatically on first update_soul_state call"
            ))
            return issues

        try:
            with open(state_path, "r", encoding="utf-8") as f:
                state = json.load(f)

            # Check required fields
            required_fields = ["pleasure", "arousal", "dominance"]
            for field in required_fields:
                if field not in state:
                    issues.append(HealthIssue(
                        level="error",
                        category="soul_state",
                        message=f"Missing required field: {field}",
                        location=str(state_path),
                        fix_suggestion="Delete the file to reset to defaults"
                    ))
                else:
                    val = state[field]
                    if not isinstance(val, (int, float)) or val < -1 or val > 1:
                        issues.append(HealthIssue(
                            level="error",
                            category="soul_state",
                            message=f"Invalid value for {field}: {val} (must be between -1 and 1)",
                            location=str(state_path),
                            fix_suggestion="Delete the file to reset to defaults"
                        ))

            # Check version
            version = state.get("version")
            if version is None:
                issues.append(HealthIssue(
                    level="info",
                    category="soul_state",
                    message="No version tag found (pre-v1.0.0 format)",
                    location=str(state_path),
                    fix_suggestion="Version will be added automatically on next write"
                ))

            # Check history
            if "history" not in state:
                issues.append(HealthIssue(
                    level="warning",
                    category="soul_state",
                    message="Missing history field",
                    location=str(state_path),
                    fix_suggestion="Delete the file to reset to defaults"
                ))

        except json.JSONDecodeError as e:
            issues.append(HealthIssue(
                level="error",
                category="soul_state",
                message=f"Invalid JSON: {str(e)}",
                location=str(state_path),
                fix_suggestion="Delete the file to reset to defaults"
            ))
        except Exception as e:
            issues.append(HealthIssue(
                level="error",
                category="soul_state",
                message=f"Failed to read: {str(e)}",
                location=str(state_path)
            ))

        return issues

    def _parse_date_from_filename(self, filename: str) -> Optional[datetime]:
        """从文件名解析日期"""
        stem = filename.stem
        try:
            if len(stem) == 10 and "-" in stem:  # YYYY-MM-DD
                return datetime.strptime(stem, "%Y-%m-%d")
            elif len(stem) == 7 and "-" in stem:  # YYYY-MM
                return datetime.strptime(stem, "%Y-%m")
            elif len(stem) == 4:  # YYYY
                return datetime.strptime(stem, "%Y")
            elif len(stem) == 6 and "-W" in stem:  # YYYY-WW
                return datetime.strptime(stem + "-1", "%Y-W%w-%w")
        except ValueError:
            pass
        return None

    def _date_to_year_week(self, date: datetime) -> str:
        """将日期转换为YYYY-WW格式"""
        week = date.isocalendar()[1]
        return f"{date.year}-{week:02d}"

    def _date_to_year_month(self, date: datetime) -> str:
        """将日期转换为YYYY-MM格式"""
        return f"{date.year}-{date.month:02d}"

    def _date_to_year(self, date: datetime) -> str:
        """将日期转换为YYYY格式"""
        return f"{date.year}"

    def check_archival_consistency(self) -> List[HealthIssue]:
        """检查分层归档一致性 - 自动归档是否正确完成"""
        issues = []
        day_dir = self.data_root / "memory" / "day"
        if not day_dir.exists():
            return issues

        # 检查所有日记忆，判断是否应该已经被归档但未归档
        today = datetime.now()
        day_files = list(day_dir.glob("*.md"))

        for file in day_files:
            if file.name == ".gitkeep":
                continue

            date = self._parse_date_from_filename(file)
            if date is None:
                continue

            # 判断是否应该归档：
            # - 超过7天的日记忆应该归档到周
            days_old = (today - date).days
            if days_old >= 7:
                # 应该已经归档到周，检查对应周文件是否存在
                year_week = self._date_to_year_week(date)
                week_path = self.data_root / "memory" / "week" / f"{year_week}.md"
                if not week_path.exists():
                    issues.append(HealthIssue(
                        level="warning",
                        category="memory",
                        message=f"Daily memory {days_old} days old should be archived to weekly, but weekly file not found",
                        location=str(file),
                        fix_suggestion=f"Trigger automatic archiving by writing a new daily memory or manually create {week_path}"
                    ))

        # 检查周记忆：超过30天的应该归档到月
        week_dir = self.data_root / "memory" / "week"
        if week_dir.exists():
            week_files = list(week_dir.glob("*.md"))
            for file in week_files:
                if file.name == ".gitkeep":
                    continue

                date = self._parse_date_from_filename(file)
                if date is None:
                    continue

                days_old = (today - date).days
                if days_old >= 30:
                    year_month = self._date_to_year_month(date)
                    month_path = self.data_root / "memory" / "month" / f"{year_month}.md"
                    if not month_path.exists():
                        issues.append(HealthIssue(
                            level="warning",
                            category="memory",
                            message=f"Weekly memory {days_old} days old should be archived to monthly, but monthly file not found",
                            location=str(file),
                            fix_suggestion=f"Trigger automatic archiving by writing a new daily memory or manually create {month_path}"
                        ))

        # 检查月记忆：超过365天的应该归档到年
        month_dir = self.data_root / "memory" / "month"
        if month_dir.exists():
            month_files = list(month_dir.glob("*.md"))
            for file in month_files:
                if file.name == ".gitkeep":
                    continue

                date = self._parse_date_from_filename(file)
                if date is None:
                    continue

                days_old = (today - date).days
                if days_old >= 365:
                    year = self._date_to_year(date)
                    year_path = self.data_root / "memory" / "year" / f"{year}.md"
                    if not year_path.exists():
                        issues.append(HealthIssue(
                            level="warning",
                            category="memory",
                            message=f"Monthly memory {days_old} days old should be archived to yearly, but yearly file not found",
                            location=str(file),
                            fix_suggestion=f"Trigger automatic archiving by writing a new daily memory or manually create {year_path}"
                        ))

        return issues

    def check_memory_files(self, sample_limit: int = 10) -> List[HealthIssue]:
        """检查记忆文件（抽样检查）"""
        issues = []
        memory_dirs = [
            ("day", "day"),
            ("week", "week"),
            ("month", "month"),
            ("year", "year"),
            ("topic", "topic"),
        ]

        for dir_name, desc in memory_dirs:
            dir_path = self.data_root / "memory" / dir_name
            if not dir_path.exists():
                continue  # Already reported in directory check

            # Check a sample of files
            try:
                files = list(dir_path.glob("*.md"))
                sampled = files[:sample_limit]

                for file in sampled:
                    try:
                        # Just check if it's readable
                        with open(file, "r", encoding="utf-8") as f:
                            content = f.read()
                        if len(content.strip()) == 0 and file.name != ".gitkeep":
                            issues.append(HealthIssue(
                                level="info",
                                category="memory",
                                message=f"Empty memory file: {file.name}",
                                location=str(file)
                            ))
                    except Exception as e:
                        issues.append(HealthIssue(
                            level="warning",
                            category="memory",
                            message=f"Failed to read: {str(e)}",
                            location=str(file)
                        ))

                # Check archive directory for topics
                if dir_name == "topic":
                    archive_dir = dir_path / "archive"
                    if archive_dir.exists():
                        archive_files = list(archive_dir.glob("*.md"))
                        issues.append(HealthIssue(
                            level="info",
                            category="memory",
                            message=f"Found {len(archive_files)} archived topics",
                            location=str(archive_dir)
                        ))

            except Exception as e:
                issues.append(HealthIssue(
                    level="warning",
                    category="memory",
                    message=f"Failed to scan directory: {str(e)}",
                    location=str(dir_path)
                ))

        # Add archival consistency check
        issues.extend(self.check_archival_consistency())

        return issues

    def check_permissions(self) -> List[HealthIssue]:
        """检查关键文件权限"""
        issues = []

        # Check config directory
        if self.config_root.exists():
            if not os.access(self.config_root, os.W_OK):
                issues.append(HealthIssue(
                    level="error",
                    category="permission",
                    message="Config directory not writable",
                    location=str(self.config_root),
                    fix_suggestion="chmod u+w config/"
                ))

        # Check data directory
        if self.data_root.exists():
            if not os.access(self.data_root, os.W_OK):
                issues.append(HealthIssue(
                    level="error",
                    category="permission",
                    message="Data directory not writable",
                    location=str(self.data_root),
                    fix_suggestion="chmod -R u+w data/"
                ))

        return issues

    def run_check(self, include_memory_samples: bool = True) -> HealthReport:
        """运行完整健康检查"""
        all_issues: List[HealthIssue] = []

        all_issues.extend(self.check_directory_structure())
        all_issues.extend(self.check_config_files())
        all_issues.extend(self.check_soul_state())
        if include_memory_samples:
            all_issues.extend(self.check_memory_files())
        all_issues.extend(self.check_permissions())

        errors = sum(1 for i in all_issues if i.level == "error")
        warnings = sum(1 for i in all_issues if i.level == "warning")

        # Get soul version if available
        soul_version = None
        state_path = self.data_root / "soul" / "soul_variable" / "state_vector.json"
        if state_path.exists():
            try:
                with open(state_path, "r", encoding="utf-8") as f:
                    state = json.load(f)
                    soul_version = state.get("version")
            except Exception:
                pass

        report = HealthReport(
            timestamp=datetime.now().isoformat(),
            total_checks=len(all_issues) + 1,  # +1 for overall
            errors=errors,
            warnings=warnings,
            issues=all_issues,
            is_healthy=errors == 0,
            soul_version=soul_version
        )

        return report

    def print_report(self, report: HealthReport) -> None:
        """打印健康检测报告"""
        print("\n" + "=" * 60)
        print("AgentSoul 健康检测报告")
        print("=" * 60)
        print(f"Timestamp: {report.timestamp}")
        print(f"Soul Version: {report.soul_version or 'Unknown'}")
        print(f"Total Checks: {report.total_checks}")
        print(f"Errors: {report.errors} | Warnings: {report.warnings}")
        print(f"Overall Status: {'✓ HEALTHY' if report.is_healthy else '✗ UNHEALTHY'}")
        print()

        if report.issues:
            print("Issues found:")
            print()
            for issue in report.issues:
                level_icon = {
                    "error": "✗",
                    "warning": "⚠",
                    "info": "ℹ",
                }.get(issue.level, "•")
                print(f"  {level_icon} [{issue.category}] {issue.message}")
                if issue.location:
                    print(f"      Location: {issue.location}")
                if issue.fix_suggestion:
                    print(f"      Fix: {issue.fix_suggestion}")
                print()
        else:
            print("No issues found. Everything looks good! ✓")

        print("=" * 60 + "\n")


def main() -> None:
    """CLI 入口"""
    checker = HealthChecker()
    report = checker.run_check()
    checker.print_report(report)
    exit(0 if report.is_healthy else 1)


if __name__ == "__main__":
    main()
