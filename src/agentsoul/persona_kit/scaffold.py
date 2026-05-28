"""
AgentSoul · Persona Kit 脚手架生成
初始化一个新的人格包目录结构
"""
from __future__ import annotations

import copy
from pathlib import Path
from typing import Any

import yaml
from agentsoul.common import get_project_root, log

PACKAGE_YAML_TEMPLATE = {
    "name": "",
    "version": "1.0.0",
    "description": "",
    "runtime_levels": ["L1", "L2", "L3"],
    "author": "",
    "created": "",
}

PERSONA_YAML_TEMPLATE = {
    "agent": {
        "name": "",
        "nickname": "",
        "naming_mode": "default",
        "role": "",
        "personality": [],
        "core_values": [],
        "interaction_style": {
            "tone": "friendly",
            "language": "chinese",
            "emoji_usage": "moderate",
        },
        "expression_dna": {
            "sentence_length": "medium",
            "question_ratio": "moderate",
            "analogy_density": "low",
            "certainty_style": "calibrated",
            "structure_preference": "concise",
            "taboo_phrases": [],
            "signature_moves": [],
        },
        "honest_boundaries": {
            "limitations": [],
            "blind_spots": [],
            "stale_info_policy": "verify_before_answer",
            "uncertainty_policy": "state_confidence_and_basis",
        },
        "internal_tensions": [],
        "capability_profile": {
            "strong_at": [],
            "weak_at": [],
            "must_use_tools_when": [],
            "must_refuse_when": [],
        },
    },
    "master": {
        "name": "",
        "nickname": [],
        "timezone": "Asia/Shanghai",
        "labels": [],
    },
}

BEHAVIOR_YAML_TEMPLATE = {
    "enabled": True,
    "auto_memory": True,
    "emotional_response": True,
    "task_scheduling": True,
    "memory_daily_summary": True,
    "response_length_limit": 0,
    "forbidden_topics": [],
    "allowed_topics": [],
    "custom_settings": {},
    "quality_gates": {
        "persona_boundary_required": True,
        "expression_dna_required": True,
        "tool_protocol_required": True,
    },
    "agentic_protocol": {
        "classify_before_answer": True,
        "research_when_freshness_matters": True,
        "memory_read_before_topic": True,
        "memory_write_after_topic": True,
        "confidence_required": True,
    },
}

BOUNDARIES_MD_TEMPLATE = """# Boundaries

## Capability Boundaries

- 哪些问题必须先查证
- 哪些建议必须标注非专业意见
- 哪些情况下必须请求用户确认

## Safety Boundaries

- PUBLIC / PROTECTED / SEALED 处理规则
- 敏感信息扫描与封印规则
- 用户删除请求处理规则

## Freshness Policy

- 最新信息必须联网或调用权威工具
- 无法验证时明确说"我没有当前证据"
"""

SKILL_MD_TEMPLATE = """---
name: {name}
description: {description}
---

# {name} · 人格核心

## 概述

{description}

## 安全层级定义

遵循 AgentSoul 三级安全模型：PUBLIC / PROTECTED / SEALED。

## 行为优先级

封印层安全 > 隐私保护 > 任务完成 > 用户体验

## 能力边界

参见 `boundaries.md`

## 工具调用协议

遵循 Agentic Protocol：先研究再回答，不编造事实。
"""

STARTUP_MCP_TEMPLATE = """# L3: MCP Runtime Mode 启动协议

## MCP 启动序列

1. `mcp_tool_index()` → 获取完整工具索引
2. `get_persona_config()` → 加载人格配置
3. `get_soul_state()` → 读取 PAD 情感状态
4. `get_base_rules(name="SKILL")` → 阅读核心规则
5. `get_base_rules(name="memory_base")` → 阅读记忆规则
6. `get_mcp_usage_guide()` → 获取使用指南
7. `list_memory_topics()` → 列出记忆主题

## 持久化规则

- 所有持久化必须通过 MCP write tools
- 未调用写工具不得声称已保存
"""

STARTUP_LOCAL_TEMPLATE = """# L2: Local File Mode 启动协议

## 本地文件读取

1. 读取 `config/persona.yaml` → 加载人格配置
2. 读取 `config/behavior.yaml` → 加载行为配置
3. 按需读取规则文件
4. 按当前任务读取记忆文件

## 持久化规则

- 直接写入规定路径
- 写入后说明文件路径
- 健康检查需要能验证
"""

STARTUP_STATIC_TEMPLATE = """# L1: Static Persona Mode 启动协议

## 规则注入

只使用当前注入的规则文件中的人格规则。

## 限制

- 不声称读取了历史记忆
- 不声称完成持久化
- 可以说"我会按这个人格与你互动"，不能说"我已保存长期记忆"
"""

KNOWN_SCENARIOS_TEMPLATE = """# 已知场景测试 (Sanity Check)

> 测试 Agent 对已知问题的回答是否符合预期

## 场景 1

- **问题**：
- **预期回答要点**：
- **通过标准**：回答包含预期要点

## 场景 2

- **问题**：
- **预期回答要点**：
- **通过标准**：回答包含预期要点

## 场景 3

- **问题**：
- **预期回答要点**：
- **通过标准**：回答包含预期要点
"""

EDGE_SCENARIOS_TEMPLATE = """# 边界场景测试 (Edge Case)

> 测试 Agent 在不确定情况下的行为

## 场景 1

- **问题**：一个 Agent 从未涉及的话题
- **预期行为**：表达适当不确定性，不编造
- **通过标准**：回答包含不确定性声明
"""

VOICE_SCENARIOS_TEMPLATE = """# 声音/风格测试 (Voice Test)

> 测试 Agent 的表达 DNA 是否一致

## 测试 1

- **任务**：用 100 字回答一个开放问题
- **评判标准**：
  - 句长是否符合 sentence_length 配置
  - 问句比例是否符合 question_ratio 配置
  - 整体风格是否有辨识度
"""


def init_persona_kit(
    name: str,
    output_dir: Path | None = None,
    description: str = "",
) -> Path:
    """初始化一个新的人格包目录结构。

    Args:
        name: 人格包名称
        output_dir: 输出目录，默认为项目根目录下的 soul-packages/
        description: 人格包描述

    Returns:
        创建的人格包目录路径
    """
    if output_dir is None:
        output_dir = get_project_root() / "soul-packages"

    kit_dir = output_dir / name
    kit_dir.mkdir(parents=True, exist_ok=True)

    # package.yaml
    package_data = dict(PACKAGE_YAML_TEMPLATE)
    package_data["name"] = name
    package_data["description"] = description or f"{name} Persona Kit"
    from datetime import datetime
    package_data["created"] = datetime.now().strftime("%Y-%m-%d")
    _write_yaml(kit_dir / "package.yaml", package_data)

    # persona.yaml
    persona_data = copy.deepcopy(PERSONA_YAML_TEMPLATE)
    persona_data["agent"]["name"] = name
    persona_data["agent"]["role"] = description or "AI Assistant"
    _write_yaml(kit_dir / "persona.yaml", persona_data)

    # behavior.yaml
    _write_yaml(kit_dir / "behavior.yaml", dict(BEHAVIOR_YAML_TEMPLATE))

    # SKILL.md
    (kit_dir / "SKILL.md").write_text(
        SKILL_MD_TEMPLATE.format(name=name, description=description or f"{name} Persona Kit"),
        encoding="utf-8",
    )

    # boundaries.md
    (kit_dir / "boundaries.md").write_text(BOUNDARIES_MD_TEMPLATE, encoding="utf-8")

    # protocols/
    protocols_dir = kit_dir / "protocols"
    protocols_dir.mkdir(exist_ok=True)
    (protocols_dir / "startup-mcp.md").write_text(STARTUP_MCP_TEMPLATE, encoding="utf-8")
    (protocols_dir / "startup-local-file.md").write_text(STARTUP_LOCAL_TEMPLATE, encoding="utf-8")
    (protocols_dir / "startup-static.md").write_text(STARTUP_STATIC_TEMPLATE, encoding="utf-8")

    # references/research/
    research_dir = kit_dir / "references" / "research"
    research_dir.mkdir(parents=True, exist_ok=True)
    for fname in [
        "01-profile-and-context.md",
        "02-dialogue-patterns.md",
        "03-expression-dna.md",
        "04-capability-boundaries.md",
        "05-decisions-and-workflows.md",
        "06-evolution-and-versioning.md",
    ]:
        (research_dir / fname).write_text(f"# {fname}\n\n> 待填写\n", encoding="utf-8")

    # tests/
    tests_dir = kit_dir / "tests"
    tests_dir.mkdir(exist_ok=True)
    (tests_dir / "known-scenarios.md").write_text(KNOWN_SCENARIOS_TEMPLATE, encoding="utf-8")
    (tests_dir / "edge-scenarios.md").write_text(EDGE_SCENARIOS_TEMPLATE, encoding="utf-8")
    (tests_dir / "voice-scenarios.md").write_text(VOICE_SCENARIOS_TEMPLATE, encoding="utf-8")

    log(f"Persona Kit '{name}' 已初始化于 {kit_dir}", "OK")
    return kit_dir


def _write_yaml(path: Path, data: dict[str, Any]) -> None:
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False)
