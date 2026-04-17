"""
AgentSoul · Common utilities.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any

from .cache import CachedValue, TTLCacheBase
from .health_gate import HealthSummary, UnifiedCheckResult

__version__ = "1.0.0"

PROJECT_ROOT = Path(__file__).resolve().parents[3]


def get_project_root() -> Path:
    return PROJECT_ROOT


def get_default_pad_state() -> dict[str, Any]:
    return {
        "pleasure": 0.3,
        "arousal": 0.2,
        "dominance": 0.3,
        "last_updated": None,
        "history": [],
    }


def log(message: str, level: str = "INFO") -> None:
    symbols = {
        "INFO": "ℹ️",
        "OK": "✅",
        "WARN": "⚠️",
        "ERROR": "❌",
        "STEP": "🔧",
    }
    print(f"{symbols.get(level, 'ℹ️')} {message}")


def safe_file_stem(value: str, fallback: str) -> str:
    if not value.strip():
        return fallback
    normalized = value.replace("/", "").replace("\\", "").strip()
    return normalized or fallback


def read_last_n_lines(file_path: Path, n: int, buffer_size: int = 4096) -> list[str]:
    lines: list[str] = []
    with open(file_path, "rb") as f:
        file_size = f.seek(0, 2)
        current_position = max(0, file_size - buffer_size)
        f.seek(current_position)
        buffer = f.read(buffer_size)
        while len(lines) < n and current_position > 0:
            parts = buffer.split(b"\n")
            for part in reversed(parts[:-1]):
                if not part:
                    continue
                try:
                    lines.append(part.decode("utf-8"))
                except UnicodeDecodeError:
                    continue
                if len(lines) >= n:
                    break
            if len(lines) >= n:
                break
            step = min(buffer_size, current_position)
            current_position -= step
            f.seek(current_position)
            buffer = f.read(step) + buffer
        if len(lines) < n and current_position == 0:
            parts = buffer.split(b"\n")
            for part in reversed(parts):
                if not part:
                    continue
                try:
                    lines.append(part.decode("utf-8"))
                except UnicodeDecodeError:
                    continue
                if len(lines) >= n:
                    break
    return list(reversed(lines[:n]))


def initialize_identity(agentsoul_root: Path, output_root: Path, verbose: bool = True) -> None:
    from agentsoul.config.config_loader import ConfigLoader

    loader = ConfigLoader(agentsoul_root)
    config = loader.load_persona_config()
    ai = config.ai
    master = config.master

    ai_name = ai.name if ai.name else "Agent"
    identity_root = output_root / "var" / "data" / "identity"
    self_dir = identity_root / "self"
    master_dir = identity_root / "master"
    self_dir.mkdir(parents=True, exist_ok=True)
    master_dir.mkdir(parents=True, exist_ok=True)

    ai_profile = f"""# AI Identity Profile

- **Name**: {ai_name}
- **Nickname**: {ai.nickname or 'unset'}
- **Role**: {ai.role}
- **Personality**: {", ".join(ai.personality) if ai.personality else "unset"}
"""
    master_profile = f"""# Master Identity Profile

- **Name**: {master.name or 'unset'}
- **Nicknames**: {', '.join(master.nickname) if master.nickname else 'unset'}
- **Timezone**: {master.timezone}
"""
    (self_dir / "profile.md").write_text(ai_profile, encoding="utf-8")
    (self_dir / f"{safe_file_stem(ai_name, 'agent')}.md").write_text(ai_profile, encoding="utf-8")
    if master.name:
        (master_dir / "profile.md").write_text(master_profile, encoding="utf-8")
        (master_dir / f"{safe_file_stem(master.name, 'master')}.md").write_text(master_profile, encoding="utf-8")
    if verbose:
        log("Identity initialized", "OK")


def load_config(project_root: Path | None = None) -> dict[str, Any]:
    import yaml

    root = project_root or PROJECT_ROOT
    config_path = root / "config" / "persona.yaml"
    if not config_path.exists():
        return {}
    with open(config_path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def icons() -> dict[str, str]:
    return {
        "check": "✅",
        "cross": "❌",
        "warn": "⚠️",
        "info": "ℹ️",
        "gear": "⚙️",
        "sparkle": "✨",
    }


__all__ = [
    "TTLCacheBase",
    "CachedValue",
    "HealthSummary",
    "UnifiedCheckResult",
    "__version__",
    "get_project_root",
    "get_default_pad_state",
    "log",
    "safe_file_stem",
    "read_last_n_lines",
    "initialize_identity",
    "load_config",
    "icons",
]
