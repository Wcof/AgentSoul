"""
AgentSoul · Terminal Launcher Registry
======================================

Registry holding all active terminal launchers.
"""
from __future__ import annotations

from .base import BaseTerminalLauncher
from .terminal import TerminalLauncher
from .iterm import ITermLauncher


class LauncherRegistry:
    """Registry holding all active terminal launchers."""

    def __init__(self) -> None:
        self._launchers: dict[str, BaseTerminalLauncher] = {}

    def register(self, launcher: BaseTerminalLauncher) -> None:
        name = launcher.get_terminal_name().lower()
        self._launchers[name] = launcher

    def launch(
        self,
        terminal_name: str,
        session_id: str,
        project_dir: str,
        command_template: str,
    ) -> bool:
        """Launch the requested terminal. Falls back to Terminal if not found/fails."""
        name = terminal_name.lower()
        launcher = self._launchers.get(name)

        if launcher:
            try:
                if launcher.launch(session_id, project_dir, command_template):
                    return True
            except Exception:
                pass  # Fall back to default macOS Terminal

        # Fallback to default macOS Terminal
        default_launcher = self._launchers.get("terminal")
        if default_launcher and name != "terminal":
            try:
                return default_launcher.launch(session_id, project_dir, command_template)
            except Exception:
                pass

        return False


# Module-level default registry
_default_registry = LauncherRegistry()
_default_registry.register(TerminalLauncher())
_default_registry.register(ITermLauncher())


def launch_in_terminal(
    terminal_name: str,
    session_id: str,
    project_dir: str,
    command_template: str,
) -> bool:
    """Convenience wrapper around default registry."""
    return _default_registry.launch(terminal_name, session_id, project_dir, command_template)


__all__ = [
    "BaseTerminalLauncher",
    "LauncherRegistry",
    "launch_in_terminal",
]
