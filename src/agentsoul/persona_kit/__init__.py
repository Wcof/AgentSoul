"""
AgentSoul · Persona Kit 模块
提供可分发、可验证、可迭代的人格包管理能力
"""
from __future__ import annotations

from agentsoul.persona_kit.quality_check import PersonaKitChecker, QualityReport
from agentsoul.persona_kit.scaffold import init_persona_kit

__all__ = [
    "PersonaKitChecker",
    "QualityReport",
    "init_persona_kit",
]
