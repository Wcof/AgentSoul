"""
AgentSoul · 自动事实提取模块
从对话中自动抽取结构化事实，写入 EntityMemory

设计思路：
- FactExtractor: 使用 LLM 从对话中提取结构化事实
- FactPattern: 预定义的事实抽取模式（人/事/物/偏好/关系）
- FactConfidence: 事实置信度评估
- FactMerger: 新事实与已有事实的合并/冲突检测
"""
from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any

from common import get_project_root, log

# ============================================================================
# Data Structures
# ============================================================================

class FactType(Enum):
    """事实类型"""
    PERSONALITY = "personality"       # 性格特征
    PREFERENCE = "preference"         # 偏好/喜好
    HABIT = "habit"                   # 习惯/行为模式
    KNOWLEDGE = "knowledge"           # 知识/技能
    RELATIONSHIP = "relationship"     # 人际关系
    GOAL = "goal"                     # 目标/计划
    EVENT = "event"                   # 事件/经历
    OPINION = "opinion"               # 观点/态度
    OTHER = "other"                   # 其他


class FactConfidence(Enum):
    """事实置信度"""
    HIGH = "high"        # 明确陈述，多次确认
    MEDIUM = "medium"    # 间接推断，单次陈述
    LOW = "low"          # 推测，需要验证


@dataclass
class ExtractedFact:
    """提取的事实"""
    fact_id: str
    fact_type: FactType
    subject: str          # 主体（如 "用户", "我", "Alice"）
    attribute: str        # 属性（如 "喜欢的音乐", "职业", "性格"）
    value: str            # 值
    confidence: FactConfidence
    source_text: str      # 来源文本片段
    context: str          # 上下文
    extracted_at: str     # 提取时间
    requires_verification: bool = False  # 是否需要验证


@dataclass
class ExtractionResult:
    """提取结果"""
    facts: list[ExtractedFact]
    conversation_summary: str
    no_new_facts: bool
    processing_time_ms: float


# ============================================================================
# Fact Patterns
# ============================================================================

class FactPatterns:
    """预定义的事实抽取模式"""

    # 用户偏好模式
    PREFERENCE_PATTERNS = [
        {
            "type": FactType.PREFERENCE,
            "attribute": "喜欢的音乐",
            "triggers": ["喜欢.*音乐", "爱听.*", "偏好.*音乐", "音乐品味"],
        },
        {
            "type": FactType.PREFERENCE,
            "attribute": "喜欢的食物",
            "triggers": ["喜欢.*吃", "爱吃.*", "不喜欢.*", "讨厌.*", "口味偏好"],
        },
        {
            "type": FactType.PREFERENCE,
            "attribute": "喜欢的颜色",
            "triggers": ["喜欢.*颜色", "偏爱.*色"],
        },
        {
            "type": FactType.PREFERENCE,
            "attribute": "工作方式",
            "triggers": ["喜欢.*工作", "工作习惯", "工作方式", "偏好.*工作"],
        },
        {
            "type": FactType.PREFERENCE,
            "attribute": "沟通风格",
            "triggers": ["喜欢.*沟通", "沟通偏好", "不喜欢.*长篇"],
        },
    ]

    # 性格特征模式
    PERSONALITY_PATTERNS = [
        {
            "type": FactType.PERSONALITY,
            "attribute": "性格特征",
            "triggers": ["性格.*", "为人.*", "是个.*人", "比较.*", "性格上"],
        },
        {
            "type": FactType.PERSONALITY,
            "attribute": "内向/外向",
            "triggers": ["内向", "外向", "社恐", "社牛", "喜欢独处", "喜欢社交"],
        },
    ]

    # 知识与技能模式
    KNOWLEDGE_PATTERNS = [
        {
            "type": FactType.KNOWLEDGE,
            "attribute": "专业技能",
            "triggers": ["擅长.*", "精通.*", "会.*", "学过.*", "专业是.*"],
        },
        {
            "type": FactType.KNOWLEDGE,
            "attribute": "职业/身份",
            "triggers": ["我是.*", "工作是.*", "职业是.*", "职位是.*", "从事.*"],
        },
    ]

    # 习惯模式
    HABIT_PATTERNS = [
        {
            "type": FactType.HABIT,
            "attribute": "作息习惯",
            "triggers": ["早起", "熬夜", "作息", "睡觉时间", "起床时间"],
        },
        {
            "type": FactType.HABIT,
            "attribute": "运动习惯",
            "triggers": ["运动", "健身", "跑步", "锻炼"],
        },
    ]

    # 关系模式
    RELATIONSHIP_PATTERNS = [
        {
            "type": FactType.RELATIONSHIP,
            "attribute": "家庭成员",
            "triggers": ["家人", "父母", "兄弟姐妹", "配偶", "孩子"],
        },
        {
            "type": FactType.RELATIONSHIP,
            "attribute": "朋友/同事",
            "triggers": ["朋友", "同事", "队友", "搭档"],
        },
    ]

    # 目标模式
    GOAL_PATTERNS = [
        {
            "type": FactType.GOAL,
            "attribute": "短期目标",
            "triggers": ["想.*", "希望.*", "打算.*", "计划.*", "目标.*"],
        },
        {
            "type": FactType.GOAL,
            "attribute": "长期目标",
            "triggers": ["长远.*", "未来.*想", "理想是"],
        },
    ]

    @classmethod
    def get_all_patterns(cls) -> list[dict[str, Any]]:
        """获取所有模式"""
        return (
            cls.PREFERENCE_PATTERNS
            + cls.PERSONALITY_PATTERNS
            + cls.KNOWLEDGE_PATTERNS
            + cls.HABIT_PATTERNS
            + cls.RELATIONSHIP_PATTERNS
            + cls.GOAL_PATTERNS
        )


# ============================================================================
# Fact Extractor
# ============================================================================

class FactExtractor:
    """
    自动事实提取器

    支持两种模式：
    1. 规则匹配模式（无需 LLM，基于预定义模式）
    2. LLM 增强模式（使用 LLM 进行语义理解和抽取）
    """

    def __init__(
        self,
        llm_enabled: bool = False,
        llm_provider: str | None = None,
        llm_api_key: str | None = None,
        min_confidence: FactConfidence = FactConfidence.LOW,
    ):
        self.llm_enabled = llm_enabled
        self.llm_provider = llm_provider
        self.llm_api_key = llm_api_key
        self.min_confidence = min_confidence
        self._fact_counter = 0

    def _generate_fact_id(self) -> str:
        """生成唯一事实 ID"""
        self._fact_counter += 1
        return f"fact_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{self._fact_counter:04d}"

    def _determine_confidence(self, text: str, context: str) -> FactConfidence:
        """根据文本特征判断置信度"""
        # 高置信度：明确陈述、使用肯定词
        high_indicators = ["就是", "确实是", "一直是", "很清楚", "明确", "肯定"]
        if any(ind in text for ind in high_indicators):
            return FactConfidence.HIGH

        # 中置信度：间接推断、有上下文支持
        medium_indicators = ["感觉", "好像", "可能", "应该", "我觉得"]
        if any(ind in text for ind in medium_indicators):
            return FactConfidence.MEDIUM

        # 低置信度：推测、假设
        return FactConfidence.LOW

    def extract_by_rules(self, conversation_text: str) -> list[ExtractedFact]:
        """
        基于规则模式提取事实（无需 LLM）

        Args:
            conversation_text: 对话文本

        Returns:
            提取的事实列表
        """
        import re

        facts: list[ExtractedFact] = []
        patterns = FactPatterns.get_all_patterns()

        for pattern in patterns:
            for trigger in pattern["triggers"]:
                # 使用正则搜索
                regex_pattern = trigger.replace(".*", ".*?")
                matches = re.finditer(regex_pattern, conversation_text, re.IGNORECASE)

                for match in matches:
                    # 获取匹配上下文（前后各 50 字符）
                    start = max(0, match.start() - 50)
                    end = min(len(conversation_text), match.end() + 100)
                    context = conversation_text[start:end].strip()

                    # 提取值（尝试获取匹配后的内容）
                    value = match.group()
                    if len(value) > 50:
                        value = value[:50] + "..."

                    confidence = self._determine_confidence(value, context)

                    if confidence.value >= self.min_confidence.value:
                        facts.append(ExtractedFact(
                            fact_id=self._generate_fact_id(),
                            fact_type=pattern["type"],
                            subject="用户",
                            attribute=pattern["attribute"],
                            value=value,
                            confidence=confidence,
                            source_text=match.group(),
                            context=context,
                            extracted_at=datetime.now().isoformat(),
                            requires_verification=confidence == FactConfidence.LOW,
                        ))

        return facts

    async def extract_by_llm(self, conversation_text: str) -> ExtractionResult:
        """
        使用 LLM 提取事实（需要配置 LLM）

        Args:
            conversation_text: 对话文本

        Returns:
            ExtractionResult 包含提取的事实和摘要
        """
        import time
        start_time = time.time()

        if not self.llm_enabled:
            log("FactExtractor: LLM 未启用，降级到规则模式", "WARN")
            facts = self.extract_by_rules(conversation_text)
            return ExtractionResult(
                facts=facts,
                conversation_summary="",
                no_new_facts=len(facts) == 0,
                processing_time_ms=(time.time() - start_time) * 1000,
            )

        # LLM 提示词
        prompt = f"""请从以下对话中提取结构化事实信息。

对话内容：
{conversation_text[:2000]}

请按照以下格式输出 JSON：
{{
  "facts": [
    {{
      "type": "preference|personality|knowledge|habit|relationship|goal|event|opinion|other",
      "subject": "主体（如'用户'）",
      "attribute": "属性名",
      "value": "具体值",
      "confidence": "high|medium|low",
      "source_text": "原文片段",
      "requires_verification": true/false
    }}
  ],
  "summary": "对话摘要（1-2 句话）"
}}

注意：
- 只提取关于用户的事实，不要提取关于 AI 的事实
- 置信度评估：明确陈述=high，间接推断=medium，推测=low
- 需要验证的事实标记 requires_verification=true
- 不要重复提取相同信息
"""

        # 调用 LLM（这里用伪代码，实际实现需要集成具体 LLM）
        try:
            if self.llm_provider == "openai":
                response = await self._call_openai(prompt)
            elif self.llm_provider == "anthropic":
                response = await self._call_anthropic(prompt)
            else:
                # 降级到规则模式
                facts = self.extract_by_rules(conversation_text)
                return ExtractionResult(
                    facts=facts,
                    conversation_summary="",
                    no_new_facts=len(facts) == 0,
                    processing_time_ms=(time.time() - start_time) * 1000,
                )

            # 解析 LLM 响应
            result = json.loads(response)
            facts = []
            for f in result.get("facts", []):
                facts.append(ExtractedFact(
                    fact_id=self._generate_fact_id(),
                    fact_type=FactType(f["type"]),
                    subject=f.get("subject", "用户"),
                    attribute=f["attribute"],
                    value=f["value"],
                    confidence=FactConfidence(f.get("confidence", "medium")),
                    source_text=f.get("source_text", ""),
                    context=conversation_text[:500],
                    extracted_at=datetime.now().isoformat(),
                    requires_verification=f.get("requires_verification", False),
                ))

            return ExtractionResult(
                facts=facts,
                conversation_summary=result.get("summary", ""),
                no_new_facts=len(facts) == 0,
                processing_time_ms=(time.time() - start_time) * 1000,
            )

        except Exception as e:
            log(f"FactExtractor: LLM 调用失败: {e}", "ERROR")
            # 降级到规则模式
            facts = self.extract_by_rules(conversation_text)
            return ExtractionResult(
                facts=facts,
                conversation_summary="",
                no_new_facts=len(facts) == 0,
                processing_time_ms=(time.time() - start_time) * 1000,
            )

    async def _call_openai(self, prompt: str) -> str:
        """调用 OpenAI API"""
        try:
            from openai import AsyncOpenAI
            client = AsyncOpenAI(api_key=self.llm_api_key)
            response = await client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
            )
            return str(response.choices[0].message.content)
        except Exception as e:
            raise RuntimeError(f"OpenAI API call failed: {e}")

    async def _call_anthropic(self, prompt: str) -> str:
        """调用 Anthropic API"""
        try:
            import anthropic
            client = anthropic.AsyncAnthropic(api_key=self.llm_api_key)
            response = await client.messages.create(
                model="claude-3-haiku-20240307",
                max_tokens=1024,
                messages=[{"role": "user", "content": prompt}],
            )
            return str(response.content[0].text)
        except Exception as e:
            raise RuntimeError(f"Anthropic API call failed: {e}")

    def filter_facts(
        self,
        facts: list[ExtractedFact],
        fact_type: FactType | None = None,
        confidence: FactConfidence | None = None,
        requires_verification: bool | None = None,
    ) -> list[ExtractedFact]:
        """过滤事实列表"""
        result = facts

        if fact_type is not None:
            result = [f for f in result if f.fact_type == fact_type]

        if confidence is not None:
            result = [f for f in result if f.confidence.value >= confidence.value]

        if requires_verification is not None:
            result = [f for f in result if f.requires_verification == requires_verification]

        return result

    def get_fact_statistics(self, facts: list[ExtractedFact]) -> dict[str, Any]:
        """获取事实统计信息"""
        type_counts: dict[str, int] = {}
        confidence_counts: dict[str, int] = {}
        verification_needed = 0

        for fact in facts:
            type_counts[fact.fact_type.value] = type_counts.get(fact.fact_type.value, 0) + 1
            confidence_counts[fact.confidence.value] = confidence_counts.get(fact.confidence.value, 0) + 1
            if fact.requires_verification:
                verification_needed += 1

        return {
            "total_facts": len(facts),
            "by_type": type_counts,
            "by_confidence": confidence_counts,
            "verification_needed": verification_needed,
        }


# ============================================================================
# Fact Merger
# ============================================================================

class FactMerger:
    """
    事实合并器

    处理新事实与已有事实的冲突和合并：
    - 相同属性的新值 vs 旧值
    - 时间衰减：旧事实自动失效
    - 置信度加权：高置信度覆盖低置信度
    """

    def __init__(self, entity_memory_path: Path | None = None):
        self.entity_memory_path = entity_memory_path or get_project_root() / "data" / "entities"

    def check_conflict(
        self,
        new_fact: ExtractedFact,
        existing_facts: list[dict[str, Any]],
    ) -> dict[str, Any]:
        """
        检查新事实与已有事实是否存在冲突

        Args:
            new_fact: 新提取的事实
            existing_facts: 已有事实列表（来自 EntityMemory）

        Returns:
            冲突检测结果
        """
        conflicts = []
        duplicates = []

        for existing in existing_facts:
            if existing.get("attribute") == new_fact.attribute:
                existing_value = existing.get("value", "")
                new_value = new_fact.value

                # 检查是否重复（值相同或高度相似）
                if self._values_similar(existing_value, new_value):
                    duplicates.append({
                        "existing": existing,
                        "similarity": 1.0 if existing_value == new_value else 0.8,
                    })
                # 检查是否冲突（值不同）
                elif self._values_conflict(existing_value, new_value):
                    conflicts.append({
                        "existing": existing,
                        "reason": "value_changed",
                    })

        return {
            "has_conflicts": len(conflicts) > 0,
            "has_duplicates": len(duplicates) > 0,
            "conflicts": conflicts,
            "duplicates": duplicates,
            "recommendation": self._get_merge_recommendation(conflicts, duplicates, new_fact),
        }

    def _values_similar(self, v1: str, v2: str) -> bool:
        """检查两个值是否相似"""
        if v1 == v2:
            return True
        # 简单的包含检查
        return v1 in v2 or v2 in v1

    def _values_conflict(self, v1: str, v2: str) -> bool:
        """检查两个值是否冲突"""
        # 否定词检测
        negation_words = ["不", "没", "非", "否", "无", "never", "not", "no"]
        v1_has_negation = any(w in v1 for w in negation_words)
        v2_has_negation = any(w in v2 for w in negation_words)

        if v1_has_negation != v2_has_negation:
            return True

        return False

    def _get_merge_recommendation(
        self,
        conflicts: list[dict[str, Any]],
        duplicates: list[dict[str, Any]],
        new_fact: ExtractedFact,
    ) -> str:
        """获取合并建议"""
        if not conflicts and not duplicates:
            return "add_new"

        if duplicates:
            return "skip_duplicate"

        if conflicts:
            # 置信度比较
            existing_confidence = conflicts[0]["existing"].get("confidence", "low")
            if new_fact.confidence.value > existing_confidence:
                return "update_with_new"
            else:
                return "keep_existing_or_verify"

        return "add_new"

    def merge_fact(
        self,
        new_fact: ExtractedFact,
        existing_fact: dict[str, Any],
        strategy: str = "confidence_weighted",
    ) -> dict[str, Any]:
        """
        合并新事实与已有事实

        Args:
            new_fact: 新事实
            existing_fact: 已有事实
            strategy: 合并策略
                - "confidence_weighted": 按置信度加权
                - "newer_wins": 新值覆盖
                - "keep_both": 保留两者（添加历史）

        Returns:
            合并后的事实
        """
        merged = {
            "attribute": new_fact.attribute,
            "value": new_fact.value,
            "merged_at": datetime.now().isoformat(),
            "history": [existing_fact],
        }

        if strategy == "confidence_weighted":
            if new_fact.confidence.value > FactConfidence(existing_fact.get("confidence", "low")).value:
                merged["value"] = new_fact.value
                merged["confidence"] = new_fact.confidence.value
            else:
                merged["value"] = existing_fact.get("value", "")
                merged["confidence"] = existing_fact.get("confidence", "low")

        elif strategy == "newer_wins":
            merged["value"] = new_fact.value
            merged["confidence"] = new_fact.confidence.value

        elif strategy == "keep_both":
            merged["values"] = [
                existing_fact.get("value", ""),
                new_fact.value,
            ]
            merged["confidence"] = "mixed"

        return merged
