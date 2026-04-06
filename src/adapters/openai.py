"""
AgentSoul · OpenAI 链路注入适配器
===============================

提供 OpenAI SDK 兼容的注入方式，将 AgentSoul 人格/记忆/技能注入到 OpenAI 对话。
支持：
- 自动系统提示注入
- 记忆上下文自动插入
- PAD 情绪状态感知响应调整
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass
from datetime import datetime
from typing import Any

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from src.abstract import (
    BaseMemoryStorage,
    BasePersonaStorage,
    BaseSkillStorage,
    BaseSoulStateStorage,
    SoulVersion,
    UnifiedSoulStorage,
)
from src.storage.local import (
    LocalMemoryStorage,
    LocalPersonaStorage,
    LocalSkillStorage,
    LocalSoulStateStorage,
)


@dataclass
class OpenAIMessage:
    """OpenAI 消息格式"""
    role: str
    content: str
    name: str | None = None


@dataclass
class InjectionConfig:
    """注入配置"""
    include_persona: bool = True          # 是否注入人格配置
    include_soul_state: bool = True       # 是否注入情绪状态
    include_recent_memory: bool = True    # 是否注入最近记忆
    include_rules: bool = True            # 是否注入基础规则
    max_memory_tokens: int = 1000         # 记忆最大 token 数
    system_prompt_position: str = "top"   # 系统提示位置：top/bottom


class OpenAIInjectionAdapter:
    """OpenAI 链路注入适配器

    用法：
        from openai import OpenAI
        from agentsoul.adapters.openai import OpenAIInjectionAdapter

        client = OpenAI()
        adapter = OpenAIInjectionAdapter()

        # 在调用 OpenAI 之前注入上下文
        messages = adapter.inject_context([
            {"role": "user", "content": "Hello!"}
        ])

        # 发送请求
        response = client.chat.completions.create(messages=messages, model="gpt-4")

        # 对话结束后保存记忆
        adapter.save_daily_summary(response, user_input)
    """

    def __init__(
        self,
        storage: UnifiedSoulStorage | None = None,
        persona_storage: BasePersonaStorage | None = None,
        soul_state_storage: BaseSoulStateStorage | None = None,
        memory_storage: BaseMemoryStorage | None = None,
        skill_storage: BaseSkillStorage | None = None,
        config: InjectionConfig | None = None,
    ):
        """初始化适配器

        如果不提供 storage，会使用默认的本地文件系统存储。
        """
        if storage is not None:
            self.storage = storage
        else:
            # 使用默认本地存储
            p = persona_storage or LocalPersonaStorage()
            s = soul_state_storage or LocalSoulStateStorage()
            m = memory_storage or LocalMemoryStorage()
            sk = skill_storage or LocalSkillStorage()
            self.storage = UnifiedSoulStorage(p, s, m, sk)

        self.config = config or InjectionConfig()
        self._today = datetime.now().strftime("%Y-%m-%d")

    def _build_persona_prompt(self) -> str:
        """构建人格提示词"""
        persona = self.storage.persona.read_persona_config()
        ai = persona.get("ai", {})
        master = persona.get("master", {})

        name = ai.get("name", "Agent")
        role = ai.get("role", "AI Assistant")
        personality = ai.get("personality", [])
        core_values = ai.get("core_values", [])
        interaction = ai.get("interaction_style", {})

        master_name = master.get("name", "用户")

        prompt_parts = [
            "# 你的身份\n",
            f"你是 {name}，{role}。\n",
        ]

        if personality:
            prompt_parts.append("\n## 你的性格\n")
            prompt_parts.append(", ".join(personality) + "\n")

        if core_values:
            prompt_parts.append("\n## 核心价值观\n")
            prompt_parts.append(", ".join(core_values) + "\n")

        if interaction:
            tone = interaction.get("tone", "neutral")
            language = interaction.get("language", "chinese")
            emoji = interaction.get("emoji_usage", "minimal")
            prompt_parts.append("\n## 交互风格\n")
            prompt_parts.append(f"- 语气: {tone}\n")
            prompt_parts.append(f"- 语言: {language}\n")
            prompt_parts.append(f"- 表情使用: {emoji}\n")

        if master_name:
            prompt_parts.append(f"\n当前用户是 {master_name}。\n")

        return "".join(prompt_parts)

    def _build_soul_state_prompt(self) -> str:
        """构建情绪状态提示"""
        state = self.storage.soul_state.read_soul_state()
        pleasure = state.get("pleasure", 0.3)
        arousal = state.get("arousal", 0.2)
        dominance = state.get("dominance", 0.3)

        # 根据 PAD 值转换为自然语言描述
        def describe_value(value: float) -> str:
            if value > 0.5:
                return "高"
            elif value > 0:
                return "中等偏"
            elif value > -0.5:
                return "中等偏"
            else:
                return "低"

        prompt = f"""
# 当前情绪状态 (PAD 模型)

- 愉悦度: {describe_value(pleasure)} ({pleasure:.2f})
- 唤醒度: {describe_value(arousal)} ({arousal:.2f})
- 支配度: {describe_value(dominance)} ({dominance:.2f})

请根据当前情绪状态调整你的回应方式。
"""
        return prompt.strip() + "\n"

    def _build_recent_memory_prompt(self) -> str:
        """构建最近记忆提示"""
        today = self._today
        content = self.storage.memory.read_daily_memory(today)
        if content is None or len(content.strip()) == 0:
            return ""

        prompt = f"""
# 今日记忆 ({today})

{content[:self.config.max_memory_tokens]}
"""
        return prompt.strip() + "\n"

    def _build_base_rules(self) -> str:
        """构建基础规则提示"""
        rules = ["SKILL", "soul_base", "memory_base"]
        all_content: list[str] = []

        for rule_name in rules:
            content = self.storage.skills.read_base_rule(rule_name)
            if content is not None and len(content.strip()) > 0:
                all_content.append(f"\n## {rule_name}\n{content}")

        if not all_content:
            return ""

        return "# 系统规则\n" + "".join(all_content) + "\n"

    def inject_context(
        self,
        messages: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        """注入 AgentSoul 上下文到消息列表

        Args:
            messages: 原始消息列表（OpenAI 格式）

        Returns:
            注入后的新消息列表
        """
        injected_parts: list[str] = []

        if self.config.include_persona:
            injected_parts.append(self._build_persona_prompt())

        if self.config.include_soul_state:
            injected_parts.append(self._build_soul_state_prompt())

        if self.config.include_recent_memory:
            memory_prompt = self._build_recent_memory_prompt()
            if memory_prompt:
                injected_parts.append(memory_prompt)

        if self.config.include_rules:
            rules_prompt = self._build_base_rules()
            if rules_prompt:
                injected_parts.append(rules_prompt)

        injected_system = "\n".join(injected_parts).strip()

        if not injected_system:
            return messages

        # 创建注入消息
        injected_message = {
            "role": "system",
            "content": injected_system
        }

        if self.config.system_prompt_position == "top":
            # 检查已有系统消息
            if messages and messages[0]["role"] == "system":
                # 合并到现有系统消息
                existing_system = messages[0]["content"]
                messages[0]["content"] = injected_system + "\n\n" + existing_system
                return messages
            else:
                # 在顶部插入
                return [injected_message] + messages
        else:
            # 在底部插入（最后一条系统消息）
            # 找到最后一个系统消息位置插入
            inserted = False
            for i in reversed(range(len(messages))):
                if messages[i]["role"] == "system":
                    messages.insert(i + 1, injected_message)
                    inserted = True
                    break
            if not inserted:
                messages.append(injected_message)
            return messages

    def save_daily_summary(
        self,
        conversation: list[dict[str, Any]],
        summary: str | None = None
    ) -> bool:
        """保存今日对话摘要到记忆

        Args:
            conversation: 完整对话
            summary: 可选的摘要，如果不提供会自动生成简单摘要

        Returns:
            是否保存成功
        """
        if summary is None:
            # 自动生成简单摘要
            summary = self._generate_simple_summary(conversation)

        today = self._today
        existing = self.storage.memory.read_daily_memory(today)
        if existing and len(existing.strip()) > 0:
            content = existing + "\n\n---\n" + summary
        else:
            content = summary

        return self.storage.memory.write_daily_memory(today, content)

    def _generate_simple_summary(self, conversation: list[dict[str, Any]]) -> str:
        """生成简单对话摘要"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        user_messages = [m["content"] for m in conversation if m["role"] == "user"]
        assistant_messages = [m["content"] for m in conversation if m["role"] == "assistant"]

        summary_parts = [
            f"## 对话 {now}",
            "",
            f"**用户输入数**: {len(user_messages)}",
            f"**助手回应数**: {len(assistant_messages)}",
            "",
        ]

        if user_messages:
            last_user = user_messages[-1]
            summary_parts.append(f"**最后话题**: {last_user[:200]}" + ("..." if len(last_user) > 200 else ""))

        return "\n".join(summary_parts)

    def get_version(self) -> SoulVersion:
        """获取当前灵魂版本"""
        return self.storage.persona.get_version()

    def __str__(self) -> str:
        version = self.get_version()
        persona = self.storage.persona.read_persona_config()
        ai_name = persona.get("ai", {}).get("name", "Unknown")
        return f"OpenAIInjectionAdapter(agent={ai_name}, version={version.version})"
