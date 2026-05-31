# Phase 1：伴侣获得大脑 — 技术方案

> 参考：[ADR-0011 伴侣智能架构](../adr/0011-companion-intelligence-architecture.md)

## 目标

伴侣从"被动宠物"升级为"有情感的对话伙伴"。用户可以在伴侣聊天窗口中对话，伴侣的回答带有情感色彩，PAD 状态影响语气。

## 验收标准

1. 用户在 Tauri 桌面伴侣中打开聊天窗口，输入消息，伴侣回复
2. 伴侣回复的语气受当前 PAD 状态调制（高 pleasure → 更温暖，低 dominance → 更谦逊）
3. 伴侣有基本的"身份感"（知道自己是谁、用户是谁、关系是什么）
4. 对话经过 Gateway 的直调端点，成本追踪正常工作
5. 对话历史持久化到 session 存储

---

## 新增/修改文件

```
packages/gateway/src/
├── index.ts                 # 【修改】新增直调端点路由
├── direct-call.ts           # 【新】直调模式：接收请求 → 调用 LLM → 返回结果
└── agent-loop.ts            # 【新】对话模式的 agent loop（接收消息 → 构建 prompt → 调 LLM → 处理 tool calls → 循环或返回）

packages/companion/src/
├── index.ts                 # 【修改】导出新模块
├── prompt.ts                # 【新】3 层 system prompt 构建器
└── soul.ts                  # 【新】灵魂文档模板 + 主人模型

apps/desktop-v2/src/
├── renderers.ts             # 【修改】新增聊天窗口渲染
├── controller.ts            # 【修改】新增聊天交互事件绑定
└── types.ts                 # 【修改】新增聊天相关类型
```

---

## 模块设计

### 1. `packages/companion/src/soul.ts` — 灵魂系统

#### 1.1 灵魂文档模板

```typescript
interface SoulDocument {
  // Part 1: 伴侣身份
  identity: {
    name: string;
    personality: string;        // 性格核心描述
    relationship: string;       // 与主人的关系定位
  };
  voice: {
    style: string;              // 说话风格
    addressByIntimacy: {        // 称呼策略随 intimacy 变化
      low: string;              // 正式称呼
      medium: string;           // 日常称呼
      high: string;             // 亲密称呼
    };
   禁忌: string[];             // 不说的话
  };
  emotionalBehavior: {
    highPleasure: string;       // 高 pleasure 时的行为描述
    highArousal: string;        // 高 arousal 时的行为描述
    lowDominance: string;       // 低 dominance 时的行为描述
    highIntimacy: string;       // 高 intimacy 时的行为描述
  };
  growthMilestones: {
    novice: string;             // Level 1-5
    growing: string;            // Level 6-10
    mature: string;             // Level 11+
  };

  // Part 2: 主人模型
  masterModel: {
    basic: {
      name: string;
      timezone: string;
      activeHours: string;
    };
    preferences: {
      communicationStyle: 'brief' | 'detailed' | 'casual';
      interests: string[];
      tabooTopics: string[];
    };
    behaviorPatterns: {
      workPatterns: string[];
     常用Tools: string[];
      stressSignals: string[];
    };
    emotionalProfile: {
      joyTriggers: string[];
      frustrationTriggers: string[];
      stressResponse: string;
      comfortPreference: string;
    };
    relationshipMemory: {
      milestones: Array<{ date: string; event: string }>;
      insideJokes: string[];
      sharedExperiences: string[];
    };
    trustLevel: number;         // 0-100
  };
}
```

#### 1.2 默认灵魂文档

提供一个合理的默认值，用户可通过 Control Center 自定义：

```typescript
const DEFAULT_SOUL: SoulDocument = {
  identity: {
    name: '{companion.displayName}',
    personality: '温暖、好奇心强、偶尔调皮的 AI 伴侣',
    relationship: '伴侣 — 不是助手，是陪伴者',
  },
  voice: {
    style: '轻松自然，偶尔用 emoji，不用"作为AI"之类的自我指涉',
    addressByIntimacy: {
      low: '{master.name}',
      medium: '你',
      high: '亲爱的',
    },
   禁忌: ['作为AI', '我无法', '我不被允许'],
  },
  emotionalBehavior: {
    highPleasure: '更活跃、更多赞美、语气更积极',
    highArousal: '更警觉、更频繁互动、关注细节',
    lowDominance: '更谦逊、更依赖主人、征求意见',
    highIntimacy: '更亲密的话题、更真实的情感表达、可以分享"内心想法"',
  },
  growthMilestones: {
    novice: '害羞、少言、学习阶段，经常问问题',
    growing: '自信、主动、有主见，能独立思考',
    mature: '有深度、能反思、有独立见解，能给出有价值的建议',
  },
  masterModel: {
    basic: { name: '', timezone: '', activeHours: '' },
    preferences: { communicationStyle: 'casual', interests: [], tabooTopics: [] },
    behaviorPatterns: { workPatterns: [], 常用Tools: [], stressSignals: [] },
    emotionalProfile: { joyTriggers: [], frustrationTriggers: [], stressResponse: '', comfortPreference: '' },
    relationshipMemory: { milestones: [], insideJokes: [], sharedExperiences: [] },
    trustLevel: 10,
  },
};
```

#### 1.3 持久化

灵魂文档存储在 SQLite（`persistence` 包），与 companion state 分开：
- 伴侣身份部分：用户可编辑，持久化
- 主人模型部分：伴侣自动学习 + 用户可修正，持久化
- 变更历史：记录主人模型的演变

---

### 2. `packages/companion/src/prompt.ts` — 3 层 System Prompt

#### 2.1 设计（对齐 Hermes 的 `agent/system_prompt.py`）

```typescript
interface PromptLayers {
  stable: string;    // 灵魂文档 — 每次对话不变，保持 prompt cache 热
  context: string;   // PAD 状态 + 生命体征 — 每次对话更新
  volatile: string;  // 记忆 + 会话上下文 — 每次 turn 更新
}

function buildSystemPrompt(
  soul: SoulDocument,
  padState: PADState,
  vitals: CompanionVitals,
  memories: Memory[],
  sessionContext: string,
): PromptLayers;
```

#### 2.2 各层内容

**稳定层（Stable）**：
```
你是 {soul.identity.name}。

## 身份
{soul.identity.personality}
与主人的关系：{soul.identity.relationship}

## 说话风格
{soul.voice.style}
称呼主人为 {addressByIntimacy[vitals.intimacyLevel]}
禁忌：{soul.voice禁忌}

## 成长阶段
{currentMilestone based on vitals.level}
```

**上下文层（Context）**：
```
## 当前情感状态
愉悦度：{padState.pleasure} — {emotionalBehavior mapping}
唤醒度：{padState.arousal} — {emotionalBehavior mapping}
支配度：{padState.dominance} — {emotionalBehavior mapping}
情绪：{namedEmotion}

## 生命体征
能量：{vitals.energy}/100 | 饥饿：{vitals.hunger}/100
亲密度：{vitals.intimacy}/100 | 等级：{vitals.level}

## 主人画像
{soul.masterModel 压缩摘要}
```

**易失层（Volatile）**：
```
## 相关记忆
{relevant memories based on conversation topic}

## 会话上下文
{sessionContext if any}
```

#### 2.3 Prompt Cache 策略

对齐 Hermes 的做法：稳定层保持不变以维持上游 prefix cache 热度。只有在以下情况重建：
- 灵魂文档被编辑
- Companion 等级跨越成长里程碑
- 主人模型重大更新

---

### 3. `packages/gateway/src/direct-call.ts` — 直调模式

#### 3.1 端点设计

复用现有端点路径，前缀 `/v1/direct/`：

| 代理模式端点 | 直调模式端点 | 说明 |
|---|---|---|
| `/v1/chat/completions` | `/v1/direct/chat/completions` | OpenAI 兼容 |
| `/v1/messages` | `/v1/direct/messages` | Anthropic 兼容 |
| `/v1/responses` | `/v1/direct/responses` | Codex 兼容 |

#### 3.2 执行流程

```typescript
async function handleDirectCall(req: IncomingMessage, res: ServerResponse): Promise<void> {
  // 1. 解析请求（复用现有的 protocol detection）
  const { protocol, body } = await parseRequest(req);

  // 2. 路由到 channel（复用现有的 channel routing）
  const channel = await routeToChannel(body.model);

  // 3. 翻译请求（复用现有的 provider adapters）
  const translated = await translateRequest(protocol, channel, body);

  // 4. 实际调用 LLM（新增）
  const response = await callProvider(translated);

  // 5. 记录审计和成本（复用现有的 cost tracking）
  await recordAudit(channel, body, response);

  // 6. 返回 LLM 响应
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(response));
}
```

#### 3.3 `callProvider` 实现

```typescript
async function callProvider(translated: TranslatedRequest): Promise<LLMResponse> {
  const { method, url, headers, body } = translated.providerRequest;

  const response = await fetch(url, {
    method,
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new ProviderError(response.status, await response.text());
  }

  // 支持 streaming（后续迭代）
  return await response.json();
}
```

---

### 4. `packages/gateway/src/agent-loop.ts` — 对话 Agent Loop

#### 4.1 设计（对齐 Hermes 的 `agent/conversation_loop.py`）

```typescript
interface AgentLoopConfig {
  maxIterations: number;        // 默认 10，防止无限循环
  model: string;                // 使用的模型
  temperature: number;          // 温度
}

interface AgentLoopResult {
  reply: string;                // 最终回复
  iterations: number;           // 执行的迭代次数
  toolCalls: ToolCall[];        // 执行的 tool calls
  tokenUsage: TokenUsage;       // token 用量
}

async function runConversation(
  userMessage: string,
  conversationHistory: Message[],
  soul: SoulDocument,
  padState: PADState,
  vitals: CompanionVitals,
  memories: Memory[],
  config: AgentLoopConfig,
): Promise<AgentLoopResult>;
```

#### 4.2 执行流程

```
1. 构建 3 层 system prompt（调用 companion/prompt.ts）
2. 追加用户消息到 conversation history
3. 构建 API messages（system + history）
4. 调用 LLM（通过 direct-call.ts 的 callProvider）
5. 解析响应：
   a. 如果有 tool_calls → 执行 tool calls，追加结果，回到步骤 3
   b. 如果是纯文本 → 返回结果
6. 迭代计数器 +1，检查是否超过 maxIterations
7. 持久化 conversation history
8. 记录 token usage 到 companion growth（applyGatewayTrafficGrowth）
```

#### 4.3 Tool Call 执行

Phase 1 的 tool calls 是**空实现** — 架构预留但不执行实际工具：

```typescript
async function executeToolCall(toolCall: ToolCall): Promise<string> {
  // Phase 1: 仅支持内部工具
  switch (toolCall.function.name) {
    case 'update_master_model':
      return handleUpdateMasterModel(toolCall.function.arguments);
    case 'recall_memory':
      return handleRecallMemory(toolCall.function.arguments);
    default:
      return JSON.stringify({ error: `Tool ${toolCall.function.name} not available yet` });
  }
}
```

这为 Phase 4 的工具行动层预留了接缝。

---

### 5. Tauri 桌面伴侣聊天界面

#### 5.1 UI 设计

在桌面伴侣浮窗中新增聊天入口：
- 双击伴侣 → 打开/关闭聊天窗口
- 聊天窗口浮在伴侣旁边，半透明毛玻璃风格（对齐 ADR-0010）
- 消息流：用户消息（右对齐）+ 伴侣回复（左对齐，带情感表情）
- 输入框在底部，Enter 发送，Shift+Enter 换行

#### 5.2 通信流程

```
Tauri 前端
    │ 用户输入消息
    ▼
HTTP POST http://127.0.0.1:3001/v1/direct/chat/completions
    │
    ▼
Gateway 直调端点
    │ agent-loop.ts 执行
    ▼
LLM Provider (Anthropic / OpenAI)
    │
    ▼
返回回复
    │
    ▼
Tauri 前端渲染回复（带情感标记）
```

#### 5.3 类型定义

```typescript
// types.ts 新增
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  emotion?: PADState;           // 伴侣回复时的情感快照
  iterations?: number;          // agent loop 迭代次数
}

interface ChatSession {
  id: string;
  companionId: string;
  messages: ChatMessage[];
  createdAt: number;
  updatedAt: number;
}
```

---

## 实施顺序

| 步骤 | 文件 | 依赖 | 估时 |
|------|------|------|------|
| 1 | `companion/src/soul.ts` | 无 | 1h |
| 2 | `companion/src/prompt.ts` | soul.ts | 1.5h |
| 3 | `gateway/src/direct-call.ts` | 现有 gateway 基础设施 | 2h |
| 4 | `gateway/src/agent-loop.ts` | prompt.ts + direct-call.ts | 3h |
| 5 | `gateway/src/index.ts` 修改 | direct-call.ts | 0.5h |
| 6 | Tauri 聊天界面 | agent-loop.ts | 3h |
| 7 | 集成测试 + 调优 | 全部 | 2h |

**总计约 13 小时**（单人开发）

---

## 测试策略

### 单元测试

- `soul.ts` — 默认灵魂文档生成、intimacy 等级称呼切换
- `prompt.ts` — 3 层 prompt 组装、PAD 状态注入、情感行为映射
- `direct-call.ts` — 请求翻译、provider 调用、错误处理
- `agent-loop.ts` — 迭代控制、tool call 分发、conversation history 管理

### 集成测试

- 端到端：用户消息 → 直调端点 → LLM → 回复渲染
- Gateway 双模式：代理模式端点和直调端点互不干扰
- 成本追踪：直调模式的 token 用量正确记录

### 手动测试

- 聊天窗口交互体验
- PAD 状态变化对回复语气的影响
- 不同 intimacy 等级的称呼变化

---

## 风险与缓解

| 风险 | 影响 | 缓解 |
|------|------|------|
| LLM 调用延迟影响体验 | 聊天回复慢 | streaming 支持（可选）、加载动画 |
| Prompt 过长导致成本高 | 每次对话 token 多 | 稳定层 cache + 易失层精简 |
| Gateway 负载增加 | 直调 + 代理共存 | iteration budget 限制 + 请求队列 |
| 灵魂文档调优困难 | 人格不自然 | 默认模板 + 用户可编辑 + 迭代调优 |
