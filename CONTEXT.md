# AgentSoul — Domain Glossary

## 核心概念 / Core Concepts

- **Desktop Body** — AgentSoul 的唯一主界面；Agent 在桌面上的身体和交互外壳，负责桌面窗口、形象、动画、气泡、右键菜单、小面板和未来功能入口。
- **Agent Mind** — AgentSoul 的决策核心，负责 interaction turn、Hermes-style prompt layers、自主循环和输出策略；不直接渲染 UI。
- **Memory** — AgentSoul 的长期状态来源，负责 Soul Document、Master Model、长期记忆、关系记忆、修正、遗忘和确认。
- **Extension Runtime** — AgentSoul 的唯一扩展入口，负责 extension manifest、capability registry、tool adapter 和 runtime events。
- **Companion** — 用户的 AI 伙伴实体，拥有外观、人格、情感状态、记忆和成长系统。
- **Soul** — Companion 的人格内核，包含 PAD 情感模型、基线性格、记忆层。
- **PAD** — Pleasure-Arousal-Dominance 三维情感模型，驱动 Companion 的情绪表达。
- **Pet Appearance** — Companion 的视觉外形（kind + skin + outfit），独立于人格。
- **Pet Kind** — 外形类别：`slime`（粘液怪）、`cat`（猫咪）、`custom`（自定义）。
- **Pet Skin** — 外形皮肤，属于特定 kind（如 `default` 属于 `slime`，`tabby` 属于 `cat`）。

## Legacy Control Modules / 旧控制台模块

- **Legacy Gateway** — 旧 Control Center 的代理/渠道管理实现。它不再是 AgentSoul Desktop 的产品核心；后续如需模型路由能力，应通过 Agent Mind 的 model transport 或 Extension Runtime capability 重新装载。
- **Legacy Channel** — 旧 Gateway 中的 Provider 连接配置。它不再作为 Desktop Body 的用户可见主配置对象。
- **Legacy Costs** — 旧成本统计 Area。后续如需用量观察，应作为 Extension Runtime 能力或 developer inspector 的可选面板进入。
- **Legacy Sessions** — 旧会话搜索/恢复 Area。后续如需恢复外部工具会话，应由独立 extension 提供。
- **Legacy Skills / MCP / Prompts** — 旧技能、MCP、Prompt 管理 Area。后续能力统一通过 Extension Runtime manifest、capability registry 和 tool adapter 装载。
- **Legacy Safety** — 旧审批与风险 Area。Desktop Body 默认路径不保留页面化安全控制台；高风险操作应在 Desktop Body 中以气泡、小面板或 extension inspector 呈现。
- **Legacy Conversations** — 旧会话仪表盘 Area。后续如需对话历史，应由 Memory 或 Extension Runtime 提供小面板入口。
- **Legacy Settings Full** — 旧完整设置页。Desktop Body 默认只保留必要偏好，其他配置通过嵌入式面板或 extension settings 进入。
- **Authoritative Store（旧）** — 旧 Control Center 业务实体的 SQLite 真实来源。新架构只把 Memory 视为长期状态来源，旧 store 仅作为待迁移遗留数据源。
- **External Tool Adapter** — 将成熟第三方工具作为原样运行的外部能力接入 AgentSoul 的适配层。Adapter 负责发现、安装提示、调用、状态读取和错误映射，不 fork、不修改第三方源码，除非安全、隐私、许可或稳定性要求必须这样做。
- **External Tool Surface** — 未来由 Extension Runtime 提供的外部工具入口，而不是旧 Control Center 的页面化管理面。

## 设置 / Settings

- **Growth Profile** — Companion 成长参数配置（XP倍数、能量消耗、疲劳阈值等）。
- **Persona Template** — 预设的人格模板（如 Friendly、Professional），包含角色、性格标签、描述。
- **Companion Customization** — Companion 外观自定义（kind + skin + outfit + displayName）。
- **Local-first** — 数据默认存储在本地，不需要云端登录。

## Current Architecture / 当前架构

- **Desktop Body-first** — 当前产品路径只有一个默认桌面身体界面。所有日常交互从桌面形象、气泡、小面板、右键菜单和嵌入式入口展开，不再以 Control Center 作为主界面。
- **Agent Mind owns decisions** — 交互回合、自主循环、prompt layers、输出策略和模型传输由 Agent Mind 负责。它可以调用模型或工具，但不把旧 Gateway 作为内置产品路径。
- **Memory owns long-term state** — Soul Document、Master Model、长期记忆、关系记忆和用户修正属于 Memory。旧 sessions、conversations、authoritative store 只作为历史数据/实现背景，不是当前领域主对象。
- **Extension Runtime owns expansion** — 外部工具、MCP、prompt、skill、usage 或 inspector 类能力都通过 Extension Runtime 的 manifest、capability registry、adapter 和 runtime events 装载，不再通过内置 Gateway/Skills/Sessions/Safety Area 扩展。
- **Inline safety surfaces** — 高风险动作仍必须显式审批，但默认呈现为 Desktop Body 的气泡、小面板、通知或 extension inspector，而不是页面化 Safety 控制台。

## Control Center Legacy

- **Control Center（旧架构）** — 已不再作为 AgentSoul Desktop 的主产品架构。后续 Desktop 主产品以 Desktop Body 为唯一主界面，旧 Control Center 和 Area registry 从主路径删除。
- **Legacy Shell** — 旧桌面端控制台外壳，包含侧边栏 + 主内容区。它不再由默认 `main.ts` 启动。
- **Legacy Area** — 旧 Control Center 中的页面功能区：companion、gateway、costs、sessions、conversations、skills、safety、settings、settings-full、sessions-mgr、mcp、prompts。它们是待删除/待迁移实现，不是新功能扩展方式。
- **Legacy AreaContext** — 旧 Area 的标准化上下文接口。新扩展不得继续以 AreaContext 接入，应使用 Extension Runtime。

## 伴侣智能 / Companion Intelligence

- **Soul Document** — 伴侣的人格载体，包含两部分：伴侣身份（性格、说话风格、情感行为规则、成长里程碑）和主人模型（用户偏好、行为模式、情感特征、关系记忆）。
- **Master Model** — 伴侣对主人的认知模型，通过自主学习建立（观察 → 假设 → 验证 → 固化）。用户后续通过 Desktop Body 的小面板查看和修正。
- **3-Layer Prompt** — 借鉴 Hermes 的 3 层 system prompt 架构：稳定层（灵魂文档）、上下文层（PAD + 体征）、易失层（记忆 + 会话上下文）。
- **Agent Loop** — 伴侣的核心执行循环，混合驱动：轻量决策走规则，重要决策走 LLM 调用。位于 Agent Mind。
- **Autonomous Loop** — 伴侣的自主行为循环，基于感知事件（时间触发、记忆触发）自主执行内部行动和沟通行动。
- **Hybrid Drive** — 混合驱动机制。PAD 的 arousal 维度作为"注意力调节器"，高 arousal = 更频繁的 LLM 调用，低 arousal = 规则驱动。
- **User Presence** — 用户存在状态：ACTIVE（正在交互）/ PRESENT（在电脑前）/ IDLE（短暂离开）/ AWAY（长时间离开）/ OFFLINE（应用关闭）。
- **Companion Mode** — 伴侣运行模式：AUTONOMOUS（自主）/ CONVERSING（对话）/ THINKING（思考中）/ QUEUING（等待输出）/ SLEEPING（睡眠）/ INTRUDING（主动打断）。
- **Output Strategy** — 根据 User Presence × Companion Mode 决定输出方式：气泡提示、静默记录、强制通知等。
- **Event Priority** — 感知事件的紧迫度：LOW（常规 tick）/ MEDIUM（记忆关联）/ HIGH（情感漂移严重）/ CRITICAL（安全事件）。

## 包结构（Desktop Body-first）

- **Companion（核心包）** — Companion 是项目的核心实体。PAD 情感、健康检查、人格模板、语言都是 Companion 的属性，合并进 `@agentsoul/companion`。新增职责：灵魂文档、3 层 prompt 构建、主人模型。
- **Agent Mind** — 桌面端决策核心，负责 prompt layers、interaction turn、autonomy loop、output strategy、model transport。
- **Memory** — 分层记忆 + 实体记忆 + 语义记忆的统一包（memory + entity + semantic 合并）。
- **Persistence** — 瘦身为数据库初始化、迁移工具和通用审计 Repository。
- **Extension Runtime** — 后续能力装载口，负责 extension manifest、capability registry、tool adapter 和 runtime events。
