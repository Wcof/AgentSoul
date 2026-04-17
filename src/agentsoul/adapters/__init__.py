"""
AgentSoul · 平台适配器
====================

提供不同 AI 平台的注入适配器：
- openai: OpenAI SDK 兼容适配器
- gemini: Google Gemini 兼容适配器
"""
from __future__ import annotations

from .gemini import GeminiInjectionAdapter, GeminiInjectionConfig, GeminiMessage
from .openai import InjectionConfig, OpenAIInjectionAdapter, OpenAIMessage

__all__ = [
    "OpenAIInjectionAdapter",
    "InjectionConfig",
    "OpenAIMessage",
    "GeminiInjectionAdapter",
    "GeminiInjectionConfig",
    "GeminiMessage",
]
