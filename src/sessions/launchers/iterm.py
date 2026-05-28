"""
AgentSoul · iTerm2 Launcher
===========================

Launches iTerm2 terminal emulator and resumes interactive AI CLI sessions.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from common import log
from .base import BaseTerminalLauncher


class ITermLauncher(BaseTerminalLauncher):
    """Launcher for iTerm2."""

    def get_terminal_name(self) -> str:
        return "iTerm"

    def launch(
        self,
        session_id: str,
        project_dir: str,
        command_template: str,
    ) -> bool:
        project_path = Path(project_dir).expanduser().resolve()
        if not project_path.exists() or not project_path.is_dir():
            log(f"Project directory does not exist: {project_dir}", "ERROR")
            return False

        if sys.platform != "darwin":
            log("iTerm2 launching via AppleScript is only supported on macOS", "WARN")
            cmd = f"cd '{project_path}' && {command_template.format(session_id=session_id)}"
            print(f"\nPlease run the following command in your terminal:\n\n  {cmd}\n")
            return False

        cmd_script = f"cd '{project_path}' && {command_template.format(session_id=session_id)}"

        script = f"""
        tell application "iTerm"
            try
                create window with default profile
                tell current session of current window
                    write text "{cmd_script}"
                end tell
                activate
            on error
                # Fallback to standard Terminal if iTerm fails/is not installed
                tell application "Terminal"
                    do script "{cmd_script}"
                    activate
                end tell
            end try
        end tell
        """

        try:
            subprocess.run(["osascript", "-e", script], check=True, capture_output=True)
            log(f"Spawned iTerm2 window and executed: {cmd_script}", "OK")
            return True
        except subprocess.CalledProcessError as e:
            log(f"Failed to execute AppleScript to launch iTerm2: {e.stderr.decode('utf-8')}", "ERROR")
            print(f"\nPlease manually run in your terminal:\n\n  {cmd_script}\n")
            return False
