"""
Entry Capability Detector for Master Agent

Detect the current running environment (Claude Code / OpenAI Codex / Gemini)
and output the available injection methods for Master Agent continuity.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from datetime import datetime

# Calculate project root manually before importing common (chicken-and-egg)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(project_root))

from src.common.health_gate import HealthSummary, UnifiedCheckResult  # noqa: E402


@dataclass
class EntryCapability:
    """Result of entry capability detection."""
    environment: str
    description: str
    available_injection_methods: list[str]
    has_mcp: bool
    has_local_files: bool
    notes: str


def detect_environment() -> EntryCapability:
    """
    Detect the current running environment based on environment variables and context.

    Returns:
        EntryCapability with detection results
    """
    env = "unknown"
    description = ""
    available: list[str] = []
    has_mcp = False
    has_local_files = False
    notes = ""

    # Check for Claude Code specific indicators
    # Claude Code sets environment variable GIT_DIR when running in git
    if os.environ.get("GIT_DIR") is not None:
        env = "claude_code"
        description = "Claude Code CLI - Full MCP support available"
        available = ["mcp", "claude-md", "local-files"]
        has_mcp = True
        has_local_files = True
        notes = "Full access to MCP tools and local filesystem. Recommended: use MCP for full Master Agent continuity."

    # Check for MCP server indicator
    elif os.environ.get("MCP_SERVER_NAME") is not None:
        env = "mcp_server"
        description = "AgentSoul MCP Server - running as MCP service"
        available = ["mcp-native"]
        has_mcp = True
        has_local_files = True
        notes = "This is the AgentSoul MCP server itself."

    # Check for common environment variables that indicate Codex/OpenAI
    elif os.environ.get("OPENAI_API_KEY") is not None and "CODER" not in os.environ:
        env = "openai_codex"
        description = "OpenAI Codex / OpenAI API editor environment"
        available = ["openai-adapter", "local-files", "markdown-injection"]
        has_mcp = False
        has_local_files = True
        notes = "Use OpenAI adapter to inject Master Agent persona/memory/skill into Codex context."

    # Check for Gemini Code Assist
    elif "GOOGLE_APPLICATION_CREDENTIALS" in os.environ or "GEMINI_API_KEY" in os.environ:
        env = "gemini_code_assist"
        description = "Gemini Code Assist / Gemini API editor environment"
        available = ["gemini-adapter", "local-files", "markdown-injection"]
        has_mcp = False
        has_local_files = True
        notes = "Use Gemini adapter to inject Master Agent persona/memory/skill into Gemini context."

    # Fallback to generic local environment
    else:
        # Check if we can access local files
        try:
            # Try to access current directory
            _ = os.listdir(".")
            has_local_files = True
        except Exception:
            has_local_files = False

        # Check if MCP module is available
        # This is just a heuristic - actual MCP availability depends on the client
        has_mcp = False
        env = "generic_local"
        description = "Generic local Python environment"
        available = ["local-files"]
        if has_local_files:
            available.extend(["markdown-injection"])
        notes = "Generic detection - please verify available capabilities manually."

    return EntryCapability(
        environment=env,
        description=description,
        available_injection_methods=available,
        has_mcp=has_mcp,
        has_local_files=has_local_files,
        notes=notes
    )


def check_agentsoul_installed() -> tuple[bool, str | None]:
    """
    Check if AgentSoul is properly installed in the current workspace.

    Returns:
        (is_installed, config_path) where config_path is path to persona.yaml if installed
    """
    # Check common locations
    candidate_paths = [
        "config/persona.yaml",
        "../config/persona.yaml",
        "./config/persona.yaml",
    ]

    for path in candidate_paths:
        if os.path.exists(path):
            return True, path

    return False, None


def get_injection_template(env: str) -> str | None:
    """
    Get the injection template for the detected environment.

    Args:
        env: Detected environment name

    Returns:
        Template string or None if no template available
    """
    templates = {
        "claude_code": """
# Master Agent Injection for Claude Code

AgentSoul is already installed via MCP. Follow this startup sequence:

1. mcp_tool_index → Get complete tool index
2. get_persona_config → Load who you are (AI) and who the user is (master)
3. get_soul_state → Load current PAD emotion state
4. get_base_rules with name="SKILL" → Read top-level personality and security rules
5. get_base_rules with name="memory_base" → Read memory system rules
6. get_mcp_usage_guide → Confirm this workflow
7. list_memory_topics → Understand what active topics exist

This gives you full access to all Master Agent capabilities via MCP.
""".strip(),

        "openai_codex": """
# Master Agent Injection for OpenAI Codex

AgentSoul data files exist in this workspace. Inject the following:

1. Load persona configuration from `config/persona.yaml`
2. Load behavior configuration from `config/behavior.yaml`
3. Read the base rules from `src/` (SKILL.md, soul_base.md, memory_base.md, etc.)
4. Load daily memory from `data/memory/daily/` for recent context
5. Load any topic memory that matches the current discussion topic

Use the OpenAI adapter from `src/adapters/openai.py` to help map the data.
""".strip(),

        "gemini_code_assist": """
# Master Agent Injection for Gemini Code Assist

AgentSoul data files exist in this workspace. Inject the following:

1. Load persona configuration from `config/persona.yaml`
2. Load behavior configuration from `config/behavior.yaml`
3. Read the base rules from `src/` (SKILL.md, soul_base.md, memory_base.md, etc.)
4. Load daily memory from `data/memory/daily/` for recent context
5. Load any topic memory that matches the current discussion topic

Use the Gemini adapter from `src/adapters/gemini.py` to help map the data.
""".strip(),

        "generic_local": """
# Master Agent Injection for Generic Local Environment

Check if AgentSoul data files exist:
- config/persona.yaml - contains persona configuration
- data/ - contains memory and soul state

Load the appropriate files based on what's available.
""".strip(),
    }

    return templates.get(env)


def generate_report() -> dict[str, object]:
    """
    Generate a complete detection report.

    Returns:
        Dictionary with all detection results
    """
    cap = detect_environment()
    installed, config_path = check_agentsoul_installed()
    template = get_injection_template(cap.environment)

    return {
        "detected": cap,
        "agentsoul_installed": installed,
        "config_path": config_path,
        "injection_template": template,
    }


def print_report() -> None:
    """Print a human-readable detection report to stdout."""
    report = generate_report()
    cap = report["detected"]
    assert isinstance(cap, EntryCapability)

    print("=" * 60)
    print(" AgentSoul Entry Capability Detector")
    print("=" * 60)
    print()
    print(f"Environment: {cap.environment}")
    print(f"Description: {cap.description}")
    print()
    print(f"Available injection methods: {', '.join(cap.available_injection_methods)}")
    print()
    print(f"Has MCP support: {'Yes' if cap.has_mcp else 'No'}")
    print(f"Has local file access: {'Yes' if cap.has_local_files else 'No'}")
    print()
    print(f"AgentSoul installed: {'Yes' if report['agentsoul_installed'] else 'No'}")
    if report['config_path']:
        print(f"Config path: {report['config_path']}")
    print()
    if cap.notes:
        print(f"Notes: {cap.notes}")
        print()
    if report["injection_template"]:
        print("-" * 60)
        print(" Injection Template:")
        print("-" * 60)
        print(report["injection_template"])
        print()
    print("=" * 60)


def main() -> None:
    """Main entry point for CLI."""
    import argparse
    parser = argparse.ArgumentParser(
        description="AgentSoul Entry Capability Detector - Detect current running environment and available injection methods"
    )
    parser.add_argument(
        "--summary-json",
        action="store_true",
        help="输出机器可读的一行统一格式摘要 JSON，适合 CI/脚本消费 (使用标准 HealthSummary schema)",
        default=False,
    )
    parser.add_argument(
        "--generate-template",
        action="store_true",
        help="根据检测到的环境生成可直接使用的注入步骤模板，输出到标准输出",
        default=False,
    )
    parser.add_argument(
        "--precheck",
        action="store_true",
        help="注入预演：在实际注入前检查目标工作区，检查文件冲突和配置状态，输出预演报告",
        default=False,
    )
    parser.add_argument(
        "--write-starter",
        action="store_true",
        help="生成启动模板：根据检测到的环境写入完整 starter-prompt.md 文件到当前目录",
        default=False,
    )
    args = parser.parse_args()

    if args.summary_json:
        report = generate_report()
        cap = report["detected"]
        assert isinstance(cap, EntryCapability), "cap must be EntryCapability"

        # Create unified check results
        check_results = [
            UnifiedCheckResult(
                name="环境检测",
                description="检测当前运行环境类型",
                score=100 if report["agentsoul_installed"] else 80,
                passed=True,
                issues=[] if report["agentsoul_installed"] else ["AgentSoul not detected in current workspace"],
                recommendations=[] if report["agentsoul_installed"] else ["Install AgentSoul to enable full capabilities"],
            )
        ]

        # Add environment info as a check
        check_results.append(
            UnifiedCheckResult(
                name=f"环境: {cap.environment}",
                description=cap.description,
                score=100,
                passed=True,
                issues=[],
                recommendations=[f"Available injection methods: {', '.join(cap.available_injection_methods)}"],
            )
        )

        # Calculate overall score
        # 100 if AgentSoul installed and detected environment, 80 if AgentSoul not found but environment detected
        overall_score = 100 if report["agentsoul_installed"] else 80
        assessment = (
            "极佳：AgentSoul 已检测到环境，可以正常注入。" if report["agentsoul_installed"]
            else "可使用：环境已识别，但未检测到 AgentSoul 安装。"
        )

        summary = HealthSummary(
            checker_name="entry_detect",
            overall_score=overall_score,
            assessment=assessment,
            timestamp=datetime.now().isoformat(),
            min_score=None,
            gate_passed=None,
            exit_code=0,
            output_file=None,
            output_format=None,
            check_results=check_results,
        )
        print(summary.to_json())
        sys.exit(0)

    if args.generate_template:
        report = generate_report()
        cap = report["detected"]
        assert isinstance(cap, EntryCapability), "cap must be EntryCapability"
        template = report["injection_template"]

        if template:
            print(template)
        else:
            print(f"No injection template available for environment: {cap.environment}")
        sys.exit(0)

    if args.write_starter:
        report = generate_report()
        cap = report["detected"]
        assert isinstance(cap, EntryCapability), "cap must be EntryCapability"
        template = report["injection_template"]

        if not template:
            print(f"No injection template available for environment: {cap.environment}")
            sys.exit(1)

        # Write to starter-prompt.md
        output_path = "starter-prompt.md"
        content = f"""# AgentSoul Starter Prompt

检测到环境: **{cap.environment}**
描述: {cap.description}

可用注入方法: {', '.join(cap.available_injection_methods)}

AgentSoul 已安装: {'是' if report['agentsoul_installed'] else '否'}

---

## 注入模板

{template}

---

> 该文件由 `entry_detect.py --write-starter` 自动生成
> 生成时间: {datetime.now().isoformat()}
"""

        try:
            with open(output_path, 'w', encoding='utf-8') as output_file:
                output_file.write(content)
            print(f"✓ 启动模板已写入: {output_path}")
            print(f"  环境: {cap.environment}")
            print(f"  AgentSoul 已安装: {'是' if report['agentsoul_installed'] else '否'}")
        except Exception as e:
            print(f"✗ 写入文件失败: {e}")
            sys.exit(1)
        sys.exit(0)

    if args.precheck:
        report = generate_report()
        cap = report["detected"]
        assert isinstance(cap, EntryCapability), "cap must be EntryCapability"

        # Precheck: check if target files already exist
        existing_files = []
        candidate_files = [
            "config/persona.yaml",
            "config/behavior.yaml",
            "CLAUDE.md",
            ".cursorrules",
            ".windsurfrules",
        ]
        for f in candidate_files:
            if os.path.exists(f):
                existing_files.append(f)

        # Create unified check results
        check_results = [
            UnifiedCheckResult(
                name="环境检测",
                description="检测当前运行环境类型",
                score=100 if report["agentsoul_installed"] else 80,
                passed=True,
                issues=[] if report["agentsoul_installed"] else ["AgentSoul not detected in current workspace"],
                recommendations=[] if report["agentsoul_installed"] else ["Install AgentSoul to enable full capabilities"],
            )
        ]

        check_results.append(
            UnifiedCheckResult(
                name=f"环境: {cap.environment}",
                description=cap.description,
                score=100,
                passed=True,
                issues=[],
                recommendations=[f"Available injection methods: {', '.join(cap.available_injection_methods)}"],
            )
        )

        if existing_files:
            check_results.append(
                UnifiedCheckResult(
                    name="预演检查",
                    description="检测到现有配置文件",
                    score=85,
                    passed=True,
                    issues=[],
                    recommendations=[f"Existing configuration files: {', '.join(existing_files)} - these may be overwritten during injection"],
                )
            )
        else:
            check_results.append(
                UnifiedCheckResult(
                    name="预演检查",
                    description="未检测到现有配置文件",
                    score=100,
                    passed=True,
                    issues=[],
                    recommendations=["No existing configuration conflicts, ready for injection"],
                )
            )

        # Calculate overall score
        overall_score = 100 if len(existing_files) == 0 and report["agentsoul_installed"] else (85 if existing_files else 80)
        if report["agentsoul_installed"]:
            if len(existing_files) == 0:
                assessment = "极佳：预演完成，无冲突，准备就绪可以注入。"
            else:
                assessment = f"良好：预演完成，检测到 {len(existing_files)} 个现有配置文件，注入可能覆盖，请确认后继续。"
        else:
            assessment = "可使用：环境已识别，但未检测到 AgentSoul 安装，需要先安装 AgentSoul。"

        summary = HealthSummary(
            checker_name="entry_detect-precheck",
            overall_score=overall_score,
            assessment=assessment,
            timestamp=datetime.now().isoformat(),
            min_score=None,
            gate_passed=None,
            exit_code=0,
            output_file=None,
            output_format=None,
            check_results=check_results,
        )
        print(summary.to_json())
        sys.exit(0)

    if args.summary_json:
        report = generate_report()
        cap = report["detected"]
        assert isinstance(cap, EntryCapability), "cap must be EntryCapability"

        # Create unified check results
        check_results = [
            UnifiedCheckResult(
                name="环境检测",
                description="检测当前运行环境类型",
                score=100 if report["agentsoul_installed"] else 80,
                passed=True,
                issues=[] if report["agentsoul_installed"] else ["AgentSoul not detected in current workspace"],
                recommendations=[] if report["agentsoul_installed"] else ["Install AgentSoul to enable full capabilities"],
            )
        ]

        # Add environment info as a check
        check_results.append(
            UnifiedCheckResult(
                name=f"环境: {cap.environment}",
                description=cap.description,
                score=100,
                passed=True,
                issues=[],
                recommendations=[f"Available injection methods: {', '.join(cap.available_injection_methods)}"],
            )
        )

        # Calculate overall score
        # 100 if AgentSoul installed and detected environment, 80 if AgentSoul not found but environment detected
        overall_score = 100 if report["agentsoul_installed"] else 80
        assessment = (
            "极佳：AgentSoul 已检测到环境，可以正常注入。" if report["agentsoul_installed"]
            else "可使用：环境已识别，但未检测到 AgentSoul 安装。"
        )

        summary = HealthSummary(
            checker_name="entry_detect",
            overall_score=overall_score,
            assessment=assessment,
            timestamp=datetime.now().isoformat(),
            min_score=None,
            gate_passed=None,
            exit_code=0,
            output_file=None,
            output_format=None,
            check_results=check_results,
        )
        print(summary.to_json())
        sys.exit(0)

    if args.generate_template:
        report = generate_report()
        cap = report["detected"]
        assert isinstance(cap, EntryCapability), "cap must be EntryCapability"
        template = report["injection_template"]

        if template:
            print(template)
        else:
            print(f"No injection template available for environment: {cap.environment}")
        sys.exit(0)

    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print("""AgentSoul Entry Capability Detector

Detect the current running environment and output available injection methods.

Usage:
  python -m src.entry_detect
  python src/entry_detect.py
  python -m src.entry_detect --help
  python src/entry_detect.py --summary-json
  python src/entry_detect.py --generate-template
  python src/entry_detect.py --precheck
  python src/entry_detect.py --write-starter

Exit codes:
  0: Success
  1: Error
""")
        sys.exit(0)
    print_report()


if __name__ == "__main__":
    main()
