"""
AgentSoul · Google Gemini 链路注入适配器
=================================

提供 Google Gemini SDK 兼容的注入方式，将 AgentSoul 人格/记忆/技能注入到 Gemini 对话。
支持：
- 自动系统提示注入
- 记忆上下文自动插入
- PAD 情绪状态感知响应调整
- 支持 Gemini 原生 system_instruction 特性
"""

from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
import json
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from common import get_project_root, log
from src.abstract import (
    UnifiedSoulStorage,
    BasePersonaStorage,
    BaseSoulStateStorage,
    BaseMemoryStorage,
    BaseSkillStorage,
    SoulVersion,
)
from src.storage.local import (
    LocalPersonaStorage,
    LocalSoulStateStorage,
    LocalMemoryStorage,
    LocalSkillStorage,
)


@dataclass
class GeminiMessage:
    """Google Gemini 消息格式"""
    role: str  # "user" or "model"
    parts: List[Dict[str, Any]]  # [{text: "content"}]
    name: Optional[str] = None


@dataclass
class GeminiInjectionConfig:
    """注入配置"""
    include_persona: bool = True          # 是否注入人格配置
    include_soul_state: bool = True       # 是否注入情绪状态
    include_recent_memory: bool = True    # 是否注入最近记忆
    include_rules: bool = True            # 是否注入基础规则
    max_memory_tokens: int = 1000         # 记忆最大 token 数
    use_system_instruction: bool = True   # 是否使用 Gemini 的 system_instruction 特性


class GeminiInjectionAdapter:
    """Google Gemini 链路注入适配器

    用法：
        from google import generativeai as genai
        from agentsoul.adapters.gemini import GeminiInjectionAdapter

        genai.configure(api_key=os.environ["GOOGLE_API_KEY"])
        adapter = GeminiInjectionAdapter()

        # 在调用 Gemini 之前注入上下文
        result = adapter.inject_context([
            {"role": "user", "parts": [{"text": "Hello!"}]}
        ])

        # 使用 system_instruction 创建模型
        if "system_instruction" in result:
            model = genai.GenerativeModel(
                "gemini-1.5-pro",
                system_instruction=result["system_instruction"]
            )
            response = model.generate_content(result["messages"])
        else:
            model = genai.GenerativeModel("gemini-1.5-pro")
            response = model.generate_content(result["messages"])

        # 对话结束后保存记忆
        adapter.save_daily_summary(result["messages"], response.text)
    """

    def __init__(
        self,
        storage: Optional[UnifiedSoulStorage] = None,
        persona_storage: Optional[BasePersonaStorage] = None,
        soul_state_storage: Optional[BaseSoulStateStorage] = None,
        memory_storage: Optional[BaseMemoryStorage] = None,
        skill_storage: Optional[BaseSkillStorage] = None,
        config: Optional[GeminiInjectionConfig] = None,
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

        self.config = config or GeminiInjectionConfig()
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
            f"# 你的身份\n",
            f"你是 {name}，{role}。\n",
        ]

        if personality:
            prompt_parts.append(f"\n## 你的性格\n")
            prompt_parts.append(", ".join(personality) + "\n")

        if core_values:
            prompt_parts.append(f"\n## 核心价值观\n")
            prompt_parts.append(", ".join(core_values) + "\n")

        if interaction:
            tone = interaction.get("tone", "neutral")
            language = interaction.get("language", "chinese")
            emoji = interaction.get("emoji_usage", "minimal")
            prompt_parts.append(f"\n## 交互风格\n")
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
        all_content: List[str] = []

        for rule_name in rules:
            content = self.storage.skills.read_base_rule(rule_name)
            if content is not None and len(content.strip()) > 0:
                all_content.append(f"\n## {rule_name}\n{content}")

        if not all_content:
            return ""

        return "# 系统规则\n" + "".join(all_content) + "\n"

    def inject_context(
        self,
        messages: List[Dict[str, Any]],
        existing_system_instruction: Optional[str] = None,
        use_system_instruction: Optional[bool] = None,
    ) -> Dict[str, Any]:
        """注入 AgentSoul 上下文到消息列表

        Args:
            messages: 原始消息列表（Gemini 格式）
            existing_system_instruction: 已有的系统提示（如果有）

        Returns:
            dict 包含:
            - messages: 处理后的消息列表
            - system_instruction: 合并后的系统提示（当 use_system_instruction=True 时）
        """
        injected_parts: List[str] = []

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
            return {"messages": messages}

        # 如果使用 Gemini 的 system_instruction 特性，合并后返回
        use_sys_inst = use_system_instruction if use_system_instruction is not None else self.config.use_system_instruction
        if use_sys_inst:
            if existing_system_instruction:
                full_system = injected_system + "\n\n" + existing_system_instruction
            else:
                full_system = injected_system
            return {
                "messages": messages,
                "system_instruction": full_system,
            }
        else:
            # 不使用 system_instruction，作为 system 角色消息插入到消息列表
            injected_message = {
                "role": "system",
                "parts": [{"text": injected_system}]
            }

            # 检查已有 system 消息
            inserted = False
            for i in range(len(messages)):
                if messages[i]["role"] == "system":
                    # 合并到已有 system 消息
                    existing_text = messages[i]["parts"][0]["text"]
                    messages[i]["parts"][0]["text"] = injected_system + "\n\n" + existing_text
                    inserted = True
                    break

            if not inserted:
                # 在顶部插入
                messages.insert(0, injected_message)

            return {"messages": messages}

    def inject_context_to_list(
        self,
        messages: List[Dict[str, Any]],
    ) -> List[Dict[str, Any]]:
        """简化接口：直接返回注入后的消息列表（不使用 system_instruction）

        用于兼容旧版本 Gemini API，直接将系统提示作为 system 角色插入消息列表。
        """
        result = self.inject_context(messages, use_system_instruction=False)
        return result["messages"]

    def save_daily_summary(
        self,
        conversation: List[Dict[str, Any]],
        response_text: str,
        summary: Optional[str] = None
    ) -> bool:
        """保存今日对话摘要到记忆

        Args:
            conversation: 完整对话
            response_text: Gemini 回应文本（用于摘要统计）
            summary: 可选的摘要，如果不提供会自动生成简单摘要

        Returns:
            是否保存成功
        """
        if summary is None:
            # 自动生成简单摘要
            summary = self._generate_simple_summary(conversation, response_text)

        today = self._today
        existing = self.storage.memory.read_daily_memory(today)
        if existing and len(existing.strip()) > 0:
            content = existing + "\n\n---\n" + summary
        else:
            content = summary

        return self.storage.memory.write_daily_memory(today, content)

    def _generate_simple_summary(self, conversation: List[Dict[str, Any]], response_text: str) -> str:
        """生成简单对话摘要"""
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        user_messages = []
        assistant_messages = []

        for msg in conversation:
            if msg["role"] == "user":
                text = msg["parts"][0].get("text", "")
                if text:
                    user_messages.append(text)
            elif msg["role"] == "model" or msg["role"] == "assistant":
                text = msg["parts"][0].get("text", "")
                if text:
                    assistant_messages.append(text)

        # 添加当前回应
        if response_text:
            assistant_messages.append(response_text)

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
        return f"GeminiInjectionAdapter(agent={ai_name}, version={version.version})"
