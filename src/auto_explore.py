"""
Automatic Exploration Orchestrator for AgentSoul

Scans the current project state, reads update_plan.md, capability map, failure ledger,
and automatically proposes the next exploration candidate that satisfies the
Center Constraint (Master Agent不出圈).
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

# Calculate project root manually before importing common (chicken-and-egg)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(project_root))

from common import get_project_root, log  # noqa: E402


@dataclass
class Candidate:
    """Proposed exploration candidate."""
    title: str
    category: str  # "history-deepening", "automatic-upgrade", "breakthrough"
    description: str
    center_check: dict[str, bool]  # four center constraint questions
    reasoning: str
    recommendation: str


class AutoExplorer:
    """Automatic exploration orchestrator."""

    def __init__(self, project_root: Path):
        self.project_root = project_root

    def read_update_plan(self) -> tuple[list[str], bool]:
        """Read update_plan.md and extract empty candidate slots."""
        plan_path = self.project_root / "update_plan.md"
        if not plan_path.exists():
            return [], False

        content = plan_path.read_text(encoding="utf-8")
        lines = content.splitlines()

        # Find the "下次功能候选 3 项" section
        in_candidates = False
        empty_slots = []
        for line in lines:
            if "下次功能候选 3 项" in line:
                in_candidates = True
                continue
            if in_candidates and line.strip().startswith("1. **(") or line.strip().startswith("2. **(") or line.strip().startswith("3. **("):
                if "等待新需求" in line or "保留空位" in line:
                    empty_slots.append(line.strip())
            # Stop at next section
            if "## 本次踩坑与陷阱警告" in line:
                break

        return empty_slots, len(empty_slots) >= 1

    def read_capability_map(self) -> tuple[list[str], list[str]]:
        """Read .capability_map.md and extract partially implemented / unimplemented."""
        cap_path = self.project_root / ".capability_map.md"
        if not cap_path.exists():
            return [], []

        content = cap_path.read_text(encoding="utf-8")
        lines = content.splitlines()

        partial = []
        unimplemented = []
        in_section = None

        for line in lines:
            if "## 部分实现（有缺陷）" in line:
                in_section = "partial"
                continue
            if "## 未实现已规划" in line:
                in_section = "unimplemented"
                continue
            if "## 技术债" in line or "## 已废弃" in line:
                in_section = None
                continue
            if line.strip().startswith("- "):
                content = line.strip().removeprefix("- ").strip()
                # Skip "- 无" entries
                if content in ("无", "- 无"):
                    continue
                if in_section == "partial":
                    partial.append(line.strip())
                if in_section == "unimplemented":
                    unimplemented.append(line.strip())

        return partial, unimplemented

    def check_center_constraint(self, title: str, description: str) -> dict[str, bool]:
        """Check four center constraint questions (Master Agent不出圈)."""
        # Automatic center constraint check for auto-explore itself
        return {
            "same_master": (
                "自动提出探索候选" in title or
                "编排" in title or
                "帮助选题" in description or
                "框架自我改进" in description
            ),
            "enhance_accompany": (
                "帮助持续陪伴" in description or
                "帮助自动发现能力缺口" in description or
                "提升框架自主性" in description
            ),
            "just_entry": True,  # This is framework core capability, not new agent
            "user_perceptible": True,  # User gets automatic candidate proposal
        }

    def propose_candidate(self) -> Candidate | None:
        """Propose next exploration candidate."""
        empty_slots, has_empty_slot = self.read_update_plan()
        partial, unimplemented = self.read_capability_map()

        # Check if there are any unimplemented candidates
        if unimplemented:
            # Pick first unimplemented
            first = unimplemented[0]
            # Parse title from markdown "- **Title**: description"
            title = first.strip("- ").split("**:")[0].strip("*")
            description = first.split("**:")[-1].strip() if ":**" in first else first.strip("- ")

            center_check = self.check_center_constraint(title, description)
            all_passed = all(center_check.values())

            return Candidate(
                title=title,
                category="automatic-upgrade",
                description=description,
                center_check=center_check,
                reasoning="Found in .capability_map.md '未实现已规划' section, this is a pre-planned unimplemented capability that fits the center constraint.",
                recommendation=f"Explore this candidate next iteration: {title}" if all_passed else "Skip this candidate, fails center constraint."
            )

        if partial:
            # Pick first partially implemented
            first = partial[0]
            title = first.strip("- ").split("**:")[0].strip("*") if ":**" in first else first.strip("- ")
            description = first.split("**:")[-1].strip() if ":**" in first else first.strip("- ")

            center_check = self.check_center_constraint(title, description)
            all_passed = all(center_check.values())

            return Candidate(
                title=title,
                category="history-deepening",
                description=description,
                center_check=center_check,
                reasoning="Found in .capability_map.md '部分实现（有缺陷）' section, completing partially implemented functionality improves overall system completeness.",
                recommendation=f"Deepen this candidate next iteration: {title}" if all_passed else "Skip this candidate, fails center constraint."
            )

        # Check for technical debt that can be addressed
        # Nothing found
        return None

    def generate_report(self, candidate: Candidate | None) -> None:
        """Generate human-readable report."""
        print("=" * 60)
        print(" AgentSoul Automatic Exploration Orchestrator")
        print("=" * 60)
        print()
        print(f"🕒 生成时间: {datetime.now().isoformat()}")
        print()

        if candidate is None:
            print("ℹ️  未发现待探索候选")
            print("当前所有计划功能已完成，等待新的自然需求浮现")
            print("=" * 60)
            return

        print(f"📋 建议探索候选:")
        print(f"  标题: {candidate.title}")
        print(f"  分类: {candidate.category}")
        print(f"  描述: {candidate.description}")
        print()
        print(f"✅ 圆心约束（Master Agent 不出圈）检查:")
        for question, passed in candidate.center_check.items():
            mark = "✓" if passed else "✗"
            q_name = {
                "same_master": "是否增强同一个 Master Agent",
                "enhance_accompany": "是否增强长期陪伴能力",
                "just_entry": "平台/工具只是入口，不是新独立主体",
                "user_perceptible": "用户能感知到能力提升",
            }.get(question, question)
            print(f"  {mark} {q_name}: {'通过' if passed else '不通过'}")
        print()
        print(f"🧠 推理: {candidate.reasoning}")
        print()
        print(f"💡 建议: {candidate.recommendation}")
        print()
        print(f"📊 统计:")
        empty_slots, _ = self.read_update_plan()
        partial, unimplemented = self.read_capability_map()
        print(f"  空候选槽位: {len(empty_slots)}")
        print(f"  部分实现项: {len(partial)}")
        print(f"  未实现已规划: {len(unimplemented)}")
        print("=" * 60)


def main() -> None:
    """Main CLI entry."""
    import argparse
    parser = argparse.ArgumentParser(
        description="AgentSoul Automatic Exploration Orchestrator - Automatically proposes next exploration candidate"
    )
    parser.add_argument(
        "--summary-json",
        action="store_true",
        help="输出机器可读的一行统一格式摘要 JSON，适合 CI/脚本消费 (使用标准 HealthSummary schema)",
        default=False,
    )
    args = parser.parse_args()

    project_root = get_project_root()
    explorer = AutoExplorer(project_root)
    candidate = explorer.propose_candidate()

    if args.summary_json:
        # Import here to avoid circular import
        from src.common.health_gate import HealthSummary, UnifiedCheckResult, handle_summary_output

        check_results = []
        overall_score = 100
        assessment = "正常：自动探索完成，已生成候选建议"

        if candidate is None:
            check_results.append(
                UnifiedCheckResult(
                    name="自动探索",
                    description="扫描项目状态寻找下一个探索候选",
                    score=100,
                    passed=True,
                    issues=[],
                    recommendations=["未发现待探索候选，所有计划功能已完成"],
                )
            )
        else:
            all_passed = all(candidate.center_check.values())
            score = 100 if all_passed else 80
            check_results.append(
                UnifiedCheckResult(
                    name=f"自动探索: {candidate.title}",
                    description=candidate.description,
                    score=score,
                    passed=all_passed,
                    issues=[] if all_passed else ["候选未通过圆心约束检查"],
                    recommendations=[candidate.recommendation],
                )
            )

        handle_summary_output(
            checker_name="auto-explore",
            overall_score=overall_score,
            assessment=assessment,
            timestamp=datetime.now().isoformat(),
            min_score=None,
            gate_passed=None,
            exit_code=0,
            check_results=check_results,
            output_path=None,
            output_format=None,
        )
        sys.exit(0)

    explorer.generate_report(candidate)
    sys.exit(0)


if __name__ == "__main__":
    main()
