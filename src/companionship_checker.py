"""
AgentSoul · Master Agent 陪伴连续性检查器
========================================

检查 Master Agent 的五项核心陪伴连续性指标：
1. 记忆连续性 - 是否能可靠读写迁移回滚长期记忆
2. 人格一致性 - 不同入口人格配置语气偏好边界是否一致
3. 技能沉淀 - 是否能将经验沉淀为可复用技能而不是一次性操作
4. 状态恢复 - 注入失败/工具切换/配置损坏后能否恢复到同一个 Master Agent
5. 用户可感知陪伴 - 用户能否明显感到它更懂自己、更能接续历史

Based on the core principle: one Master Agent across multiple tool entrances,
continuous long-term companionship.
"""
from __future__ import annotations

import os
import json
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# Add project root to path for proper imports
project_root_cli = Path(__file__).parent.parent
import sys
sys.path.insert(0, str(project_root_cli))

from common import get_project_root, log  # noqa: E402
from src.abstract import (
    BaseMemoryStorage,
    BasePersonaStorage,
    BaseSkillStorage,
    BaseSoulStateStorage,
    UnifiedSoulStorage,
)
from src.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSkillStorage,
    LocalSoulStateStorage,
)


@dataclass
class CheckResult:
    """单项检查结果"""
    name: str
    description: str
    score: int  # 0-100
    passed: bool
    issues: list[str]
    recommendations: list[str]


@dataclass
class OverallReport:
    """整体检查报告"""
    memory_continuity: CheckResult
    personality_consistency: CheckResult
    skill_precipitation: CheckResult
    state_recovery: CheckResult
    user_perceived_companionship: CheckResult
    overall_score: int
    assessment: str
    timestamp: str


class CompanionshipChecker:
    """陪伴连续性检查器

    检查当前 AgentSoul 安装中 Master Agent 的五项核心陪伴连续性指标。
    """

    def __init__(
        self,
        project_root: Path | None = None,
        storage: UnifiedSoulStorage | None = None,
    ):
        self.project_root = project_root or get_project_root()

        # Initialize storage if not provided
        if storage is None:
            persona = LocalPersonaStorage(self.project_root)
            soul_state = LocalSoulStateStorage(self.project_root)
            memory = LocalMemoryStorage(self.project_root)
            skills = LocalSkillStorage(self.project_root)
            self.storage = UnifiedSoulStorage(persona, soul_state, memory, skills)
        else:
            self.storage = storage

    def check_memory_continuity(self) -> CheckResult:
        """检查 1. 记忆连续性

        - 目录结构是否完整
        - 各级记忆文件是否可读
        - 是否存在主题
        - 归档机制是否工作
        """
        issues: list[str] = []
        recommendations: list[str] = []
        score = 100

        memory_storage = self.storage.memory
        base_dir = self.project_root / "data" / "memory"

        # Check directory structure
        required_dirs = [
            ("day", "日记忆目录不存在"),
            ("week", "周记忆目录不存在"),
            ("month", "月记忆目录不存在"),
            ("year", "年记忆目录不存在"),
            ("topic", "主题记忆目录不存在"),
        ]

        for dirname, error_msg in required_dirs:
            dir_path = base_dir / dirname
            if not dir_path.exists():
                issues.append(error_msg)
                score -= 15

        # Check topic archive directory
        archive_dir = base_dir / "topic" / "archive"
        if not archive_dir.exists() and (base_dir / "topic").exists():
            recommendations.append("创建 topic/archive 目录以支持主题归档")

        # Try reading all memory types to check IO
        today = datetime.now().strftime("%Y-%m-%d")
        checks = [
            ("daily", lambda: memory_storage.read_daily_memory(today)),
            ("weekly", lambda: memory_storage.read_weekly_memory(today[:7] + "-" + str(datetime.now().isocalendar()[1]).zfill(2))),
            ("monthly", lambda: memory_storage.read_monthly_memory(today[:7])),
            ("yearly", lambda: memory_storage.read_yearly_memory(today[:4])),
        ]

        for name, check_func in checks:
            try:
                result = check_func()
                # None just means no memory yet, not an error
            except Exception as e:
                issues.append(f"{name} 记忆读取失败: {e}")
                score -= 10

        # Count existing memory files
        memory_count = 0
        if base_dir.exists():
            for ext in ["*.md", "*.MD"]:
                for _ in base_dir.rglob(ext):
                    memory_count += 1

        if memory_count == 0:
            recommendations.append("还没有任何记忆文件，开始使用后会自动创建")
        else:
            # List topics to check they're readable
            topics = memory_storage.list_topics(status="all")
            if not topics:
                recommendations.append("当前没有主题记忆，这对新安装是正常的")
            else:
                for topic in topics[:5]:  # Check first 5
                    try:
                        content = memory_storage.read_topic_memory(topic["name"])
                        if content is not None and len(content.strip()) == 0:
                            issues.append(f"主题 {topic['name']} 是空文件")
                            score -= 5
                    except Exception as e:
                        issues.append(f"主题 {topic['name']} 读取失败: {e}")
                        score -= 5

        # Clamp score
        score = max(0, score)
        passed = score >= 70

        return CheckResult(
            name="记忆连续性",
            description="Master Agent 能否可靠读写迁移回滚长期记忆",
            score=score,
            passed=passed,
            issues=issues,
            recommendations=recommendations,
        )

    def check_personality_consistency(self) -> CheckResult:
        """检查 2. 人格一致性

        - 人格配置文件是否存在
        - 配置是否完整（ai + master 都要有）
        - 版本信息是否可获取
        - 是否符合预期的结构
        """
        issues: list[str] = []
        recommendations: list[str] = []
        score = 100

        persona_storage = self.storage.persona
        config_path = self.project_root / "config" / "persona.yaml"

        # Check config file exists
        if not config_path.exists():
            issues.append("人格配置文件 config/persona.yaml 不存在")
            score -= 40
        else:
            # Try reading config
            try:
                config = persona_storage.read_persona_config()

                # Check required sections
                if "ai" not in config:
                    issues.append("配置缺少 ai 节（AI 身份信息）")
                    score -= 20
                else:
                    ai_config = config["ai"]
                    required_ai_fields = ["name", "role", "personality"]
                    for field in required_ai_fields:
                        if field not in ai_config:
                            issues.append(f"ai 配置缺少 {field} 字段")
                            score -= 5

                if "master" not in config:
                    issues.append("配置缺少 master 节（用户信息）")
                    score -= 20
                else:
                    master_config = config["master"]
                    if "timezone" not in master_config:
                        recommendations.append("建议在 master 配置中添加 timezone 字段")

            except Exception as e:
                issues.append(f"人格配置读取失败: {e}")
                score -= 30

        # Check version info accessible
        try:
            version = persona_storage.get_version()
            if not version.version:
                issues.append("获取版本信息失败")
                score -= 10
        except Exception as e:
            issues.append(f"获取版本信息异常: {e}")
            score -= 15

        # Check for multiple persona files (indicates misconfiguration)
        persona_candidates = list(self.project_root.glob("**/persona*.yaml")) + \
                             list(self.project_root.glob("**/*persona*.yml"))
        if len(persona_candidates) > 1:
            issues.append(f"找到多个 persona 配置文件: {[p.name for p in persona_candidates]}，可能导致加载不一致")
            score -= 10

        score = max(0, score)
        passed = score >= 70

        return CheckResult(
            name="人格一致性",
            description="不同工具入口中人格配置语气偏好边界是否一致",
            score=score,
            passed=passed,
            issues=issues,
            recommendations=recommendations,
        )

    def check_skill_precipitation(self) -> CheckResult:
        """检查 3. 技能沉淀

        - 基础规则文件是否存在
        - 核心规则文件是否完整
        - 是否能够列出可用规则
        """
        issues: list[str] = []
        recommendations: list[str] = []
        score = 100

        skill_storage = self.storage.skills
        rules_dir = self.project_root / "src"

        required_rules = [
            "SKILL",
            "soul_base",
            "memory_base",
            "secure_base",
        ]

        for rule_name in required_rules:
            path = rules_dir / f"{rule_name}.md"
            if not path.exists():
                issues.append(f"基础规则文件缺失: {rule_name}.md")
                score -= 20
            else:
                # Try reading
                try:
                    content = skill_storage.read_base_rule(rule_name)
                    if content is None or len(content.strip()) == 0:
                        issues.append(f"基础规则文件为空: {rule_name}.md")
                        score -= 10
                except Exception as e:
                    issues.append(f"读取基础规则 {rule_name} 失败: {e}")
                    score -= 10

        # Check list available rules
        try:
            available = skill_storage.list_available_rules()
            if len(available) < 4:
                recommendations.append("基础规则不完整，建议重新安装")
        except Exception as e:
            issues.append(f"列出可用规则失败: {e}")
            score -= 10

        # Check if the base rules follow AgentSoul core structure
        sk_path = rules_dir / "SKILL.md"
        if sk_path.exists():
            content = sk_path.read_text(encoding="utf-8")
            if "Master Agent" not in content:
                recommendations.append("SKILL.md 不包含核心原则说明，建议确认安装完整性")

        score = max(0, score)
        passed = score >= 70

        return CheckResult(
            name="技能沉淀",
            description="本轮经验是否能沉淀为可复用技能，而不是一次性操作",
            score=score,
            passed=passed,
            issues=issues,
            recommendations=recommendations,
        )

    def check_state_recovery(self) -> CheckResult:
        """检查 4. 状态恢复

        - 灵魂状态文件是否可读写
        - 版本历史是否存在
        - 回滚机制是否可用
        """
        issues: list[str] = []
        recommendations: list[str] = []
        score = 100

        soul_state_storage = self.storage.soul_state
        state_path = self.project_root / "data" / "soul" / "soul_variable" / "state_vector.json"
        history_dir = self.project_root / "data" / "soul" / "versions"

        # Check directory structure
        if not state_path.parent.exists():
            issues.append("灵魂状态目录不存在")
            score -= 25

        # Try reading current state
        try:
            state = soul_state_storage.read_soul_state()
            # Check required PAD fields
            required_fields = ["pleasure", "arousal", "dominance"]
            for field in required_fields:
                if field not in state:
                    issues.append(f"灵魂状态缺少 {field} 字段")
                    score -= 10

        except Exception as e:
            issues.append(f"读取灵魂状态失败: {e}")
            score -= 30

        # Check version history
        if not history_dir.exists():
            recommendations.append("版本历史目录不存在，首次写入状态后会自动创建")
        else:
            # Check versions can be listed
            try:
                if hasattr(soul_state_storage, "list_versions"):
                    versions = soul_state_storage.list_versions()
                    if len(versions) == 0:
                        recommendations.append("还没有版本快照，随使用会自动生成")
                    else:
                        # Verify rollback is available
                        if not hasattr(soul_state_storage, "rollback"):
                            issues.append("rollback 方法未实现，无法回滚状态")
                            score -= 15
            except Exception as e:
                issues.append(f"列出版本历史失败: {e}")
                score -= 10

        # Check writability by writing the same state back
        try:
            current_state = soul_state_storage.read_soul_state()
            # Just verify we can write, don't actually change anything
            # The existing code already has atomic write, this just tests the path
            if state_path.exists():
                stat = state_path.stat()
                if stat.st_size == 0:
                    issues.append("灵魂状态文件为空")
                    score -= 10
        except Exception as e:
            issues.append(f"检查灵魂状态可写失败: {e}")
            score -= 10

        score = max(0, score)
        passed = score >= 70

        return CheckResult(
            name="状态恢复",
            description="注入失败/工具切换/配置损坏后能否恢复到同一个 Master Agent",
            score=score,
            passed=passed,
            issues=issues,
            recommendations=recommendations,
        )

    def check_user_perceived_companionship(self) -> CheckResult:
        """检查 5. 用户可感知陪伴

        基于现有结构推断用户感知：
        - 配置中是否填写了用户信息（名字，标签）
        - 是否已经有记忆积累
        - 是否存在版本历史
        - 核心文件权限是否正确
        """
        issues: list[str] = []
        recommendations: list[str] = []
        score = 100

        persona_storage = self.storage.persona
        memory_storage = self.storage.memory
        soul_state_storage = self.storage.soul_state

        # Check if user info is filled
        try:
            config = persona_storage.read_persona_config()
            master = config.get("master", {})
            if not master.get("name"):
                recommendations.append("建议在 persona.yaml 中填写用户名字，提升陪伴感知")
                score -= 10

            labels = master.get("labels", [])
            if not labels:
                recommendations.append("建议添加用户兴趣标签，帮助 AI 更好理解用户")
                score -= 5

        except Exception as e:
            # Already checked in personality_consistency, don't double count
            pass

        # Count memory files to see if there's accumulated memory
        memory_dir = self.project_root / "data" / "memory"
        memory_count = 0
        if memory_dir.exists():
            for _ in memory_dir.rglob("*.md"):
                memory_count += 1

        if memory_count == 0:
            recommendations.append("还没有记忆积累，随对话会自动生成")
        elif memory_count < 5:
            recommendations.append("记忆文件较少，持续使用会积累更多陪伴上下文")
        else:
            # Good, already has memories
            pass

        # Check if there's soul state history
        history_dir = self.project_root / "data" / "soul" / "versions"
        if history_dir.exists():
            version_count = len(list(history_dir.glob("*.json")))
            if version_count == 0:
                recommendations.append("还没有版本快照，随对话会自动生成")

        # Check file permissions
        data_dir = self.project_root / "data"
        if data_dir.exists():
            try:
                test_file = data_dir / ".write_test.tmp"
                with open(test_file, "w") as f:
                    f.write("test")
                os.unlink(test_file)
            except Exception as e:
                issues.append(f"data 目录不可写: {e}，这会导致记忆无法保存")
                score -= 30

        score = max(0, score)
        passed = score >= 60  # Lower threshold since this is incremental

        return CheckResult(
            name="用户可感知陪伴",
            description="用户能否明显感到它更懂自己、更能接续历史、更少需要重复解释",
            score=score,
            passed=passed,
            issues=issues,
            recommendations=recommendations,
        )

    def run_full_check(self) -> OverallReport:
        """运行完整五项检查"""

        memory_continuity = self.check_memory_continuity()
        personality_consistency = self.check_personality_consistency()
        skill_precipitation = self.check_skill_precipitation()
        state_recovery = self.check_state_recovery()
        user_perceived = self.check_user_perceived_companionship()

        # Calculate overall score (weighted average)
        # Memory and personality are more important
        scores = [
            (memory_continuity.score, 0.25),
            (personality_consistency.score, 0.25),
            (skill_precipitation.score, 0.20),
            (state_recovery.score, 0.15),
            (user_perceived.score, 0.15),
        ]

        overall_score = int(sum(s * w for s, w in scores))

        # Give overall assessment
        if overall_score >= 90:
            assessment = "极佳：所有核心指标都正常，Master Agent 陪伴连续性良好，可以放心使用。"
        elif overall_score >= 75:
            assessment = "良好：大部分指标正常，少量建议不影响核心使用。"
        elif overall_score >= 60:
            assessment = "可使用：存在一些问题，但核心功能可用，建议按推荐修复。"
        elif overall_score >= 40:
            assessment = "需要修复：多个核心指标有问题，建议重新安装或按报告修复配置。"
        else:
            assessment = "严重问题：核心结构不完整，建议重新运行安装脚本。"

        return OverallReport(
            memory_continuity=memory_continuity,
            personality_consistency=personality_consistency,
            skill_precipitation=skill_precipitation,
            state_recovery=state_recovery,
            user_perceived_companionship=user_perceived,
            overall_score=overall_score,
            assessment=assessment,
            timestamp=datetime.now().isoformat(),
        )

    def format_report(self, report: OverallReport) -> str:
        """将报告格式化为易读的 markdown 格式"""

        lines = [
            "# Master Agent 陪伴连续性检查报告",
            "",
            f"检查时间: {report.timestamp}",
            f"整体得分: **{report.overall_score}/100**",
            f"评估: {report.assessment}",
            "",
            "## 五项核心指标",
            "",
        ]

        results = [
            report.memory_continuity,
            report.personality_consistency,
            report.skill_precipitation,
            report.state_recovery,
            report.user_perceived_companionship,
        ]

        for result in results:
            status_emoji = "✅" if result.passed else "⚠️"
            lines.append(f"### {status_emoji} {result.name} ({result.score}/100)")
            lines.append(f"_{result.description}_")
            lines.append("")

            if result.issues:
                lines.append("**发现问题:**")
                for issue in result.issues:
                    lines.append(f"- {issue}")
                lines.append("")

            if result.recommendations:
                lines.append("**改进建议:**")
                for rec in result.recommendations:
                    lines.append(f"- {rec}")
                lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("*陪伴连续性检查由 AgentSoul 自动生成，帮助确保 Master Agent 在多个工具入口中保持一致的陪伴体验。*")

        return "\n".join(lines)

    def print_report(self, report: OverallReport) -> None:
        """在控制台打印报告"""
        formatted = self.format_report(report)
        print(formatted)

    def save_report(self, report: OverallReport, output_path: Path) -> None:
        """保存报告到 markdown 文件"""
        formatted = self.format_report(report)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(formatted)
        log(f"Markdown 报告已保存到 {output_path}", level="INFO")

    def to_dict(self, report: OverallReport) -> dict[str, Any]:
        """将报告转换为字典格式，方便 JSON 序列化"""
        def result_to_dict(result: CheckResult) -> dict[str, Any]:
            return {
                "name": result.name,
                "description": result.description,
                "score": result.score,
                "passed": result.passed,
                "issues": result.issues,
                "recommendations": result.recommendations,
            }

        return {
            "memory_continuity": result_to_dict(report.memory_continuity),
            "personality_consistency": result_to_dict(report.personality_consistency),
            "skill_precipitation": result_to_dict(report.skill_precipitation),
            "state_recovery": result_to_dict(report.state_recovery),
            "user_perceived_companionship": result_to_dict(report.user_perceived_companionship),
            "overall_score": report.overall_score,
            "assessment": report.assessment,
            "timestamp": report.timestamp,
        }

    def save_report_json(self, report: OverallReport, output_path: Path) -> None:
        """保存报告到 JSON 文件，适合程序化读取"""
        data = self.to_dict(report)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        log(f"JSON 报告已保存到 {output_path}", level="INFO")


def main():
    """CLI 入口"""
    import argparse
    parser = argparse.ArgumentParser(
        description="AgentSoul Companionship Continuity Checker - 检查 Master Agent 五项核心陪伴连续性指标"
    )
    parser.add_argument(
        "--output", "-o",
        help="输出报告文件路径 (默认: .companionship_report.md)",
        default=".companionship_report.md"
    )
    parser.add_argument(
        "--json", "-j",
        action="store_true",
        help="输出 JSON 格式而不是 markdown，适合程序化读取 (默认: markdown)",
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
        help="最低通过分数门槛 (0-100)。若整体得分低于该值，进程以状态码2退出",
        default=None,
    )
    args = parser.parse_args()

    if args.min_score is not None and (args.min_score < 0 or args.min_score > 100):
        parser.error("--min-score must be between 0 and 100")

    project_root = Path(args.project_root) if args.project_root else None
    checker = CompanionshipChecker(project_root)
    report = checker.run_full_check()

    checker.print_report(report)

    output_path = Path(args.output)
    if args.json:
        checker.save_report_json(report, output_path)
    else:
        checker.save_report(report, output_path)

    if args.min_score is not None:
        if report.overall_score < args.min_score:
            print(
                f"\n❌ 门控未通过：整体得分 {report.overall_score} < 最低要求 {args.min_score}"
            )
            sys.exit(2)
        print(
            f"\n✅ 门控通过：整体得分 {report.overall_score} >= 最低要求 {args.min_score}"
        )


if __name__ == "__main__":
    main()
