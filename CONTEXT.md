# AgentSoul — Domain Glossary

## 核心概念 / Core Concepts

- **Companion** — 用户的 AI 伙伴实体，拥有外观、人格、情感状态、记忆和成长系统。
- **Soul** — Companion 的人格内核，包含 PAD 情感模型、基线性格、记忆层。
- **PAD** — Pleasure-Arousal-Dominance 三维情感模型，驱动 Companion 的情绪表达。
- **Pet Appearance** — Companion 的视觉外形（kind + skin + outfit），独立于人格。
- **Pet Kind** — 外形类别：`slime`（粘液怪）、`cat`（猫咪）、`custom`（自定义）。
- **Pet Skin** — 外形皮肤，属于特定 kind（如 `default` 属于 `slime`，`tabby` 属于 `cat`）。

## Gateway 与渠道 / Gateway & Channels

- **Gateway** — 本地代理服务器，负责将请求路由到最优 Provider。
- **Channel** — Gateway 中的一个 Provider 连接通道，有 API 类型、baseUrl、密钥、优先级。
- **Channel First** — Control Center 中 Gateway 的唯一一等配置对象是 `Channel`；`Provider` 仅表示 Channel 指向的上游服务属性（协议、厂商、baseUrl、鉴权方式），不是并列的独立管理系统。
- **Failover Sequence** — 按优先级排序的渠道列表，故障时自动切换到下一渠道。
- **Circuit Breaker** — 渠道的断路器状态（`closed` / `open` / `half_open`），防止故障扩散。
- **Channel Store** — 持久化渠道配置的存储层（SQLite）。
- **Cost Tracker** — 跟踪每个渠道的请求量、Token 用量、估算成本。
- **Authoritative Store** — Control Center 业务实体的唯一真实来源；在桌面端默认是本地 SQLite。`localStorage` 仅用于界面偏好，不能作为业务实体的持久化来源。
- **Local Control Plane** — Control Center 优先实现本地闭环能力：本地存储、本地状态恢复、本地 Gateway 检查、本地 MCP 生命周期、本地审批与信任授权持久化。外部依赖（如远程同步、WebDAV、外链导入）不是一阶段必需能力。
- **Gateway Control Surface** — Gateway 继续作为本地运行服务存在；Control Center 是它的本地管理前端，通过本地 API / Tauri 命令读写同一套真实状态，而不是在前端重写一套并行业务逻辑。

## 成本与审计 / Costs & Audit

- **Estimated Cost** — 本地根据审计记录计算的成本（非服务商报告）。
- **Provider Usage** — 服务商独立报告的用量（如果可用）。
- **Provider Mix / Model Mix** — 请求在不同服务商/模型间的分布比例。

## 安全与审批 / Safety & Approval

- **Approval Request** — 高风险操作需要用户确认的审批请求。
- **Risk Notice** — 安全策略外的异常行为通知。
- **Scoped Trust Grant** — 对特定操作类型的临时信任授权，有过期时间。
- **Action Risk Class** — 操作风险等级：`safe` / `sensitive` / `high-risk` / `critical`。

## 技能管理 / Skills

- **Skill Pack** — 可安装的功能扩展包，包含规则文件。
- **Project Activation** — 在特定项目中启用/禁用技能包。
- **Workspace Rule Deployment** — 将技能包的规则文件部署到工作区（符号链接或复制）。

## 会话管理 / Sessions

- **Work Session** — 可搜索/可恢复的工作会话记录。
- **Session Launcher** — 安全门控的会话启动器。

## 设置 / Settings

- **Growth Profile** — Companion 成长参数配置（XP倍数、能量消耗、疲劳阈值等）。
- **Persona Template** — 预设的人格模板（如 Friendly、Professional），包含角色、性格标签、描述。
- **Companion Customization** — Companion 外观自定义（kind + skin + outfit + displayName）。
- **Local-first** — 数据默认存储在本地，不需要云端登录。

## Control Center

- **Shell** — 桌面端主界面外壳，包含侧边栏 + 主内容区。
- **Dock Position** — 桌面伴侣窗口吸附位置（left / right / top / bottom），由拖拽自动触发，无手动切换按钮。
- **Area** — Control Center 中的功能区域，共 12 个：companion、gateway、costs、sessions、conversations、skills、safety、settings、settings-full、sessions-mgr、mcp、prompts。每个 Area 目录包含 render.ts、bind.ts、types.ts、style.css、CLAUDE.md。
- **AreaContext** — Area 的标准化上下文接口，包含 target、snapshot、controller、controlClient、t()。所有 Area 的 bind 函数通过此接口与外部交互。
- **Area 组装** — main.ts 中使用 const 数组组装所有 Area。新增 Area = 创建目录 + 数组加一行。

## 伴侣智能 / Companion Intelligence

- **Soul Document** — 伴侣的人格载体，包含两部分：伴侣身份（性格、说话风格、情感行为规则、成长里程碑）和主人模型（用户偏好、行为模式、情感特征、关系记忆）。
- **Master Model** — 伴侣对主人的认知模型，通过自主学习建立（观察 → 假设 → 验证 → 固化）。用户可在 Control Center 查看和修正。
- **3-Layer Prompt** — 借鉴 Hermes 的 3 层 system prompt 架构：稳定层（灵魂文档）、上下文层（PAD + 体征）、易失层（记忆 + 会话上下文）。
- **Agent Loop** — 伴侣的核心执行循环，混合驱动：轻量决策走规则，重要决策走 LLM 调用。位于 Gateway 进程内。
- **Autonomous Loop** — 伴侣的自主行为循环，基于感知事件（时间触发、记忆触发）自主执行内部行动和沟通行动。
- **Hybrid Drive** — 混合驱动机制。PAD 的 arousal 维度作为"注意力调节器"，高 arousal = 更频繁的 LLM 调用，低 arousal = 规则驱动。
- **User Presence** — 用户存在状态：ACTIVE（正在交互）/ PRESENT（在电脑前）/ IDLE（短暂离开）/ AWAY（长时间离开）/ OFFLINE（应用关闭）。
- **Companion Mode** — 伴侣运行模式：AUTONOMOUS（自主）/ CONVERSING（对话）/ THINKING（思考中）/ QUEUING（等待输出）/ SLEEPING（睡眠）/ INTRUDING（主动打断）。
- **Output Strategy** — 根据 User Presence × Companion Mode 决定输出方式：气泡提示、静默记录、强制通知等。
- **Event Priority** — 感知事件的紧迫度：LOW（常规 tick）/ MEDIUM（记忆关联）/ HIGH（情感漂移严重）/ CRITICAL（安全事件）。

## Gateway 双模式 / Gateway Dual Mode

- **Proxy Mode** — Gateway 的现有模式，翻译请求后返回翻译结果，客户端自行调用 LLM。端点：`/v1/chat/completions` 等。服务于 Claude CLI、Cursor 等外部工具。
- **Direct Mode** — Gateway 的新增模式，翻译请求后直接调用 LLM 并返回结果。端点：`/v1/direct/chat/completions` 等。服务于伴侣的自主循环和对话模式。
- **直调端点 / Direct Endpoint** — Direct Mode 使用的 HTTP 端点，与代理模式端点分离，避免歧义。

## 包结构（架构深化后）

- **Companion（核心包）** — Companion 是项目的核心实体。PAD 情感、健康检查、人格模板、语言都是 Companion 的属性，合并进 `@agentsoul/companion`。新增职责：灵魂文档、3 层 prompt 构建、主人模型。
- **Provider** — Provider Profile + 凭据存储（security 合并进 provider，因为凭据是 Provider 认证的一部分）。
- **Memory** — 分层记忆 + 实体记忆 + 语义记忆的统一包（memory + entity + semantic 合并）。
- **Persistence** — 瘦身为数据库初始化、迁移工具和通用审计 Repository。
- **Gateway 子模块** — gateway-server（HTTP 壳）、gateway-channels（频道路由）、gateway-cost（成本追踪）、gateway-audit（审计记录）。新增职责：agent loop、自主循环、直调 LLM。
