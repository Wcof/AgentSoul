# Desktop Body-first AgentSoul 架构设计

## 背景

AgentSoul 当前同时承载两套互相竞争的产品模型：

- 旧模型：AgentSoul 是一个 Control Center，里面有 gateway、costs、sessions、skills、mcp、prompts、safety、conversations 等 Area，桌宠只是其中一个展示面。
- 新模型：AgentSoul 是一个有桌面身体的本地 Agent。用户第一眼看到的是桌面上的存在，其他能力从这个身体里长出来。

后续架构以新模型为准。旧 Control Center 不再是隐藏入口、开发者入口或降级模块，而是从主产品中删除。

## 核心原则

1. Desktop Body 是唯一主界面。
2. Agent Mind 是唯一决策核心。
3. Memory 是唯一长期状态来源。
4. Extension Runtime 是唯一扩展入口。
5. 旧 Control Center 相关 Area 可以删除，不保留主路径。

## 目标架构

```text
AgentSoul Desktop
├─ Desktop Body
│  ├─ Embodied Window
│  ├─ Appearance Pack
│  ├─ Animation State
│  ├─ Bubble Surface
│  ├─ Context Menu
│  └─ Embedded Panels
├─ Agent Mind
│  ├─ Interaction Turn
│  ├─ Hermes Prompt Layers
│  ├─ Autonomy Loop
│  └─ Output Strategy
├─ Memory
│  ├─ Soul Document
│  ├─ Master Model
│  ├─ Long-term Memory
│  └─ Correction / Forget / Confirm
└─ Extension Runtime
   ├─ Extension Manifest
   ├─ Capability Registry
   ├─ Tool Adapter
   └─ Runtime Events
```

## Module 职责

### Desktop Body

Desktop Body 是 Agent 在桌面上的身体和唯一主界面。

职责：

- 桌面窗口、拖拽、位置记忆。
- 形象资源包加载、校验、切换。
- 状态动画和气泡表达。
- 右键菜单、轻量输入、小面板、临时抽屉。
- 把用户动作转成事件交给 Agent Mind。

Desktop Body 不直接做模型调用、长期记忆更新或工具决策。

建议目录：

```text
apps/desktop-v2/src/desktop-body/
  window.ts
  appearance-pack.ts
  animation.ts
  surface.ts
  menu.ts
  embedded-panels.ts
```

### Agent Mind

Agent Mind 是伴侣的决策核心，参考 Hermes 的三层 prompt 架构。

职责：

- 一次 interaction turn：输入、上下文组装、模型调用、输出策略、状态 patch。
- Hermes-style prompt layers：稳定层、上下文层、易失层。
- Autonomy loop：自主 tick、主动提醒、等待、打断。
- Output Strategy：决定沉默、气泡、通知或右键面板提示。

Agent Mind 不渲染 UI，也不直接知道 Desktop Body 的 DOM 或 Tauri 细节。

建议目录：

```text
apps/desktop-v2/src/agent-mind/
  interaction-turn.ts
  prompt-layers.ts
  autonomy-loop.ts
  output-strategy.ts
  model-transport.ts
```

### Memory

Memory 是长期状态来源，不再是 Control Center 的 JSON 附属面板。

职责：

- Soul Document。
- Master Model。
- 长期记忆、关系记忆、偏好、情绪触发。
- 观察、假设、验证、固化。
- 修正、遗忘、确认。

Agent Mind 每次思考都从 Memory 读取必要上下文，并把新观察写回 Memory。

建议目录：

```text
apps/desktop-v2/src/memory/
  soul-document.ts
  master-model.ts
  memory-store.ts
  correction.ts
```

### Extension Runtime

Extension Runtime 是未来能力装载口。它不是旧 gateway、mcp、skills 的保留地，而是新的能力接口。

职责：

- 注册扩展 manifest。
- 暴露 capability registry。
- 调用 tool adapter。
- 接收 runtime events。
- 提供可选 developer inspector。

旧的 gateway、mcp、skills、sessions、costs、prompts、safety、conversations 不作为核心模块存在。未来需要时，以 extension 的形式重新进入。

建议目录：

```text
apps/desktop-v2/src/extension-runtime/
  manifest.ts
  registry.ts
  capability.ts
  adapter.ts
  events.ts
```

## 删除清单

从 Desktop 主产品中删除：

```text
areas/costs
areas/gateway
areas/sessions
areas/sessions-mgr
areas/skills
areas/mcp
areas/prompts
areas/safety
areas/conversations
大部分 areas/settings-full
Control Center shell
Area registry
Gateway/Channel 用户可见语言
```

保留或迁移：

```text
canvas-renderer             -> desktop-body/animation
petAssetPack                -> desktop-body/appearance-pack
desktop-companion-surface   -> desktop-body/surface
companion-interaction-turn  -> agent-mind/interaction-turn
companion-autonomy-projection -> agent-mind/output-strategy
master-model-editing        -> memory/correction
chat-controller             -> agent-mind/model-transport
```

## 启动行为

`npm run dev` 启动后只打开 Desktop Body。
不默认打开 Control Center。
需要配置、记忆、扩展、调试时，从 Desktop Body 的右键菜单打开对应 embedded panel 或 developer inspector。

## UI 形态

Desktop Body 的 UI 不做页面化控制台。

允许的形态：

- 右键菜单。
- 气泡。
- 小输入框。
- 临时抽屉。
- 嵌入式小面板。
- developer inspector。

不允许的形态：

- 常驻主页面。
- 多 Area 导航。
- 控制台式管理后台。
- gateway/cost/session/skill 等用户可见模块。

## 扩展性

扩展性通过 Extension Runtime 保留，而不是通过旧模块保留。

最小接口：

```ts
interface ExtensionManifest {
  id: string;
  name: string;
  capabilities: CapabilityDeclaration[];
}

interface ExtensionRuntime {
  register(manifest: ExtensionManifest): void;
  listCapabilities(): CapabilityDeclaration[];
  invoke(capabilityId: string, input: unknown): Promise<unknown>;
  emit(event: RuntimeEvent): void;
}
```

第一阶段只定义接口和 developer inspector，不迁回旧功能。

## 实施顺序

1. 建立 `desktop-body/agent-mind/memory/extension-runtime` 目录和接口。
2. 让 `main.ts` 只启动 Desktop Body。
3. 删除 Area registry 和 Control Center shell 主路径。
4. 迁移桌宠渲染、形象包、拖拽、右键菜单到 Desktop Body。
5. 迁移 Hermes-style prompt、interaction turn、output strategy 到 Agent Mind。
6. 迁移 Master Model 和修正/遗忘到 Memory。
7. 建立空 Extension Runtime。
8. 删除旧 Area 目录和相关测试，补新架构测试。

## 验收标准

- `npm run dev` 只启动 Desktop Body。
- 代码中没有主产品级 Control Center/Area registry。
- 用户可见文案不出现 gateway、costs、sessions、skills、mcp、prompts、safety、conversations。
- Desktop Body 可以显示形象、拖动、右键打开功能入口、更换形象。
- Agent Mind 可以完成一次 interaction turn。
- Memory 可以读写 Master Model。
- Extension Runtime 有最小 manifest/capability/invoke 接口。
- 旧模块删除后 typecheck 和核心测试通过。
