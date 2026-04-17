from __future__ import annotations

from pathlib import Path

from agentsoul.common import get_project_root

PROJECT_ROOT: Path = get_project_root()
VAR_ROOT: Path = PROJECT_ROOT / "var"
VAR_DATA_ROOT: Path = VAR_ROOT / "data"
MCP_APP_ROOT: Path = PROJECT_ROOT / "apps" / "mcp-server"


def resolve_var_data_root(project_root: Path | None = None) -> Path:
    root = project_root or PROJECT_ROOT
    return root / "var" / "data"
