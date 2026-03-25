"""
AgentSoul · 通用工具模块
提供日志、配置加载等通用功能
"""

import sys
from pathlib import Path
from typing import Optional
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from src.config_loader import ConfigLoader
    from src.path_compat import PathResolver, resolve_path

__version__ = "1.0.0"
__all__ = ["log", "icons", "load_config", "get_project_root", "safe_file_stem", "initialize_identity", "ConfigLoader", "PathResolver", "resolve_path"]

# Re-exports from src modules done lazily to avoid circular imports
def __getattr__(name: str):
    if name == "ConfigLoader":
        from src.config_loader import ConfigLoader
        return ConfigLoader
    if name == "PathResolver":
        from src.path_compat import PathResolver
        return PathResolver
    if name == "resolve_path":
        from src.path_compat import resolve_path
        return resolve_path
    raise AttributeError(f"module {__name__} has no attribute {name}")

PROJECT_ROOT = Path(__file__).parent.parent


def get_project_root() -> Path:
    if "__file__" in globals():
        return Path(__file__).parent.parent
    return Path.cwd()


def log(message: str, level: str = "INFO") -> None:
    symbols = {
        "INFO": "ℹ️",
        "OK": "✅",
        "WARN": "⚠️",
        "ERROR": "❌",
        "STEP": "🔧"
    }
    symbol = symbols.get(level, "ℹ️")
    print(f"{symbol} {message}")


def icons() -> dict:
    return {
        "check": "✅",
        "cross": "❌",
        "warn": "⚠️",
        "info": "ℹ️",
        "gear": "⚙️",
        "sparkle": "✨",
    }


def load_config(project_root: Optional[Path] = None) -> dict:
    if project_root is None:
        project_root = PROJECT_ROOT

    config_path = project_root / "config" / "persona.yaml"
    if not config_path.exists():
        return {}

    try:
        import yaml
        with open(config_path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception:
        return {}


def safe_file_stem(value: str, fallback: str) -> str:
    """生成安全的文件名，去除路径分隔符
    Args:
        value: 原始字符串
        fallback: 为空时的回退值
    Returns:
        安全的文件名
    """
    if not value.strip():
        return fallback
    # Remove all path separators from input to ensure a single filename token
    normalized = value.replace("/", "").replace("\\", "").strip()
    return normalized or fallback


def initialize_identity(
    agentsoul_root: Path,
    output_root: Path,
    verbose: bool = True
) -> None:
    """从 AgentSoul config/persona.yaml 初始化身份档案到输出目录

    Args:
        agentsoul_root: AgentSoul 项目根目录（用于加载配置）
        output_root: 输出根目录，身份档案会写入 output_root/data/identity/
        verbose: 是否打印日志信息
    """
    from src.config_loader import ConfigLoader

    loader = ConfigLoader(agentsoul_root)
    config = loader.load_persona_config()

    ai = config.ai
    master = config.master

    ai_name = ai.name or "Agent"
    ai_nickname = ai.nickname or ""
    ai_role = ai.role or "AI Assistant"
    ai_traits = ai.personality or []
    ai_core_values = ai.core_values or []

    master_name = master.name or ""
    master_nicknames = master.nickname or []
    master_timezone = master.timezone or "Asia/Shanghai"
    master_labels = master.labels or []

    identity_root = output_root / "data" / "identity"
    self_dir = identity_root / "self"
    master_dir = identity_root / "master"

    # Ensure directories exist (created earlier by installer, but ensure they exist)
    self_dir.mkdir(parents=True, exist_ok=True)
    master_dir.mkdir(parents=True, exist_ok=True)

    ai_profile = f"""# AI Identity Profile

- **Name**: {ai_name}
- **Nickname**: {ai_nickname or '（未设置）'}
- **Role**: {ai_role}

## Personality Traits
{chr(10).join(f'- {item}' for item in ai_traits) if ai_traits else '- （未配置）'}

## Core Values
{chr(10).join(f'- {item}' for item in ai_core_values) if ai_core_values else '- （未配置）'}
"""

    master_profile = f"""# Master Identity Profile

- **Name**: {master_name or '（未设置）'}
- **Nicknames**: {', '.join(master_nicknames) if master_nicknames else '（未设置）'}
- **Timezone**: {master_timezone}

## Labels
{chr(10).join(f'- {item}' for item in master_labels) if master_labels else '- （未配置）'}
"""

    files_to_write: list[tuple[Path, str]] = [
        (self_dir / "profile.md", ai_profile),
        (self_dir / f"{safe_file_stem(ai_name, 'agent')}.md", ai_profile),
    ]

    if master_name:
        files_to_write.extend([
            (master_dir / "profile.md", master_profile),
            (master_dir / f"{safe_file_stem(master_name, 'master')}.md", master_profile),
        ])

    for file_path, content in files_to_write:
        file_path.write_text(content, encoding="utf-8")
        if verbose:
            rel_path = file_path.relative_to(output_root) if output_root.exists() else file_path
            log(f"已注入身份档案: {rel_path}", "OK")