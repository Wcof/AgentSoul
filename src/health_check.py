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
from __future__ import annotations

import json
import os
import sys
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any

# Calculate project root manually before importing common (chicken-and-egg)
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from common import get_project_root, log  # noqa: E402
from src.common.health_gate import (  # noqa: E402
    HealthSummary,
    UnifiedCheckResult,
    calculate_gate_result,
    get_default_assessment,
    handle_summary_output,
)
from src.config_loader import ConfigLoader  # noqa: E402


@dataclass
class HealthIssue:
    """单个健康问题"""
    level: str  # "error", "warning", "info"
    category: str  # "directory", "config", "memory", "soul_state", "permission"
    message: str
    location: str | None = None
    fix_suggestion: str | None = None


@dataclass
class HealthReport:
    """健康检测报告"""
    timestamp: str
    total_checks: int
    errors: int
    warnings: int
    issues: list[HealthIssue]
    is_healthy: bool
    soul_version: str | None = None


class HealthChecker:
    """灵魂一致性健康检测器"""

    def __init__(self, project_root: Path | None = None):
        self.project_root = project_root or get_project_root()
        self.data_root = self.project_root / "data"
        self.config_root = self.project_root / "config"
        self._soul_version: str | None = None

    def check_directory_structure(self) -> list[HealthIssue]:
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
                        fix_suggestion="Will be created automatically on first write"
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

    def check_config_files(self) -> list[HealthIssue]:
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

    def check_soul_state(self) -> list[HealthIssue]:
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
            with open(state_path, encoding="utf-8") as f:
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
            self._soul_version = state.get("version")
            version = self._soul_version
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

    def _parse_date_from_filename(self, file: Path) -> datetime | None:
        """从文件名解析日期"""
        stem = file.stem
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

    def check_archival_consistency(self) -> list[HealthIssue]:
        """检查分层归档一致性 - 自动归档是否正确完成"""
        issues: list[HealthIssue] = []
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

    def check_memory_files(self, sample_limit: int = 10) -> list[HealthIssue]:
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
                        with open(file, encoding="utf-8") as f:
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

    def check_permissions(self) -> list[HealthIssue]:
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
        all_issues: list[HealthIssue] = []

        all_issues.extend(self.check_directory_structure())
        all_issues.extend(self.check_config_files())
        all_issues.extend(self.check_soul_state())
        if include_memory_samples:
            all_issues.extend(self.check_memory_files())
        all_issues.extend(self.check_permissions())

        errors = sum(1 for i in all_issues if i.level == "error")
        warnings = sum(1 for i in all_issues if i.level == "warning")

        # Get soul version from cached result (already parsed in check_soul_state)
        soul_version = self._soul_version

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

    def to_dict(self, report: HealthReport) -> dict[str, Any]:
        """将报告转换为字典格式，方便 JSON 序列化"""
        def issue_to_dict(issue: HealthIssue) -> dict[str, Any]:
            return {
                "level": issue.level,
                "category": issue.category,
                "message": issue.message,
                "location": issue.location,
                "fix_suggestion": issue.fix_suggestion,
            }

        return {
            "timestamp": report.timestamp,
            "total_checks": report.total_checks,
            "errors": report.errors,
            "warnings": report.warnings,
            "issues": [issue_to_dict(i) for i in report.issues],
            "is_healthy": report.is_healthy,
            "soul_version": report.soul_version,
        }

    def save_report_json(self, report: HealthReport, output_path: Path) -> None:
        """保存报告到 JSON 文件，适合程序化读取"""
        data = self.to_dict(report)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        log(f"JSON 健康报告已保存到 {output_path}", level="INFO")


def main() -> None:
    """CLI 入口"""
    import argparse
    parser = argparse.ArgumentParser(
        description="AgentSoul 灵魂一致性健康检测器 - 检查目录结构、配置文件、灵魂状态、记忆文件和权限"
    )
    parser.add_argument(
        "--output", "-o",
        help="输出报告文件路径 (默认: stdout 打印文本)",
        default=None
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="输出 JSON 格式而不是文本，适合程序化读取 (默认: 文本格式)",
        default=False
    )
    parser.add_argument(
        "--project-root", "-r",
        help="项目根目录路径 (默认: 当前目录)",
        default=None
    )
    parser.add_argument(
        "--min-score",
        type=int,
        help="最低通过分数门槛 (0-100)。若有 errors 且 error 数量 > 0，则不通过；整体健康度检查通过即合格，分数由 (100 - errors * 10 - warnings * 2) 计算，若得分低于该值，进程以状态码2退出",
        default=None,
    )
    parser.add_argument(
        "--summary-json",
        action="store_true",
        help="输出机器可读的一行统一格式摘要 JSON，适合 CI/脚本消费 (使用标准 HealthSummary schema)",
        default=False,
    )
    args = parser.parse_args()

    project_root = Path(args.project_root) if args.project_root else None
    checker = HealthChecker(project_root)
    report = checker.run_check()

    if args.output and args.json:
        # Output JSON to file
        output_path = Path(args.output)
        checker.save_report_json(report, output_path)
        # Still print summary to stdout
        print("\n" + "=" * 60)
        print("AgentSoul 健康检测报告")
        print("=" * 60)
        print(f"Timestamp: {report.timestamp}")
        print(f"Soul Version: {report.soul_version or 'Unknown'}")
        print(f"Total Checks: {report.total_checks}")
        print(f"Errors: {report.errors} | Warnings: {report.warnings}")
        print(f"Overall Status: {'✓ HEALTHY' if report.is_healthy else '✗ UNHEALTHY'}")
        print()
        print(f"✓ JSON report saved to: {output_path}")
        print("=" * 60 + "\n")
    elif args.output:
        # Output text to file
        original_stdout = sys.stdout
        try:
            output_path = Path(args.output)
            output_path.parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                sys.stdout = f
                checker.print_report(report)
        finally:
            sys.stdout = original_stdout
        log(f"文本健康报告已保存到 {output_path}", level="INFO")
    elif args.json:
        # Output JSON to stdout
        data = checker.to_dict(report)
        print(json.dumps(data, indent=2, ensure_ascii=False))
    else:
        # Print text report to stdout
        checker.print_report(report)

    # Calculate overall score based on errors and warnings
    # Each error reduces score by 10, each warning reduces by 2
    overall_score = max(0, 100 - (report.errors * 10) - (report.warnings * 2))
    assessment = get_default_assessment(overall_score)

    # Calculate gate passing
    gate_passed, exit_code = calculate_gate_result(
        overall_score, args.min_score, base_success=report.is_healthy
    )

    if args.summary_json:
        # Convert HealthIssue to check results using unified schema
        # Group issues by category as individual checks
        issues_by_category = defaultdict(list)
        for issue in report.issues:
            issues_by_category[issue.category].append(issue)

        check_results = []
        category_descriptions = {
            "directory": "目录结构完整性",
            "config": "配置文件合法性",
            "memory": "记忆文件完整性",
            "soul_state": "灵魂状态兼容性",
            "permission": "关键路径权限",
        }

        for category, issues in issues_by_category.items():
            # A category passes if it has no errors (warnings allowed)
            errors_in_cat = sum(1 for i in issues if i.level == "error")
            score = max(0, 100 - errors_in_cat * 20)
            desc = category_descriptions.get(category, category)
            check_result = UnifiedCheckResult(
                name=category,
                description=desc,
                score=score,
                passed=errors_in_cat == 0,
                issues=[i.message for i in issues],
                recommendations=[i.fix_suggestion for i in issues if i.fix_suggestion],
            )
            check_results.append(check_result)

        # Add overall check
        overall_check = UnifiedCheckResult(
            name="整体健康",
            description="所有检测项目汇总，errors 数量决定是否通过",
            score=overall_score,
            passed=report.is_healthy,
            issues=[],
            recommendations=[],
        )
        check_results.insert(0, overall_check)

        output_format = "json" if args.json else "text"
        handle_summary_output(
            checker_name="health_check",
            overall_score=overall_score,
            assessment=assessment,
            timestamp=report.timestamp,
            min_score=args.min_score,
            gate_passed=gate_passed,
            exit_code=exit_code,
            check_results=check_results,
            output_path=args.output,
            output_format=output_format,
        )

    elif args.min_score is not None:
        if gate_passed:
            print(
                f"\n✅ 门控通过：整体得分 {overall_score} >= 最低要求 {args.min_score}"
            )
        else:
            print(
                f"\n❌ 门控未通过：整体得分 {overall_score} < 最低要求 {args.min_score}"
            )

    if exit_code != 0:
        sys.exit(exit_code)


if __name__ == "__main__":
    main()
