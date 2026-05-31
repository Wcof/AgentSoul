# PRD：伴侣获得大脑 — Phase 1 伴侣智能对话

> 参考：[ADR-0011 伴侣智能架构](../adr/0011-companion-intelligence-architecture.md) | [Phase 1 技术方案](./phase1-companion-brain.md)

## Problem Statement

AgentSoul 的伴侣是一个 Tamagotchi 式的虚拟宠物 — 有生命体征、有 PAD 情感状态、有成长系统，但没有智能。它不会说话、不会思考、不会自主行动。用户只能通过 feed/play/pet/sleep 四个按钮与它交互，无法进行真正的对话。

伴侣有灵魂（PAD 情感引擎）和身体（桌面浮窗 UI），但没有大脑。这使得伴侣始终停留在"玩具"层面，无法成为真正的 AI 伙伴。

## Solution

为伴侣注入智能核心 — 一个基于 LLM 的对话能力，带有情感调制的人格。用户可以在伴侣的聊天窗口中直接对话，伴侣的回答受 PAD 情感状态调制，有身份感（知道自己是谁、用户是谁、关系是什么）。

对话通过 Gateway 新增的"直调端点"路由，Gateway 从纯协议翻译器升级为同时支持代理模式（现有，服务外部工具）和直调模式（新增，服务伴侣自身）。

架构上，Companion 包负责人格与情感（灵魂文档、3 层 prompt 构建），Gateway 包负责执行与调度（agent loop、直调 LLM）。两个包通过清晰的接口协作。

## User Stories

1. As a 伴侣用户, I want 在桌面伴侣浮窗中双击打开聊天窗口, so that 我可以和伴侣进行文字对话
2. As a 伴侣用户, I want 在聊天窗口中输入消息并发送, so that 我可以向伴侣提问或闲聊
3. As a 伴侣用户, I want 看到伴侣的回复带有情感色彩, so that 对话感觉更真实、更有温度
4. As a 伴侣用户, I want 伴侣在高愉悦度时语气温暖积极, so that 我能感受到它的情绪状态
5. As a 伴侣用户, I want 伴侣在低支配度时语气温逊征求意见, so that 对话不会显得居高临下
6. As a 伴侣用户, I want 伴侣根据亲密度调整称呼方式, so that 低亲密度时礼貌、高亲密度时亲密
7. As a 伴侣用户, I want 伴侣知道自己是谁（名字、性格、关系定位）, so that 对话有一致的身份感
8. As a 伴侣用户, I want 伴侣知道我是谁（称呼、偏好）, so that 对话是个性化的而非泛化的
9. As a 伴侣用户, I want 对话历史被保存, so that 我可以回顾之前的对话
10. As a 伴侣用户, I want 对话的 token 用量被记录到成本追踪, so that 我了解 LLM 调用的开销
11. As a 伴侣用户, I want 对话产生的 token 量转化为伴侣 XP, so that 对话也能促进伴侣成长
12. As a 伴侣用户, I want 对话消耗伴侣能量, so that 成长系统保持一致性（高活跃 = 高消耗）
13. As a 伴侣用户, I want 聊天窗口半透明毛玻璃风格, so that 视觉上与桌面伴侣融为一体
14. As a 伴侣用户, I want 按 Enter 发送消息、Shift+Enter 换行, so that 操作符合直觉
15. As a 伴侣用户, I want 伴侣回复时显示当前情感状态标记, so that 我知道它的情绪变化
16. As a 伴侣用户, I want 聊天窗口可拖动和关闭, so that 不遮挡其他工作内容
17. As a 伴侣用户, I want 对话通过 Gateway 直调端点路由, so that 成本追踪和审计日志统一管理
18. As a 伴侣用户, I want 直调端点和代理端点互不干扰, so that Claude CLI 等外部工具继续正常工作
19. As a 伴侣用户, I want 对话支持 tool calling 架构, so that 后续阶段可以扩展工具能力
20. As a 伴侣用户, I want agent loop 有迭代次数限制, so that 不会因为 tool call 循环导致无限调用
21. As a 伴侣用户, I want 灵魂文档可配置, so that 我可以自定义伴侣的人格
22. As a 伴侣用户, I want 伴侣在高唤醒度时回复更警觉详细, so that 情感状态真实影响行为
23. As a 伴侣用户, I want 伴侣在成长阶段变化时人格有明显差异, so that 升级有成就感
24. As a 伴侣用户, I want 对话请求失败时有友好错误提示, so that 体验不会因网络问题崩溃
25. As a 伴侣用户, I want 对话使用 Gateway 中配置的活跃 provider profile, so that 不需要单独配置 LLM 提供商

## Implementation Decisions

### 模块 1：SoulModule — 灵魂文档

**接口**：
- `getDefaultSoul(companion, masterName) → SoulDocument` — 生成默认灵魂文档
- `buildSoulPrompt(soul, intimacyLevel) → string` — 将灵魂文档转为 prompt 文本

**数据结构 SoulDocument**：
- `identity`：name、personality、relationship
- `voice`：style、addressByIntimacy（low/medium/high 三档称呼）、禁忌列表
- `emotionalBehavior`：PAD 四个维度各自的行为映射描述
- `growthMilestones`：novice/growing/mature 三档人格描述
- `masterModel`：basic（称呼、时区）、preferences（沟通风格、兴趣、禁忌话题）、behaviorPatterns（工作习惯、常用工具、压力信号）、emotionalProfile（开心触发、沮丧触发、压力反应、安慰偏好）、relationshipMemory（重要时刻、内部梗、共同经历）、trustLevel（0-100）

**默认值**：提供合理的默认灵魂文档，伴侣名字取自 `companion.displayName`，主人称呼取自配置。

**持久化**：灵魂文档存储在 SQLite（persistence 包），伴侣身份部分用户可编辑，主人模型部分伴侣自动学习 + 用户可修正。

### 模块 2：PromptBuilder — 3 层 System Prompt

**接口**：
- `buildSystemPrompt(soul, padState, vitals, memories, sessionContext) → PromptLayers`

**PromptLayers 结构**：
- `stable`（稳定层）：灵魂文档身份 + 说话风格 + 成长阶段描述。每次对话不变，保持 prompt cache 热。
- `context`（上下文层）：PAD 状态（pleasure/arousal/dominance 数值 + 命名情绪 + 行为映射）+ 生命体征（energy/hunger/intimacy/level）+ 主人模型压缩摘要。每次对话更新。
- `volatile`（易失层）：相关记忆 + 会话上下文。每次 turn 更新。

**情感行为映射**：PAD 数值通过阈值（0.15）映射到具体行为描述，注入 context 层。例如 pleasure > 0.15 → "更活跃、更多赞美、语气更积极"。

**Prompt Cache 策略**：稳定层保持不变以维持上游 prefix cache。仅在灵魂文档编辑、等级跨越里程碑、主人模型重大更新时重建。

### 模块 3：DirectCaller — 直调执行器

**接口**：
- `registerDirectEndpoints(router, options)` — 注册 `/v1/direct/*` 端点
- `callProvider(translatedRequest) → LLMResponse` — 实际调用 LLM

**端点设计**：复用现有端点路径，前缀 `/v1/direct/`：
- `POST /v1/direct/chat/completions` — OpenAI 兼容
- `POST /v1/direct/messages` — Anthropic 兼容
- `POST /v1/direct/responses` — Codex 兼容

**执行流程**：解析请求 → 路由到 channel → 翻译请求（复用现有 provider adapters）→ 实际调用 LLM（新增 fetch）→ 记录审计和成本（复用现有 cost tracker）→ 返回 LLM 响应。

**错误处理**：provider 调用失败时返回标准 HTTP 错误码 + 友好错误消息。网络超时返回 504。Provider 拒绝返回对应状态码。

**认证**：直调端点复用现有的 `proxyAccessKey` 认证机制。

### 模块 4：AgentLoop — 对话循环

**接口**：
- `runConversation(message, history, context) → AgentLoopResult`

**AgentLoopConfig**：maxIterations（默认 10）、model、temperature。

**AgentLoopResult**：reply（最终回复）、iterations（执行的迭代次数）、toolCalls（执行的 tool calls 列表）、tokenUsage（input/output/total）。

**执行流程**：
1. 构建 3 层 system prompt（调用 PromptBuilder）
2. 追加用户消息到 conversation history
3. 构建 API messages（system + history）
4. 调用 LLM（通过 DirectCaller）
5. 解析响应：有 tool_calls → 执行 tool calls，追加结果，回到步骤 3；纯文本 → 返回结果
6. 迭代计数器 +1，检查是否超过 maxIterations
7. 持久化 conversation history
8. 记录 token usage 到 companion growth（applyGatewayTrafficGrowth）

**Tool Call 执行**：Phase 1 仅支持内部工具（update_master_model、recall_memory），其他工具返回 "not available yet" 错误。为 Phase 4 预留接缝。

**Integration with Companion**：agent loop 结束后，调用 `applyGatewayTrafficGrowth` 将 token 用量转化为 XP 和能量变化。

### 模块 5：ChatUI — 聊天界面

**渲染**：在 Tauri 桌面伴侣浮窗中新增聊天窗口组件。消息流：用户消息（右对齐）+ 伴侣回复（左对齐，带情感表情标记）。输入框在底部。

**交互**：双击伴侣打开/关闭聊天窗口。Enter 发送，Shift+Enter 换行。窗口可拖动。

**通信**：通过 HTTP POST 到 `http://127.0.0.1:{gatewayPort}/v1/direct/chat/completions`。请求体包含 conversation history。响应包含伴侣回复。

**类型定义**：
- `ChatMessage`：id、role（user/assistant）、content、timestamp、emotion（可选，伴侣回复时的 PAD 快照）
- `ChatSession`：id、companionId、messages、createdAt、updatedAt

**视觉风格**：半透明毛玻璃（对齐 ADR-0010），与桌面伴侣浮窗视觉一致。

### 架构决策

**Gateway 双模式共存**：代理模式（`/v1/chat/completions` 等，现有）和直调模式（`/v1/direct/chat/completions` 等，新增）在同一 Gateway 进程内共存，共享 provider profiles、channel 路由、成本追踪、审计日志。不同端点，无歧义。

**架构分离**：Companion 包提供人格层（SoulModule + PromptBuilder），Gateway 包提供执行层（DirectCaller + AgentLoop）。AgentLoop 调用 Companion 的 PromptBuilder 构建 prompt。

**Prompt Cache 优化**：稳定层保持不变以维持上游 LLM provider 的 prefix cache 热度，减少 token 成本。

**Tool Call 预留**：AgentLoop 的 tool call 执行框架在 Phase 1 就建立，但仅支持内部工具。Phase 4 开放外部工具时不需要重构循环逻辑。

## Testing Decisions

**好的测试标准**：只测外部行为，不测实现细节。测试应该验证"给定输入，模块产生什么输出"，而不是"模块内部调用了哪些函数"。

**模块测试策略**：

| 模块 | 测试重点 | 测试类型 |
|------|---------|---------|
| SoulModule | 默认灵魂文档生成、intimacy 称呼映射、成长里程碑判断 | 单元测试 |
| PromptBuilder | 3 层 prompt 组装正确性、PAD 状态注入、情感行为映射、prompt 结构验证 | 单元测试 |
| DirectCaller | 端点注册、请求翻译执行、错误处理、成本记录 | 单元测试 + 集成测试 |
| AgentLoop | 迭代控制、tool call 分发、conversation history 管理、token 统计、maxIterations 限制 | 单元测试 + 集成测试 |
| ChatUI | 消息渲染、输入处理、HTTP 通信 | 手动测试（Tauri 环境） |

**Prior Art**：参考现有包测试 — `packages/companion/tests/` 中的 companion 测试（状态机、交互、成长）、`packages/gateway/tests/` 中的 gateway 测试（路由、channel、成本追踪）。

**集成测试**：端到端流程 — 用户消息 → 直调端点 → agent loop → LLM → 回复 → 渲染。验证 Gateway 双模式互不干扰。验证 token 用量正确记录到 companion growth。

## Out of Scope

- **自主循环**（Phase 2）— 伴侣自主感知和行动，状态机，主人模型自动学习
- **记忆整合**（Phase 3）— Memory Provider 对齐，Context Compression，记忆塑造人格
- **技能系统**（Phase 4）— SKILL.md，Curator，技能注入，外部工具行动
- **Streaming** — LLM 响应流式传输（后续优化）
- **多轮 tool calling 的外部工具** — Phase 1 仅支持内部工具
- **用户存在状态检测** — Phase 2 的 User Presence 维度
- **伴侣自主发起对话** — Phase 2 的 Autonomous Loop
- **灵魂文档的 Control Center UI** — Phase 1 通过 API 管理，UI 后续

## Further Notes

### 垂直切片（Vertical Slices）

本 PRD 按**垂直切片**拆分，每个切片是端到端的完整路径（tracer bullet），支持 Claude Code Loop 开发模式：

| Issue | Slice | 类型 | Blocked by | 覆盖 User Stories |
|-------|-------|------|------------|-------------------|
| #125 | **直调端点** — Gateway 实际调用 LLM | AFK | — | #17 #18 #24 #25 |
| #126 | **灵魂注入** — 灵魂文档 + 3 层 Prompt | AFK | #125 | #3 #4 #5 #6 #7 #8 #22 #23 |
| #127 | **聊天界面** — Tauri 聊天窗口 | AFK | #126 | #1 #2 #9 #13 #14 #15 #16 |
| #128 | **对话循环** — AgentLoop + Tool Calls | AFK | #127 | #9 #10 #11 #12 #19 #20 #21 |

依赖链：#125 → #126 → #127 → #128（严格线性）

每个切片完成后可独立验证：Slice 1 用 curl 测试，Slice 2 对话测试人格，Slice 3 有完整 UI 体验，Slice 4 有完整智能对话能力。

### 参考文档

- [ADR-0011 伴侣智能架构](../adr/0011-companion-intelligence-architecture.md) — 完整的架构决策记录
- [Phase 1 技术方案](./phase1-companion-brain.md) — 详细的模块设计和接口定义
- [CONTEXT.md](../../CONTEXT.md) — 领域术语表
- [ADR-0008 桌面浮窗 + Control Center 双层架构](../adr/0008-desktop-companion-control-center.md) — UI 架构参考
- [ADR-0010 Dockable Dark Glassmorphism UI](../adr/0010-dockable-dark-glassmorphism-ui.md) — 视觉风格参考
