# 伴侣智能架构 / Companion Intelligence Architecture

## 状态

已接受 / Accepted

## 背景 / Context

AgentSoul v2 当前路线是 Desktop Body-first 的桌面伴侣。伴侣拥有 Tamagotchi 式生命体征和 PAD 情感引擎，但需要明确智能核心：会思考、会对话、会自主行动。参考 Hermes Agent（Nous Research 的开源 agent 框架）的成熟设计模式，我们决定通过**概念移植**（非直接集成）的方式为伴侣注入智能。

核心目标：伴侣从"被动宠物"升级为"有情感的自主实体" — 既能主动行动，又能深度对话。

## 决策 / Decision

### 集成形态：概念移植

不直接集成 Hermes 的 Python 代码，而是将其核心设计模式用 TypeScript 重新实现，融入现有架构。理由：AgentSoul 是 TypeScript/Tauri，Hermes 是 Python，跨语言运行时集成成本高；Hermes 的 `AIAgent` 有 60 个构造参数、12k LOC，直接嵌入引入巨大耦合。

### 交互模型：混合模式

伴侣同时具备两种交互模式：
- **自主模式** — 伴侣基于感知事件（时间触发、记忆触发）自主行动，主动与用户互动
- **对话模式** — 用户通过聊天窗口与伴侣深度对话，支持 tool calling

两种模式通过状态机协调，避免自主行动打断对话。

### Agent Mind model transport

Agent Mind 拥有模型传输边界，而不是把内置 Gateway 作为产品路径扩展：
- **Companion turn transport** — 服务 Desktop Body 的对话、主动提示和自主循环。
- **External tool transport** — 由 Extension Runtime adapter 按需装载，用于外部 AI coding 工具、MCP 或 provider switching。

两类 transport 可共享 credentials、provider profiles、metadata-only audit 和成本估算，但它们不要求用户进入 Channel-first Gateway 控制台。

### 架构分离

- **Desktop Body** — 桌面身体与交互外壳。负责形象、动画、气泡、小面板、右键菜单、聊天入口和默认审批呈现。
- **Agent Mind** — 决策核心。负责 interaction turn、自主循环、3 层 prompt 构建、输出策略、model transport 和上下文压缩。
- **Memory** — 长期状态核心。负责 Soul Document、Master Model、长期记忆、关系记忆、修正、遗忘和确认。
- **Extension Runtime** — 扩展入口。负责 extension manifest、capability registry、tool adapter 和 runtime events。

Companion 仍是用户的 AI 伙伴实体，但人格、记忆、身体和决策分别落在 Memory、Desktop Body 与 Agent Mind 边界内。

### 灵魂系统

伴侣的人格由两部分构成：
1. **伴侣身份**（I am）— 性格核心、说话风格、情感行为规则、成长里程碑
2. **主人模型**（I know）— 用户偏好、行为模式、情感特征、关系记忆、信任等级

主人模型通过自主学习建立（观察 → 假设 → 验证 → 固化），用户可在 Desktop Body 的小面板中查看、修正、确认或遗忘。

### 感知与行动

**感知系统**（P0）：
- 时间触发 — 定时 tick，类似 Hermes 的 cron
- 记忆触发 — 记忆关联到当前上下文时触发反思

**行动分层**：
- 内部行动（P0）— 情感更新、记忆巩固、反思
- 沟通行动（P0）— 主动提示、情感表达、记忆联想
- 工具行动（预留）— web 搜索、文件操作、MCP 调用，通过 Extension Runtime capability 接入

**核心机制**：混合驱动。轻量决策（情感表达、状态播报）走规则；重要决策（记忆反思、复杂对话）走 LLM。PAD 的 arousal 维度作为"注意力调节器" — 高 arousal = 更频繁的 LLM 调用。

### 状态机

用户存在状态（ACTIVE / PRESENT / IDLE / AWAY / OFFLINE）× 伴侣模式（AUTONOMOUS / CONVERSING / THINKING / QUEUING / SLEEPING / INTRUDING）× 输出策略 × 事件优先级（LOW / MEDIUM / HIGH / CRITICAL）共同决定伴侣的行为。对话中自主循环继续感知但暂停输出；对话结束有冷却期；仅 HIGH+ 事件可打断对话。

### 分阶段实施

| 阶段 | 目标 | 核心交付 |
|------|------|----------|
| Phase 1 | 伴侣获得大脑 | Agent Mind + 3 层 prompt + Soul Document + Desktop Body 聊天入口 + interaction turn |
| Phase 2 | 伴侣获得感知 | 自主循环 + 状态机 + 内部/沟通行动 + Master Model 学习 |
| Phase 3 | 伴侣获得记忆 | Memory + Context Compression + 记忆塑造人格 |
| Phase 4 | 伴侣获得扩展能力 | Extension Runtime + capability registry + tool adapter + 工具行动层 |

## 理由 / Rationale

- 概念移植避免跨语言耦合，同时吸收 Hermes 经过实战验证的设计模式（3 层 prompt、iteration budget、context compression、skill curator）
- 混合模式是"升华"的真正含义 — 宠物不只是加了聊天框，而是有了自主性
- Agent Mind model transport 支持伴侣直调；外部工具集成由 Extension Runtime adapter 承担，避免把 Gateway 管理面做成内置产品路径
- 灵魂系统（身份 + 主人模型）是区别于通用 agent 的核心差异化
- 分阶段实施确保每阶段有可交付成果，降低风险

## 后果 / Consequences

- Agent Mind 需要实现 interaction turn、自主循环、model transport、输出策略和上下文压缩
- Memory 需要实现 Soul Document、Master Model、长期记忆、关系记忆、修正、遗忘和确认
- Desktop Body 需要新增聊天入口、主动提示、小面板和内联审批呈现
- 需要实现用户存在状态检测（鼠标/键盘活动、窗口焦点）
- 主人模型的自动学习需要从对话和事件中提取模式，这是一个持续迭代的能力
- 后续阶段需要移植 Hermes 的 Memory Provider 接口与 Context Compression；SKILL.md 或 MCP 类能力通过 Extension Runtime 装载
