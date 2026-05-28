"""
AgentSoul · Session Launcher
============================

Spawns a terminal window (macOS Terminal or iTerm2) using AppleScript (osascript),
automatically cd-ing to the project directory and executing the Claude Code resume command.
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# Calculate project root manually before importing
project_root = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(project_root))

from common import log
from src.sessions.launchers import launch_in_terminal


def launch_session_in_terminal(
    session_id: str,
    project_dir: str | Path,
    terminal_app: str = "Terminal",
    command_template: str = "claude -r {session_id}"
) -> bool:
    """
    Launch a terminal window, cd to project_dir, and resume conversation session.
    Delegated to LauncherRegistry.
    """
    return launch_in_terminal(
        terminal_name=terminal_app,
        session_id=session_id,
        project_dir=str(project_dir),
        command_template=command_template
    )


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python3 session_launcher.py <session_id> <project_dir> [terminal_app] [command_template]")
        sys.exit(1)
        
    sess_id = sys.argv[1]
    proj_dir = sys.argv[2]
    term = sys.argv[3] if len(sys.argv) > 3 else "Terminal"
    tpl = sys.argv[4] if len(sys.argv) > 4 else "claude -r {session_id}"
    
    launch_session_in_terminal(sess_id, proj_dir, term, tpl)
