"""
AgentSoul · Base Terminal Launcher
==================================

Defines the abstract interface for terminal application launchers.
Used to open terminal windows and resume interactive AI CLI sessions.
"""
from __future__ import annotations

from abc import ABC, abstractmethod


class BaseTerminalLauncher(ABC):
    """Abstract base class for terminal launchers."""

    @abstractmethod
    def launch(
        self,
        session_id: str,
        project_dir: str,
        command_template: str,
    ) -> bool:
        """
        Launch the terminal, navigate to the project directory, and execute the resume command.

        Args:
            session_id: The session ID of the conversation.
            project_dir: Directory where the AI tool should run.
            command_template: Command string template to run, e.g. "claude -r {session_id}"

        Returns:
            True if launched successfully, False otherwise.
        """

    @abstractmethod
    def get_terminal_name(self) -> str:
        """
        Return the canonical terminal application name, e.g. 'Terminal', 'iTerm'.
        """
