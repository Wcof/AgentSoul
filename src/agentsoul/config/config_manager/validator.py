"""
AgentSoul · Config Validator 代理
从 src/config_manager/validator.py 导出所有公共接口
"""
from __future__ import annotations

import sys
from pathlib import Path

_project_root = Path(__file__).parent.parent.parent.parent.parent
if str(_project_root) not in sys.path:
    sys.path.insert(0, str(_project_root))

from src.config_manager.validator import *  # noqa: F401,F403
