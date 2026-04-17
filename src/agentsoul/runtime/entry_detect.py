"""
Entry Capability Detector for Master Agent

Detect the current running environment (Claude Code / OpenAI Codex / Gemini)
and output the available injection methods for Master Agent continuity.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

# Calculate project root manually before importing common (chicken-and-egg)
project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, str(project_root))

from agentsoul.common.health_gate import UnifiedCheckResult, handle_summary_output  # noqa: E402


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
3. Read the base rules from `src/agentsoul/templates/` (SKILL.md, soul_base.md, memory_base.md, etc.)
4. Load daily memory from `var/data/memory/day/` for recent context
5. Load any topic memory that matches the current discussion topic

Use the OpenAI adapter from `src/agentsoul/adapters/openai.py` to help map the data.
""".strip(),

        "gemini_code_assist": """
# Master Agent Injection for Gemini Code Assist

AgentSoul data files exist in this workspace. Inject the following:

1. Load persona configuration from `config/persona.yaml`
2. Load behavior configuration from `config/behavior.yaml`
3. Read the base rules from `src/agentsoul/templates/` (SKILL.md, soul_base.md, memory_base.md, etc.)
4. Load daily memory from `var/data/memory/day/` for recent context
5. Load any topic memory that matches the current discussion topic

Use the Gemini adapter from `src/agentsoul/adapters/gemini.py` to help map the data.
""".strip(),

        "generic_local": """
# Master Agent Injection for Generic Local Environment

Check if AgentSoul data files exist:
- config/persona.yaml - contains persona configuration
- var/data/ - contains memory and soul state

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
    parser.add_argument(
        "--parse-url-share",
        type=str,
        help="解析分享链接：解析 URL 分享链接中的搜索条件，输出检测结果",
        default=None,
    )
    parser.add_argument(
        "--cleanup-memory",
        action="store_true",
        help="记忆目录清理：扫描记忆目录，检测重复/损坏/空文件，提供清理选项",
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

        handle_summary_output(
            checker_name="entry_detect",
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

    if args.parse_url_share is not None:
        # Parse URL share link and extract search conditions
        url = args.parse_url_share
        # Extract hash part from URL
        hash_part = None
        if '#' in url:
            hash_part = url.split('#', 1)[1]
        else:
            # If input is just the hash part directly
            if len(url) > 0 and url[0] != '#':
                hash_part = url
            else:
                hash_part = url[1:]

        if not hash_part:
            print("❌ 错误：无法从 URL 中提取 hash 部分，请确保输入是完整的分享链接")
            sys.exit(1)

        try:
            # Base64 decode
            json_str_bytes = base64.b64decode(hash_part)
            json_str = json_str_bytes.decode('utf-8')
            # URL decode
            json_str = unquote(json_str)
            share_data = json.loads(json_str)

            # Extract search conditions
            search_query = share_data.get('searchQuery', '')
            active_tag = share_data.get('activeTag', None)

            print("=" * 60)
            print(" AgentSoul URL 分享链接解析结果")
            print("=" * 60)
            print()
            print(f"🔍 搜索关键词: {search_query if search_query else '<空>'}")
            print(f"🏷️ 活跃标签: {active_tag if active_tag is not None else '<无>'}")
            print()
            print("📋 搜索条件:")
            if search_query:
                print(f"  - 关键词搜索: {search_query}")
            if active_tag:
                print(f"  - 标签筛选: {active_tag}")
            print()
            print("ℹ️  该分享链接可在 AgentSoul Web UI 中打开，自动加载相同搜索条件")
            print("    Web UI 位置: apps/web/index.html")
            print()
            print("✅ 解析成功")
            print("=" * 60)
            sys.exit(0)
        except Exception as e:
            print(f"❌ 解析失败: {e}")
            print("请检查分享链接是否完整正确")
            sys.exit(1)

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
        # List of files that install.py would create/modify
        candidate_files = [
            # Core configuration
            ("config/persona.yaml", "核心人格配置", True),
            ("config/behavior.yaml", "行为配置", True),
            # IDE rules files
            ("CLAUDE.md", "Claude Code 项目规则", False),
            (".cursorrules", "Cursor 编辑器规则", False),
            (".windsurfrules", "Windsurf 编辑器规则", False),
            # Generated persona package
            ("agent-persona.md", "完整人格包", False),
            # Install tracking for rollback
            (".install-tracker.json", "安装追踪记录（用于回滚）", True),
        ]

        conflicts = []
        existing_agentsoul = []
        existing_user = []

        for f, desc, is_core in candidate_files:
            if os.path.exists(f):
                # Check if this was created by AgentSoul installation
                is_agentsoul_file = False
                try:
                    with open(f, encoding='utf-8') as f_check:
                        content = f_check.read(2000)  # Check first 2000 chars
                        if 'AgentSoul' in content or 'agentsoul' in content.lower():
                            is_agentsoul_file = True
                except Exception:
                    pass

                if is_agentsoul_file:
                    existing_agentsoul.append(f"{f} ({desc})")
                else:
                    existing_user.append(f"{f} ({desc})")
                conflicts.append(f)

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

        # Add detailed conflict analysis
        issues = []
        recs = []
        score = 100
        description = ""

        if not conflicts:
            description = "未检测到现有配置文件"
            recs.append("No existing configuration conflicts, ready for injection")
        else:
            description = f"检测到 {len(conflicts)} 个现有文件会被安装过程触及"
            if existing_user:
                issues.append(f"用户原有文件: {', '.join(existing_user)} - 这些文件会被覆盖")
                # Lower score for user files conflict
                score -= 5 * len(existing_user)
            if existing_agentsoul:
                recs.append(f"AgentSoul 自有文件: {', '.join(existing_agentsoul)} - 这些会被更新/覆盖，属于正常操作")

            if existing_user:
                recs.append(f"⚠️  请确认是否允许覆盖上述 {len(existing_user)} 个用户原有文件")
                recs.append("如果不确认，建议先备份这些文件再继续安装")

            # Score can't go below 50
            score = max(score, 50)

        check_results.append(
            UnifiedCheckResult(
                name="预演检查",
                description=description,
                score=score,
                passed=True,
                issues=issues,
                recommendations=recs,
            )
        )

        # Calculate overall score
        if report["agentsoul_installed"]:
            if not conflicts:
                overall_score = 100
                assessment = "极佳：预演完成，无冲突，准备就绪可以注入。"
            elif not existing_user:
                overall_score = score
                assessment = f"良好：预演完成，检测到 {len(existing_agentsoul)} 个 AgentSoul 自有文件，会被正常更新。"
            else:
                overall_score = score
                assessment = f"可继续：预演完成，检测到 {len(existing_user)} 个用户原有文件会被覆盖，请确认备份后再继续。"
        else:
            overall_score = 80 if conflicts else 85
            assessment = "可使用：环境已识别，但未检测到 AgentSoul 安装，需要先安装 AgentSoul。"

        handle_summary_output(
            checker_name="entry_detect-precheck",
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

    if args.cleanup_memory:
        # Memory directory cleanup: scan for duplicate/corrupted/empty files

        # Find memory root directory
        # Common memory locations
        memory_candidates = [
            "var/data/memory",
            "../var/data/memory",
            "./var/data/memory",
            os.path.join(project_root, "var/data/memory"),
        ]

        memory_root = None
        for candidate in memory_candidates:
            if os.path.isdir(candidate):
                memory_root = Path(candidate)
                break

        if memory_root is None:
            print("❌ 错误：未找到记忆目录，请确认 AgentSoul 是否正确安装")
            print("预期位置: var/data/memory/")
            sys.exit(1)

        # Scan all memory files
        memory_files: list[Path] = []
        for ext in ["*.md", "*.json"]:
            memory_files.extend(memory_root.rglob(ext))

        if not memory_files:
            print("ℹ️  记忆目录为空，没有文件需要清理")
            sys.exit(0)

        # Analysis results
        empty_files: list[Path] = []
        corrupted_files: list[tuple[Path, str]] = []
        content_hashes: dict[str, list[Path]] = {}
        duplicate_groups: list[list[Path]] = []

        # Check each file
        for file_path in memory_files:
            try:
                file_size = file_path.stat().st_size
                if file_size == 0:
                    empty_files.append(file_path)
                    continue

                with open(file_path, encoding='utf-8') as fp:
                    content = fp.read().strip()

                if not content:
                    empty_files.append(file_path)
                    continue

                # Calculate content hash for duplicate detection
                content_hash = hashlib.sha256(content.encode('utf-8')).hexdigest()

                if content_hash in content_hashes:
                    content_hashes[content_hash].append(file_path)
                else:
                    content_hashes[content_hash] = [file_path]

            except Exception as e:
                corrupted_files.append((file_path, str(e)))
                continue

        # Find duplicate groups (more than one file with same content)
        for content_hash, files in content_hashes.items():
            if len(files) > 1:
                duplicate_groups.append(files)

        # Generate human-readable report
        print("=" * 60)
        print(" AgentSoul 记忆目录清理扫描结果")
        print("=" * 60)
        print()
        print(f"扫描目录: {memory_root}")
        print(f"总文件数: {len(memory_files)}")
        print()

        if empty_files:
            print(f"⚠️  空文件 ({len(empty_files)}):")
            for item in empty_files:
                print(f"  - {item.relative_to(memory_root)}")
            print()

        if corrupted_files:
            print(f"⚠️  损坏/无法读取文件 ({len(corrupted_files)}):")
            for item, err in corrupted_files:
                print(f"  - {item.relative_to(memory_root)}: {err}")
            print()

        if duplicate_groups:
            print(f"⚠️  重复内容文件 ({len(duplicate_groups)} 组):")
            for i, group in enumerate(duplicate_groups, 1):
                print(f"  组 {i}:")
                for item in group:
                    print(f"    - {item.relative_to(memory_root)}")
                print()

        total_issues = len(empty_files) + len(corrupted_files) + sum(len(g) - 1 for g in duplicate_groups)

        if total_issues == 0:
            print("✅ 未发现问题，所有记忆文件正常且无重复")
        else:
            print(f"发现 {total_issues} 个问题文件")
            print()
            print("💡 建议操作:")
            print("  - 空文件: 可以安全删除")
            print("  - 损坏文件: 建议删除，检查写入过程是否异常")
            print("  - 重复文件: 保留一个即可，删除其余重复项")
            print()
            print("使用 --summary-json 可获取机器可读的统一格式结果")

        print("=" * 60)

        # If summary-json was requested along with cleanup-memory, output JSON
        if args.summary_json:
            check_results = []

            # Overall statistics
            total_files = len(memory_files)
            empty_count = len(empty_files)
            corrupted_count = len(corrupted_files)
            duplicate_count = sum(len(g) - 1 for g in duplicate_groups)
            total_issues = empty_count + corrupted_count + duplicate_count

            check_results.append(
                UnifiedCheckResult(
                    name="扫描统计",
                    description=f"扫描记忆目录 {memory_root}",
                    score=100,
                    passed=True,
                    issues=[],
                    recommendations=[f"总文件数: {total_files}, 问题文件数: {total_issues}"],
                )
            )

            if empty_files:
                check_results.append(
                    UnifiedCheckResult(
                        name="空文件",
                        description=f"检测到 {len(empty_files)} 个空文件",
                        score=100 - len(empty_files) * 5,
                        passed=True,
                        issues=[f"{f.relative_to(memory_root)}" for f in empty_files],
                        recommendations=["空文件可以安全删除"],
                    )
                )

            if corrupted_files:
                issues = [f"{f.relative_to(memory_root)} ({err})" for f, err in corrupted_files]
                check_results.append(
                    UnifiedCheckResult(
                        name="损坏文件",
                        description=f"检测到 {len(corrupted_files)} 个无法读取的文件",
                        score=100 - len(corrupted_files) * 10,
                        passed=len(corrupted_files) < 5,
                        issues=issues,
                        recommendations=["损坏文件建议删除，检查写入过程"],
                    )
                )

            if duplicate_groups:
                recommendations = []
                for i, group in enumerate(duplicate_groups, 1):
                    recommendations.append(f"组 {i}: 保留 {group[0].relative_to(memory_root)}，删除其余 {len(group) - 1} 个")
                check_results.append(
                    UnifiedCheckResult(
                        name="重复文件",
                        description=f"检测到 {len(duplicate_groups)} 组重复内容",
                        score=100 - len(duplicate_groups) * 3,
                        passed=True,
                        issues=[f"组 {i+1}: {', '.join(str(f.relative_to(memory_root)) for f in g)}" for i, g in enumerate(duplicate_groups)],
                        recommendations=recommendations,
                    )
                )

            # Calculate overall score
            if total_issues == 0:
                overall_score = 100
                assessment = "极佳：所有记忆文件状态良好，无空文件、无损坏、无重复"
            else:
                # Each issue reduces score by 2, minimum 50
                overall_score = max(50, 100 - total_issues * 2)
                if overall_score >= 90:
                    assessment = f"良好：发现 {total_issues} 个问题文件，不影响正常使用"
                elif overall_score >= 70:
                    assessment = f"一般：发现 {total_issues} 个问题文件，建议清理"
                else:
                    assessment = f"需要注意：发现 {total_issues} 个问题文件，记忆库存在较多重复或损坏"

            handle_summary_output(
                checker_name="entry_detect-cleanup-memory",
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

    if len(sys.argv) > 1 and sys.argv[1] in ("-h", "--help"):
        print("""AgentSoul Entry Capability Detector

Detect the current running environment and output available injection methods.

Usage:
  python -m agentsoul.entry_detect
  python3 -m agentsoul.runtime.entry_detect
  python -m agentsoul.entry_detect --help
  python3 -m agentsoul.runtime.entry_detect --summary-json
  python3 -m agentsoul.runtime.entry_detect --generate-template
  python3 -m agentsoul.runtime.entry_detect --precheck
  python3 -m agentsoul.runtime.entry_detect --write-starter
  python3 -m agentsoul.runtime.entry_detect --parse-url-share <url>
  python3 -m agentsoul.runtime.entry_detect --cleanup-memory
  python3 -m agentsoul.runtime.entry_detect --cleanup-memory --summary-json

Exit codes:
  0: Success
  1: Error
""")
        sys.exit(0)
    print_report()


if __name__ == "__main__":
    main()
