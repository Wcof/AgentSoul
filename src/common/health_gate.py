"""
AgentSoul · Unified Health Check Summary Schema
============================================
This module defines a standardized summary output schema for all AgentSoul
health and continuity checkers. This allows automation scripts and CI to
consume output from any checker with a consistent format.

Schema:
- HealthSummary: Top-level summary containing overall score, gate passing
  status, and metadata for automation consumption
- CheckResult: Individual check result with name, score, pass/fail status
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class UnifiedCheckResult:
    """Unified result for a single check."""
    name: str
    description: str
    score: int  # 0-100
    passed: bool
    issues: list[str] = field(default_factory=list)
    recommendations: list[str] = field(default_factory=list)


@dataclass
class HealthSummary:
    """
    Unified health summary for any checker.

    This is the standard machine-readable output that all checkers should
    output when using --summary-json to allow consistent consumption by CI
    and automation scripts.
    """
    checker_name: str          # Name of the checker (e.g. "companionship_checker")
    overall_score: int        # Overall score 0-100
    assessment: str           # Human-readable assessment string
    timestamp: str            # ISO format timestamp
    min_score: int | None  # Threshold configured by user
    gate_passed: bool | None  # Did we pass the threshold gate?
    exit_code: int            # Recommended exit code (0 = success, 1 = checker error, 2 = gate failed)
    output_file: str | None  # Path to full output file if saved
    output_format: str | None  # Format of full output (markdown/json)
    check_results: list[UnifiedCheckResult] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "checker_name": self.checker_name,
            "overall_score": self.overall_score,
            "assessment": self.assessment,
            "timestamp": self.timestamp,
            "min_score": self.min_score,
            "gate_passed": self.gate_passed,
            "exit_code": self.exit_code,
            "output_file": self.output_file,
            "output_format": self.output_format,
            "check_results": [
                {
                    "name": cr.name,
                    "description": cr.description,
                    "score": cr.score,
                    "passed": cr.passed,
                    "issues": cr.issues,
                    "recommendations": cr.recommendations,
                }
                for cr in self.check_results
            ]
        }

    def to_json(self) -> str:
        """Serialize to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> HealthSummary:
        """Create HealthSummary from dictionary."""
        check_results = [
            UnifiedCheckResult(**cr)
            for cr in data.get("check_results", [])
        ]
        return cls(
            checker_name=data["checker_name"],
            overall_score=data["overall_score"],
            assessment=data["assessment"],
            timestamp=data.get("timestamp", datetime.now().isoformat()),
            min_score=data.get("min_score"),
            gate_passed=data.get("gate_passed"),
            exit_code=data.get("exit_code", 0),
            output_file=data.get("output_file"),
            output_format=data.get("output_format"),
            check_results=check_results,
        )

    @classmethod
    def from_json(cls, json_str: str) -> HealthSummary:
        """Deserialize from JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)


def get_default_assessment(overall_score: int) -> str:
    """Get default assessment text based on overall score.

    Standard assessment tiers:
    - 90+: 极佳 - All core checks pass
    - 75-89: 良好 - Minor issues don't affect core use
    - 60-74: 可使用 - Some issues exist but core functions work
    - 40-59: 需要修复 - Multiple core issues need attention
    - <40: 严重问题 - Core structure incomplete
    """
    if overall_score >= 90:
        return "极佳：没有错误，少数警告不影响使用，健康状况良好。"
    elif overall_score >= 75:
        return "良好：少量问题，核心功能可用。"
    elif overall_score >= 60:
        return "可使用：存在一些问题，但核心检测完成，建议修复警告。"
    elif overall_score >= 40:
        return "需要修复：多个错误，建议重新安装或按报告修复配置。"
    else:
        return "严重问题：核心结构不完整，建议重新运行安装脚本。"


def calculate_gate_result(
    overall_score: int,
    min_score: int | None,
    base_success: bool = True,
) -> tuple[bool | None, int]:
    """Calculate gate passing result and exit code.

    Args:
        overall_score: Calculated overall score
        min_score: Minimum score threshold from CLI, None if no threshold
        base_success: Whether the checker run itself succeeded (false means errors occurred)

    Returns:
        (gate_passed, exit_code) - follows the exit code convention:
            0 = success (check completed and either no threshold or passed)
            1 = checker run failed (errors occurred)
            2 = gate failed (check completed but score < threshold)
    """
    gate_passed: bool | None = None
    exit_code = 0 if base_success else 1

    if min_score is not None:
        gate_passed = overall_score >= min_score
        if not gate_passed:
            exit_code = 2

    return gate_passed, exit_code


def handle_summary_output(
    checker_name: str,
    overall_score: int,
    assessment: str,
    timestamp: str,
    min_score: int | None,
    gate_passed: bool | None,
    exit_code: int,
    check_results: list[UnifiedCheckResult],
    output_path: Any | None,
    output_format: str | None,
) -> None:
    """Print unified summary JSON to stdout and exit.

    This is the shared --summary-json output logic used by all checkers.
    """
    summary = HealthSummary(
        checker_name=checker_name,
        overall_score=overall_score,
        assessment=assessment,
        timestamp=timestamp,
        min_score=min_score,
        gate_passed=gate_passed,
        exit_code=exit_code,
        output_file=str(output_path) if output_path is not None else None,
        output_format=output_format,
        check_results=check_results,
    )
    print(summary.to_json())
