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
from typing import Any, Optional


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
    min_score: Optional[int]  # Threshold configured by user
    gate_passed: Optional[bool]  # Did we pass the threshold gate?
    exit_code: int            # Recommended exit code (0 = success, 1 = error, 2 = gate failed)
    output_file: Optional[str]  # Path to full output file if saved
    output_format: Optional[str]  # Format of full output (markdown/json)
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
    def from_dict(cls, data: dict[str, Any]) -> "HealthSummary":
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
    def from_json(cls, json_str: str) -> "HealthSummary":
        """Deserialize from JSON string."""
        data = json.loads(json_str)
        return cls.from_dict(data)
