"""
AgentSoul · 通用工具模块代理
从项目根目录的 common 模块导出所有公共接口
"""
from __future__ import annotations

import importlib
import sys
from pathlib import Path

# 确保项目根目录优先在路径中（在 src 之前）
_project_root = str(Path(__file__).parent.parent.parent)
if _project_root in sys.path:
    sys.path.remove(_project_root)
sys.path.insert(0, _project_root)

# 直接导入根目录的 common 模块
_common = importlib.import_module('common')

# 导出所有公共接口
_public_names = [name for name in dir(_common) if not name.startswith('_')]
for _name in _public_names:
    globals()[_name] = getattr(_common, _name)

__all__ = _public_names
