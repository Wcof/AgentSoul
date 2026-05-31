# TDD 开发计划：伴侣获得大脑

> 循环执行模式：每个编号步骤是一次 `/loop` 迭代。
> 原则：先写失败测试（Red）→ 最小实现让测试通过（Green）→ 重构（Refactor）。

---

## Slice 1：直调端点 — Gateway 会说话

> Issue: #125 | 无依赖

### 1.1 Red: 直调端点路由存在

**测试**：`packages/gateway/tests/direct-call.test.ts`

```
describe('Direct Call Endpoints')
  it('POST /v1/direct/chat/completions returns 200')
    → 发送请求到 /v1/direct/chat/completions
    → 期望返回 HTTP 200

  it('POST /v1/direct/messages returns 200')
    → 发送到 /v1/direct/messages
    → 期望 200

  it('POST /v1/direct/responses returns 200')
    → 发送到 /v1/direct/responses
    → 期望 200
```

**实现**：在 gateway/src/index.ts 注册三个直调端点，返回空响应。创建 gateway/src/direct-call.ts 骨架。

**验证**：`npm run gateway:test` — 3 个测试从红变绿。

---

### 1.2 Red: 直调端点需要认证

**测试**：追加到 `direct-call.test.ts`

```
  it('returns 401 without proxyAccessKey')
    → 不带 x-api-key 发送请求
    → 期望 401

  it('returns 200 with valid proxyAccessKey')
    → 带正确 x-api-key 发送请求
    → 期望 200
```

**实现**：直调端点复用现有的认证中间件。

**验证**：5 个测试全绿。

---

### 1.3 Red: 直调端点实际调用 LLM

**测试**：追加到 `direct-call.test.ts`

```
  it('calls provider and returns LLM response')
    → mock fetch（模拟 LLM provider 返回）
    → 发送标准 OpenAI 请求体
    → 期望响应体包含 choices[0].message.content
    → 期望 fetch 被调用一次

  it('translates request before calling provider')
    → 发送 OpenAI 格式请求
    → 期望 fetch 收到翻译后的 provider 请求（URL、headers、body 格式正确）
```

**实现**：在 direct-call.ts 中实现 `callProvider(translatedRequest)` — 复用现有 provider adapters 翻译请求，然后 fetch 调用 LLM，返回结果。

**验证**：7 个测试全绿。

---

### 1.4 Red: 直调端点记录成本和审计

**测试**：追加到 `direct-call.test.ts`

```
  it('records token usage to cost tracker')
    → mock costTracker.record()
    → 发送请求，LLM 返回 usage 对象
    → 期望 costTracker.record() 被调用，参数包含 token 用量

  it('writes audit record')
    → mock audit.write()
    → 发送请求
    → 期望 audit.write() 被调用
```

**实现**：callProvider 成功后调用现有 costTracker 和 audit 基础设施。

**验证**：9 个测试全绿。

---

### 1.5 Red: 直调端点错误处理

**测试**：追加到 `direct-call.test.ts`

```
  it('returns 502 when provider returns error')
    → mock fetch 返回 500
    → 期望直调端点返回 502 + 错误消息

  it('returns 504 when provider times out')
    → mock fetch 超时
    → 期望返回 504

  it('does not affect proxy endpoints')
    → 同时发送代理端点请求
    → 期望代理端点行为不变（返回翻译后的请求）
```

**实现**：错误处理逻辑 + 代理端点回归验证。

**验证**：12 个测试全绿。Slice 1 完成 ✅

---

## Slice 2：灵魂注入 — 伴侣有身份和情感

> Issue: #126 | Blocked by: #125 (Slice 1)

### 2.1 Red: SoulDocument 类型定义

**测试**：`packages/companion/tests/soul.test.ts`

```
describe('SoulDocument')
  it('getDefaultSoul returns a valid SoulDocument')
    → 调用 getDefaultSoul(mockCompanion, '小明')
    → 期望返回对象包含 identity、voice、emotionalBehavior、growthMilestones、masterModel
    → 期望 identity.name 等于 companion.displayName

  it('masterModel has all required sections')
    → 期望 masterModel 包含 basic、preferences、behaviorPatterns、emotionalProfile、relationshipMemory、trustLevel
```

**实现**：创建 `packages/companion/src/soul.ts`，定义 SoulDocument 接口 + getDefaultSoul 函数。

**验证**：`npm run companion:test` — 2 个测试绿。

---

### 2.2 Red: 称呼随 intimacy 变化

**测试**：追加到 `soul.test.ts`

```
  it('address is formal when intimacy is low (<=33)')
    → 构建 soul，intimacy = 20
    → 调用 buildSoulPrompt(soul, 20)
    → 期望 prompt 包含正式称呼（如用户全名）

  it('address is casual when intimacy is medium (34-66)')
    → intimacy = 50
    → 期望 prompt 包含日常称呼

  it('address is intimate when intimacy is high (>66)')
    → intimacy = 80
    → 期望 prompt 包含亲密称呼
```

**实现**：实现 `buildSoulPrompt(soul, intimacyLevel)` 函数，根据 intimacy 阈值选择称呼。

**验证**：5 个测试绿。

---

### 2.3 Red: 成长里程碑随 level 变化

**测试**：追加到 `soul.test.ts`

```
  it('uses novice milestone when level <= 5')
    → level = 3
    → 期望 prompt 包含 novice 描述

  it('uses growing milestone when level 6-10')
    → level = 8
    → 期望 prompt 包含 growing 描述

  it('uses mature milestone when level > 10')
    → level = 15
    → 期望 prompt 包含 mature 描述
```

**实现**：buildSoulPrompt 根据 level 选择对应 milestone 文本。

**验证**：8 个测试绿。

---

### 2.4 Red: 3 层 Prompt 构建

**测试**：`packages/companion/tests/prompt.test.ts`

```
describe('PromptBuilder')
  it('returns object with stable, context, volatile layers')
    → 调用 buildSystemPrompt(soul, padState, vitals, [], '')
    → 期望返回 { stable: string, context: string, volatile: string }

  it('stable layer contains identity, voice, and milestone')
    → 期望 stable 包含 identity.personality
    → 期望 stable 包含 voice.style
    → 期望 stable 包含成长阶段描述

  it('context layer contains PAD values and vitals')
    → 期望 context 包含 pleasure/arousal/dominance 数值
    → 期望 context 包含 energy/hunger/intimacy 数值

  it('volatile layer contains memories and session context')
    → 传入 memories = [{text: '用户喜欢猫'}]
    → 期望 volatile 包含 '用户喜欢猫'
```

**实现**：创建 `packages/companion/src/prompt.ts`，实现 buildSystemPrompt。

**验证**：`npm run companion:test` — 12 个测试绿。

---

### 2.5 Red: PAD 情感行为映射

**测试**：追加到 `prompt.test.ts`

```
  it('maps high pleasure to warm behavior description')
    → padState.pleasure = 0.5
    → 期望 context 包含温暖/积极相关描述

  it('maps high arousal to alert behavior description')
    → padState.arousal = 0.5
    → 期望 context 包含警觉/频繁互动相关描述

  it('maps low dominance to humble behavior description')
    → padState.dominance = -0.5
    → 期望 context 包含谦逊/征求意见相关描述

  it('maps neutral PAD to neutral description')
    → pleasure = 0, arousal = 0, dominance = 0
    → 期望 context 包含中性描述

  it('names the emotion from PAD values')
    → pleasure=0.5, arousal=0.3, dominance=0.2
    → 期望 context 包含命名情绪（如 excited_confident）
```

**实现**：在 prompt.ts 中实现 PAD → 行为映射逻辑，复用 pad-engine.ts 的命名情绪。

**验证**：17 个测试绿。

---

### 2.6 Red: 替换 Slice 1 的硬编码 prompt

**测试**：`packages/gateway/tests/direct-call.test.ts` 追加

```
  it('direct call uses soul-driven prompt when companion context provided')
    → 发送请求附带 companionId
    → 期望调用 LLM 时 system prompt 包含伴侣身份（非"有帮助的助手"）
```

**实现**：direct-call.ts 检测到 companionId 时，调用 PromptBuilder 构建灵魂 prompt，替换默认 prompt。

**验证**：13 个 Slice 1 测试 + 17 个 Slice 2 测试全绿。Slice 2 完成 ✅

---

## Slice 3：聊天界面 — 用户能看到和输入

> Issue: #127 | Blocked by: #126 (Slice 2)

### 3.1 Red: 聊天消息类型定义

**测试**：`apps/desktop-v2/tests/chat.test.ts`（或 .mjs）

```
describe('Chat types')
  it('ChatMessage has required fields')
    → 创建 ChatMessage { id, role, content, timestamp }
    → 期望所有字段存在

  it('ChatMessage emotion is optional')
    → 创建不带 emotion 的 ChatMessage
    → 期望不报错
```

**实现**：在 `apps/desktop-v2/src/types.ts` 添加 ChatMessage、ChatSession 接口。

**验证**：2 个测试绿。

---

### 3.2 Red: 聊天窗口渲染函数

**测试**：追加到 `chat.test.ts`

```
describe('Chat renderer')
  it('renderChatWindow returns valid HTML string')
    → 调用 renderChatWindow({ messages: [], loading: false })
    → 期望返回包含 chat-container class 的 HTML

  it('renders user messages right-aligned')
    → messages = [{ role: 'user', content: '你好' }]
    → 期望 HTML 包含 '你好' + right-align class

  it('renders assistant messages left-aligned with emotion')
    → messages = [{ role: 'assistant', content: '嗨~', emotion: 'relaxed_content' }]
    → 期望 HTML 包含 '嗨~' + left-align class + 'relaxed_content'

  it('renders loading indicator when loading=true')
    → loading = true
    → 期望 HTML 包含 loading indicator 元素

  it('renders empty state when no messages')
    → messages = []
    → 期望 HTML 包含空状态提示
```

**实现**：在 `apps/desktop-v2/src/renderers.ts` 添加 renderChatWindow 函数。

**验证**：7 个测试绿。

---

### 3.3 Red: 聊天控制器 — 发送消息

**测试**：追加到 `chat.test.ts`

```
describe('Chat controller')
  it('sendMessage calls direct endpoint with correct body')
    → mock fetch
    → 调用 sendMessage('你好', [])
    → 期望 fetch 被调用，URL 包含 /v1/direct/chat/completions
    → 期望 body 包含 messages: [{ role: 'user', content: '你好' }]

  it('sendMessage returns assistant reply')
    → mock fetch 返回 { choices: [{ message: { content: '嗨~' } }] }
    → 期望返回 '嗨~'

  it('sendMessage handles network error gracefully')
    → mock fetch 抛出网络错误
    → 期望返回错误对象（不崩溃）
```

**实现**：在 `apps/desktop-v2/src/controller.ts` 添加 sendMessage 函数。

**验证**：10 个测试绿。

---

### 3.4 Red: 聊天控制器 — 打开/关闭窗口

**测试**：追加到 `chat.test.ts`

```
  it('toggleChatWindow adds chat container to DOM')
    → 调用 toggleChatWindow()
    → 期望 DOM 中出现 chat container

  it('toggleChatWindow removes chat container on second call')
    → 调用两次 toggleChatWindow()
    → 期望 DOM 中无 chat container

  it('submitMessage clears input and appends user message')
    → 设置 input value = '测试'
    → 调用 submitMessage()
    → 期望 input 被清空
    → 期望消息列表包含 '测试'
```

**实现**：toggleChatWindow 和 submitMessage 逻辑。

**验证**：13 个测试绿。

---

### 3.5 手动验证：Tauri 视觉效果

**这不是自动化测试，而是手动检查清单**：

- [ ] 双击伴侣浮窗 → 聊天窗口出现
- [ ] 再次双击 → 聊天窗口消失
- [ ] 输入"你好"按 Enter → 消息出现右对齐 → 加载动画 → 伴侣回复左对齐带情感标记
- [ ] 窗口可拖动
- [ ] 毛玻璃半透明效果
- [ ] Shift+Enter 换行不发送
- [ ] Gateway 不可用时友好提示

**实现**：CSS 样式调整、事件绑定、视觉打磨。

**验证**：手动检查清单全部通过。Slice 3 完成 ✅

---

## Slice 4：对话循环 — 伴侣能深度思考

> Issue: #128 | Blocked by: #127 (Slice 3)

### 4.1 Red: AgentLoop 基础 — 单轮对话

**测试**：`packages/gateway/tests/agent-loop.test.ts`

```
describe('AgentLoop')
  it('returns LLM reply for simple message')
    → mock DirectCaller 返回纯文本回复
    → 调用 runConversation('你好', [], context)
    → 期望 result.reply 包含 LLM 回复
    → 期望 result.iterations === 1
    → 期望 result.toolCalls 为空
```

**实现**：创建 `packages/gateway/src/agent-loop.ts`，实现 runConversation 基础版（构建 prompt → 调 LLM → 返回）。

**验证**：1 个测试绿。

---

### 4.2 Red: AgentLoop 迭代控制

**测试**：追加到 `agent-loop.test.ts`

```
  it('respects maxIterations limit')
    → mock LLM 每次都返回 tool_calls（永远不返回纯文本）
    → maxIterations = 3
    → 调用 runConversation(...)
    → 期望 result.iterations === 3
    → 期望 result.reply 包含"达到迭代上限"相关内容（不崩溃）

  it('stops on first text response')
    → mock LLM 第一次返回 tool_call，第二次返回纯文本
    → 期望 result.iterations === 2
    → 期望 result.reply 是第二次的文本
```

**实现**：迭代循环 + maxIterations 检查。

**验证**：3 个测试绿。

---

### 4.3 Red: AgentLoop Tool Call 分发

**测试**：追加到 `agent-loop.test.ts`

```
  it('executes update_master_model tool call')
    → mock LLM 返回 tool_call: { name: 'update_master_model', arguments: { field: 'preferences.interests', value: ['编程'] } }
    → 期望 tool 执行后主人模型更新
    → 期望 tool result 追加到 history
    → 期望第二次 LLM 调用包含 tool result

  it('executes recall_memory tool call')
    → mock LLM 返回 tool_call: { name: 'recall_memory', arguments: { query: '猫' } }
    → 期望返回相关记忆

  it('returns error for unknown tool')
    → mock LLM 返回 tool_call: { name: 'unknown_tool', arguments: {} }
    → 期望 tool result 包含 "not available"
    → 不崩溃
```

**实现**：tool call 分发逻辑，注册内部工具 handler。

**验证**：6 个测试绿。

---

### 4.4 Red: AgentLoop Token 统计

**测试**：追加到 `agent-loop.test.ts`

```
  it('tracks token usage across iterations')
    → mock LLM 返回 usage: { prompt_tokens: 100, completion_tokens: 50 }
    → 调用 runConversation(...)
    → 期望 result.tokenUsage.input === 100
    → 期望 result.tokenUsage.output === 50
    → 期望 result.tokenUsage.total === 150

  it('accumulates token usage across multiple iterations')
    → mock LLM 第一次返回 usage 100/50，第二次返回 200/80
    → 期望 result.tokenUsage.total === 430
```

**实现**：token usage 累加逻辑。

**验证**：8 个测试绿。

---

### 4.5 Red: AgentLoop 持久化

**测试**：追加到 `agent-loop.test.ts`

```
  it('persists conversation history after completion')
    → mock sessionRepository
    → 调用 runConversation(...)
    → 期望 sessionRepository.save 被调用
    → 期望保存的 history 包含 user message + assistant reply

  it('converts token usage to companion growth')
    → mock companion.applyGatewayTrafficGrowth
    → 调用 runConversation(...)
    → 期望 applyGatewayTrafficGrowth 被调用，参数包含 inputTokens + outputTokens
```

**实现**：完成后持久化 + growth 转化。

**验证**：10 个测试绿。

---

### 4.6 Red: 聊天界面集成 AgentLoop

**测试**：追加到 `apps/desktop-v2/tests/chat.test.ts`

```
  it('chat uses agent loop instead of single call')
    → 发送消息
    → 期望响应包含 iterations 和 tokenUsage 字段

  it('displays emotion marker from agent loop result')
    → 伴侣回复包含 emotion
    → 期望 UI 显示情感标记
```

**实现**：ChatUI 的 sendMessage 改为调用 agent loop 端点（或 direct 端点内部走 agent loop）。

**验证**：15 个 gateway 测试 + 12 个 desktop 测试全绿。Slice 4 完成 ✅

---

## 总览

| Step | 描述 | 测试数 | 累计 |
|------|------|--------|------|
| 1.1 | 直调端点路由 | 3 | 3 |
| 1.2 | 认证 | 2 | 5 |
| 1.3 | 实际调用 LLM | 2 | 7 |
| 1.4 | 成本和审计 | 2 | 9 |
| 1.5 | 错误处理 + 代理回归 | 3 | 12 |
| 2.1 | SoulDocument 类型 | 2 | 14 |
| 2.2 | 称呼变化 | 3 | 17 |
| 2.3 | 成长里程碑 | 3 | 20 |
| 2.4 | 3 层 Prompt | 4 | 24 |
| 2.5 | PAD 情感映射 | 5 | 29 |
| 2.6 | 替换硬编码 prompt | 1 | 30 |
| 3.1 | 聊天类型 | 2 | 32 |
| 3.2 | 聊天渲染 | 5 | 37 |
| 3.3 | 发送消息 | 3 | 40 |
| 3.4 | 打开/关闭窗口 | 3 | 43 |
| 3.5 | 手动验证 | — | 43 |
| 4.1 | 单轮对话 | 1 | 44 |
| 4.2 | 迭代控制 | 2 | 46 |
| 4.3 | Tool Call 分发 | 3 | 49 |
| 4.4 | Token 统计 | 2 | 51 |
| 4.5 | 持久化 + Growth | 2 | 53 |
| 4.6 | UI 集成 | 2 | 55 |

**总计 17 个步骤，55 个测试**。每个步骤 = 一次 `/loop` 迭代。

## 循环执行命令

```bash
# 按顺序循环执行，每个步骤一次 loop
/loop 执行 TDD 计划 docs/v2/TDD-PLAN-companion-brain.md 的下一个未完成步骤
```
