"""
Entry Capability Detector for Master Agent

Detect the current running environment (Claude Code / OpenAI Codex / Gemini)
and output the available injection methods for Master Agent continuity.
"""

import os
import sys
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


@dataclass
class EntryCapability:
    """Result of entry capability detection."""
    environment: str
    description: str
    available_injection_methods: List[str]
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
    available: List[str] = []
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
        except:
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


def check_agentsoul_installed() -> Tuple[bool, Optional[str]]:
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


def get_injection_template(env: str) -> Optional[str]:
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


if __name__ == "__main__":
    print_report()
