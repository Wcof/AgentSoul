"""
AgentSoul · Persona Kit 质量检查
验证人格包的结构、字段、边界和协议完整性
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from agentsoul.common import log


@dataclass
class QualityIssue:
    check: str
    message: str
    severity: str = "error"  # error / warning / info


@dataclass
class QualityReport:
    kit_path: str
    kit_name: str = ""
    issues: list[QualityIssue] = field(default_factory=list)
    score: int = 100
    passed: bool = True

    @property
    def error_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "error")

    @property
    def warning_count(self) -> int:
        return sum(1 for i in self.issues if i.severity == "warning")

    def add_issue(self, check: str, message: str, severity: str = "error") -> None:
        self.issues.append(QualityIssue(check=check, message=message, severity=severity))
        if severity == "error":
            self.score -= 15
            self.passed = False
        elif severity == "warning":
            self.score -= 5
        self.score = max(0, self.score)

    def to_dict(self) -> dict[str, Any]:
        return {
            "kit_path": self.kit_path,
            "kit_name": self.kit_name,
            "score": self.score,
            "passed": self.passed,
            "error_count": self.error_count,
            "warning_count": self.warning_count,
            "issues": [
                {"check": i.check, "message": i.message, "severity": i.severity}
                for i in self.issues
            ],
        }

    def print_report(self) -> None:
        log(f"\n{'='*60}", "INFO")
        log(f"Persona Kit 质量检查报告: {self.kit_name}", "INFO")
        log(f"路径: {self.kit_path}", "INFO")
        log(f"{'='*60}", "INFO")

        if not self.issues:
            log("所有检查通过！", "OK")
        else:
            for issue in self.issues:
                prefix = "❌" if issue.severity == "error" else "⚠️" if issue.severity == "warning" else "ℹ️"
                log(f"  {prefix} [{issue.check}] {issue.message}", issue.severity.upper())

        log(f"\n得分: {self.score}/100", "INFO")
        log(f"状态: {'✅ 通过' if self.passed else '❌ 未通过'}", "INFO")
        log(f"错误: {self.error_count}  警告: {self.warning_count}", "INFO")


class PersonaKitChecker:
    """Persona Kit 质量检查器"""

    REQUIRED_FILES = [
        "package.yaml",
        "persona.yaml",
        "behavior.yaml",
        "SKILL.md",
        "boundaries.md",
    ]

    REQUIRED_DIRS = [
        "protocols",
        "references/research",
        "tests",
    ]

    REQUIRED_PROTOCOLS = [
        "startup-mcp.md",
        "startup-local-file.md",
        "startup-static.md",
    ]

    REQUIRED_RESEARCH_FILES = [
        "01-profile-and-context.md",
        "02-dialogue-patterns.md",
        "03-expression-dna.md",
        "04-capability-boundaries.md",
        "05-decisions-and-workflows.md",
        "06-evolution-and-versioning.md",
    ]

    REQUIRED_TEST_FILES = [
        "known-scenarios.md",
        "edge-scenarios.md",
        "voice-scenarios.md",
    ]

    def check(self, kit_path: Path) -> QualityReport:
        """执行完整的质量检查。"""
        report = QualityReport(kit_path=str(kit_path), kit_name=kit_path.name)

        if not kit_path.exists() or not kit_path.is_dir():
            report.add_issue("structure", f"目录不存在: {kit_path}")
            return report

        self._check_structure(kit_path, report)
        self._check_package_yaml(kit_path, report)
        self._check_persona_yaml(kit_path, report)
        self._check_behavior_yaml(kit_path, report)
        self._check_boundaries(kit_path, report)
        self._check_skill_md(kit_path, report)
        self._check_tests(kit_path, report)

        return report

    def _check_structure(self, kit_path: Path, report: QualityReport) -> None:
        """检查目录结构完整性。"""
        for fname in self.REQUIRED_FILES:
            if not (kit_path / fname).exists():
                report.add_issue("structure", f"缺少必需文件: {fname}")

        for dname in self.REQUIRED_DIRS:
            if not (kit_path / dname).is_dir():
                report.add_issue("structure", f"缺少必需目录: {dname}")

        protocols_dir = kit_path / "protocols"
        if protocols_dir.is_dir():
            for fname in self.REQUIRED_PROTOCOLS:
                if not (protocols_dir / fname).exists():
                    report.add_issue("structure", f"缺少协议文件: protocols/{fname}")

        research_dir = kit_path / "references" / "research"
        if research_dir.is_dir():
            for fname in self.REQUIRED_RESEARCH_FILES:
                if not (research_dir / fname).exists():
                    report.add_issue("structure", f"缺少研究文件: references/research/{fname}")

        tests_dir = kit_path / "tests"
        if tests_dir.is_dir():
            for fname in self.REQUIRED_TEST_FILES:
                if not (tests_dir / fname).exists():
                    report.add_issue("structure", f"缺少测试文件: tests/{fname}")

    def _check_package_yaml(self, kit_path: Path, report: QualityReport) -> None:
        """检查 package.yaml 元数据。"""
        pkg_path = kit_path / "package.yaml"
        if not pkg_path.exists():
            return

        try:
            with open(pkg_path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except Exception as e:
            report.add_issue("package_yaml", f"package.yaml 解析失败: {e}")
            return

        if not data.get("name"):
            report.add_issue("package_yaml", "package.yaml 缺少 name 字段")
        if not data.get("version"):
            report.add_issue("package_yaml", "package.yaml 缺少 version 字段", "warning")

        report.kit_name = data.get("name", kit_path.name)

    def _check_persona_yaml(self, kit_path: Path, report: QualityReport) -> None:
        """检查 persona.yaml 配置完整性。"""
        persona_path = kit_path / "persona.yaml"
        if not persona_path.exists():
            return

        try:
            with open(persona_path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except Exception as e:
            report.add_issue("persona_yaml", f"persona.yaml 解析失败: {e}")
            return

        agent = data.get("agent", {})
        if not agent.get("name"):
            report.add_issue("persona_yaml", "agent.name 不能为空")
        if not agent.get("role"):
            report.add_issue("persona_yaml", "agent.role 不能为空", "warning")
        if not agent.get("personality"):
            report.add_issue("persona_yaml", "agent.personality 不能为空", "warning")

        # Check expression_dna
        edna = agent.get("expression_dna", {})
        if edna:
            edna_fields = ["sentence_length", "question_ratio", "analogy_density",
                           "certainty_style", "structure_preference"]
            filled = sum(1 for f in edna_fields if edna.get(f))
            if filled < 4:
                report.add_issue("expression_dna",
                                 f"expression_dna 只有 {filled}/5 个风格字段有值，建议至少 4 个", "warning")
        else:
            report.add_issue("expression_dna", "缺少 expression_dna 配置", "warning")

        # Check honest_boundaries
        hb = agent.get("honest_boundaries", {})
        if hb:
            limitations = hb.get("limitations", [])
            blind_spots = hb.get("blind_spots", [])
            total = len(limitations) + len(blind_spots)
            if total < 3:
                report.add_issue("honest_boundaries",
                                 f"诚实边界只有 {total} 条，建议至少 3 条", "warning")
        else:
            report.add_issue("honest_boundaries", "缺少 honest_boundaries 配置", "warning")

        # Check capability_profile
        cap = agent.get("capability_profile", {})
        if not cap:
            report.add_issue("capability_profile", "缺少 capability_profile 配置", "warning")

    def _check_behavior_yaml(self, kit_path: Path, report: QualityReport) -> None:
        """检查 behavior.yaml 配置。"""
        behavior_path = kit_path / "behavior.yaml"
        if not behavior_path.exists():
            return

        try:
            with open(behavior_path, encoding="utf-8") as f:
                data = yaml.safe_load(f) or {}
        except Exception as e:
            report.add_issue("behavior_yaml", f"behavior.yaml 解析失败: {e}")
            return

        # Check quality_gates
        qg = data.get("quality_gates")
        if not qg:
            report.add_issue("quality_gates", "缺少 quality_gates 配置", "warning")

        # Check agentic_protocol
        ap = data.get("agentic_protocol")
        if not ap:
            report.add_issue("agentic_protocol", "缺少 agentic_protocol 配置", "warning")

    def _check_boundaries(self, kit_path: Path, report: QualityReport) -> None:
        """检查 boundaries.md 内容。"""
        boundaries_path = kit_path / "boundaries.md"
        if not boundaries_path.exists():
            return

        content = boundaries_path.read_text(encoding="utf-8")

        if "Capability Boundaries" not in content and "能力边界" not in content:
            report.add_issue("boundaries", "boundaries.md 缺少能力边界章节", "warning")
        if "Safety Boundaries" not in content and "安全边界" not in content:
            report.add_issue("boundaries", "boundaries.md 缺少安全边界章节", "warning")

    def _check_skill_md(self, kit_path: Path, report: QualityReport) -> None:
        """检查 SKILL.md 内容。"""
        skill_path = kit_path / "SKILL.md"
        if not skill_path.exists():
            return

        content = skill_path.read_text(encoding="utf-8")

        if len(content.strip()) < 100:
            report.add_issue("skill_md", "SKILL.md 内容过短，可能未完成", "warning")

    def _check_tests(self, kit_path: Path, report: QualityReport) -> None:
        """检查测试文件是否已填写。"""
        tests_dir = kit_path / "tests"
        if not tests_dir.is_dir():
            return

        known_path = tests_dir / "known-scenarios.md"
        if known_path.exists():
            content = known_path.read_text(encoding="utf-8")
            if "待填写" in content or content.count("**问题**：") < 3:
                report.add_issue("tests", "known-scenarios.md 未填写至少 3 个场景", "warning")


def check_persona_kit(
    kit_path: Path,
    summary_json: bool = False,
    min_score: int = 0,
    quiet: bool = False,
) -> QualityReport:
    """检查指定 Persona Kit 的质量。

    Args:
        kit_path: Persona Kit 目录路径
        summary_json: 是否输出 JSON 格式
        min_score: 最低分数阈值，低于此值返回非零退出码
        quiet: 是否静默（不输出任何内容）

    Returns:
        QualityReport 对象
    """
    checker = PersonaKitChecker()
    report = checker.check(kit_path)

    if not quiet:
        if summary_json:
            print(json.dumps(report.to_dict(), ensure_ascii=False, indent=2))
        else:
            report.print_report()

        if min_score > 0 and report.score < min_score:
            log(f"得分 {report.score} 低于阈值 {min_score}", "ERROR")

    return report
