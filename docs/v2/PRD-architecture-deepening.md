# PRD: AgentSoul v2 架构深化优化（完整版）

> **状态**: Draft
> **创建时间**: 2026-05-30
> **关联 ADR**: ADR-0001 ~ ADR-0010
> **关联分析**: `/tmp/architecture-review-*.html`
> **关联 Issue**: #106

---

## Problem Statement

AgentSoul v2 经过从 Python 到 TypeScript/Tauri 的完整重写后，核心功能已经实现，但代码组织层面存在模块化不足的问题，导致新增功能时摩擦较大：

1. **前端层**：4 个单体文件（renderers.ts 2254行、controller.ts 2026行、styles.css 4763行、types.ts 878行）承载整个 Control Center UI。新增一个 Area 需要同时修改 4 个文件。

2. **包层**：18 个 npm workspace 包中有 6 个是 <150 行的浅模块（runtime 仅 27 行 re-export），维护成本远超收益。同时 gateway 包是 2471 行的单体。

3. **类型层**：桌面层 84 个类型与 domain 包 59 个类型平行但不兼容。

4. **记忆层**：memory 包和 mcp-adapter 各自维护独立的记忆存储表，同一操作有两条写入路径。

5. **Claude Code 集成缺失**：无 `.claude/rules/` 编码规范、无 `.claude/skills/` 可复用工作流、无局部 CLAUDE.md 上下文文件。

6. **文档未同步**：CLAUDE.md、README.md、CONTEXT.md 仍引用已删除的旧版本内容或过时的包结构。

---

## Solution

一次性完成以下 8 个工作流，每个工作流独立可验证：

1. 前端按 Area 拆分（25 个 User Stories）
2. 浅模块合并与包瘦身（15 个）
3. Gateway 拆分（15 个）
4. 记忆去重（5 个）
5. 文档与配置同步（15 个）
6. 模块独立性保障（10 个）
7. 标准化扩展流程（5 个）
8. 全面复查与验证（12 个）

共计 **102 个 User Stories**。

---

## User Stories

### 一、前端按 Area 拆分（25 个）

1. 作为开发者，我想通过创建一个新目录来添加 Control Center 的新功能区域，这样我不需要修改任何现有文件。
2. 作为开发者，我想每个 Area 目录包含独立的 render.ts、bind.ts、types.ts 和 style.css，这样我可以在一个地方看到某个功能的完整实现。
3. 作为开发者，我想公共组件（Shell 布局、导航栏、App Switcher）放在 shared/ 目录，这样 Area 之间可以复用。
4. 作为开发者，我想每个 Area 的类型从 @agentsoul/domain 派生 ViewModel，这样 domain 层的类型变更能自动传导到 UI 层。
5. 作为开发者，我想 main.ts 只负责组装各 Area 的 render 和 bind，这样一目了然地看到整个 UI 结构。
6. 作为开发者，我想 styles.css 拆分为 shared/style.css + 各 Area 的 style.css，这样修改某个 Area 的样式不影响其他区域。
7. 作为开发者，我想在每个 Area 目录放置一个 CLAUDE.md 描述该 Area 的接口和约束。
8. 作为开发者，我想 Tab 切换仍然使用 CSS display toggle（符合 ADR-0010），这样拆分后 DOM 节点保持 mounted。
9. 作为开发者，我想 bind 函数的四参数模式封装为 AreaContext 接口，这样新增 Area 不需要记住参数顺序。
10. 作为开发者，我想每个 Area 可以独立测试 render 输出和 bind 行为。
11. 作为开发者，我想 companion Area 包含 Canvas 精灵动画初始化逻辑。
12. 作为开发者，我想 gateway Area 包含 Channel 卡片、Provider 选择、成本表格的渲染和事件绑定。
13. 作为开发者，我想 skills Area 包含技能包列表、安装/卸载、项目激活的 UI 逻辑。
14. 作为开发者，我想 sessions Area 包含会话列表、搜索、启动器的 UI 逻辑。
15. 作为开发者，我想 safety Area 包含审批请求、风险通知、信任授权的 UI 逻辑。
16. 作为开发者，我想 settings Area 包含通用/外观/代理等子 Tab 的 UI 逻辑。
17. 作为开发者，我想 mcp Area 包含 MCP 服务器列表、连接状态、工具索引的 UI 逻辑。
18. 作为开发者，我想 prompts Area 包含提示词模板列表和编辑的 UI 逻辑。
19. 作为开发者，我想 conversations Area 包含对话仪表盘的 UI 逻辑。
20. 作为开发者，我想 costs Area 包含成本明细表格和趋势图表的 UI 逻辑。
21. 作为开发者，我想 i18n 翻译 key 按 Area 分组到嵌套结构中。
22. 作为开发者，我想每个 Area 的 style.css 使用 BEM 命名约定。
23. 作为开发者，我想 AreaContext 接口包含 t() 翻译函数。
24. 作为开发者，我想 main.ts 的 bootstrap 函数改为按 Area 列表动态组装。
25. 作为开发者，我想保留 renderers.ts 和 controller.ts 作为 barrel 文件（仅 re-export），这样现有测试的 import 路径不需要立即修改。

### 二、浅模块合并与包瘦身（15 个）

26. 作为开发者，我想将 runtime、config、health、pad-engine、security 合并为 @agentsoul/core 包。
27. 作为开发者，我想将 memory、entity、semantic 合并为扩展的 @agentsoul/memory 包。
28. 作为开发者，我想删除 runtime 包（27 行 re-export），消除不必要的间接层。
29. 作为开发者，我想 mcp-adapter 直接 import from @agentsoul/companion 而不是 @agentsoul/runtime。
30. 作为开发者，我想 persistence 包瘦身为仅包含 initializeV2Database()、迁移工具和 AuditRepository。
31. 作为开发者，我想 CompanionRepository 移入 @agentsoul/companion 包。
32. 作为开发者，我想 MemoryRepository + EntityRepository + SemanticRepository 移入 @agentsoul/memory 包。
33. 作为开发者，我想 SessionRepository 移入 @agentsoul/sessions 包。
34. 作为开发者，我想合并后的 @agentsoul/core 导出深层接口（createHealthChecker、applyPadEvent、createCredentialStore）。
35. 作为开发者，我想合并后的 @agentsoul/memory 导出 createMemoryStore、createEntityStore、createSemanticStore 三个工厂函数。
36. 作为开发者，我想每个合并后的包有独立的 package.json、tsconfig.json 和 tests/ 目录。
37. 作为开发者，我想 package.json 的 workspaces 数组从 18 个减为 12 个。
38. 作为开发者，我想 health 包的 raw SQL 查询改为使用 persistence 的 Repository 抽象。
39. 作为开发者，我想合并过程中所有现有测试保持通过。
40. 作为开发者，我想合并后的 import 路径通过 barrel export 保持稳定。

### 三、Gateway 拆分（15 个）

41. 作为开发者，我想将 gateway/index.ts 拆为 gateway-server（HTTP 壳 + 路由注册）。
42. 作为开发者，我想将 Channel Store 移入 gateway-channels 包。
43. 作为开发者，我想将 Cost Tracker 移入 gateway-cost 包。
44. 作为开发者，我想将 Audit Repository 移入 gateway-audit 包。
45. 作为开发者，我想 Provider 适配器移入 gateway-server/providers/ 目录。
46. 作为开发者，我想 gateway-server 导出 startLocalGateway() 接口保持不变（符合 ADR-0002）。
47. 作为开发者，我想 Gateway 仍支持 sidecar 模式和独立模式（符合 ADR-0008）。
48. 作为开发者，我想 gateway 子模块之间通过接口解耦。
49. 作为开发者，我想 Channel Store 的独立 SQLite Schema 合并到 persistence 的统一 Schema。
50. 作为开发者，我想 gateway-server 的 30+ HTTP 路由按功能分组注册。
51. 作为开发者，我想每个 gateway 子模块有独立的测试。
52. 作为开发者，我想 gateway 拆分后 export 包的依赖路径相应更新。
53. 作为开发者，我想 gateway 拆分后 npm run gateway:test 仍然通过。
54. 作为开发者，我想 gateway/src/http-ping.ts 工具函数移入 gateway-channels 包。
55. 作为开发者，我想 FailoverPolicy 和 Circuit Breaker 逻辑移入 gateway-channels 包。

### 四、记忆去重（5 个）

56. 作为开发者，我想 mcp-adapter 中的 McpMemoryStore 被移除，改为调用 @agentsoul/memory 的统一接口。
57. 作为开发者，我想 mcp_memory_records 表被废弃，数据迁移到 memory_entries 表。
58. 作为开发者，我想 MCP adapter 只做协议转换（MCP tool → 领域调用）。
59. 作为开发者，我想记忆只有一条写入路径，数据一致性有保障。
60. 作为开发者，我想记忆去重后 mcp-adapter 的测试仍然通过。

### 五、文档与配置同步（15 个）

61. 作为开发者，我想 CLAUDE.md 更新为反映新的包结构和命令。
62. 作为开发者，我想 README.md 更新为反映新的包结构和启动命令。
63. 作为开发者，我想 CONTEXT.md 新增 Area、AreaContext 等新概念。
64. 作为开发者，我想 AGENTS.md 更新为反映新的包结构。
65. 作为开发者，我想 package.json 的 workspaces 数组更新。
66. 作为开发者，我想 package.json 的 scripts 部分更新：删除已合并包的 :test/:typecheck 脚本，新增拆分后的 gateway-* 脚本。
67. 作为开发者，我想 vitest.config.mts 的 test.include 模式更新。
68. 作为开发者，我想每个保留的包的 package.json dependencies 更新为新的包名。
69. 作为开发者，我想每个保留的包的 tsconfig.json paths 更新为新的包名。
70. 作为开发者，我想 tests/v2/ 中的契约测试更新为引用新的包名和结构。
71. 作为开发者，我想 apps/desktop-v2/launcher.mjs 更新 import 路径。
72. 作为开发者，我想 scripts/migrate-tests.mjs 更新路径引用。
73. 作为开发者，我想新增 ADR-0011 记录本次架构深化决策。
74. 作为开发者，我想 docs/v2/replacement-parity-checklist.md 更新为反映新结构。
75. 作为开发者，我想 CONTEXT.md 中的 Dock Position 定义更新（已移除 dock 切换按钮）。

### 六、模块独立性保障（10 个）

76. 作为开发者，我想每个 Area 只通过 AreaContext 接口与外部交互，这样删除一个 Area 目录不会导致编译错误。
77. 作为开发者，我想每个包只通过 package.json 的 dependencies 声明依赖，这样不存在隐式的跨包 import。
78. 作为开发者，我想前端 types.ts 中的所有 ViewModel 类型都从 @agentsoul/domain 派生，这样不存在类型泄漏。
79. 作为开发者，我想 Area 之间不直接 import 彼此的代码，这样 Area A 的变更不会意外破坏 Area B。
80. 作为开发者，我想 Area 的 render.ts 只依赖自己的 types.ts 和 shared/ 公共组件。
81. 作为开发者，我想 Area 的 bind.ts 只依赖 AreaContext 接口。
82. 作为开发者，我想每个包的 src/index.ts 只导出公开接口，内部实现不暴露给外部。
83. 作为开发者，我想 persistence 包的 Repository 类只通过构造函数注入数据库实例。
84. 作为开发者，我想 gateway 内部按职责拆文件（server/channels/cost/audit），文件之间通过函数调用而非直接 import 实现细节。
85. 作为开发者，我想 mcp-adapter 只做协议转换，不包含任何业务逻辑。

### 七、标准化扩展流程（5 个）

86. 作为开发者，我想 main.ts 使用 const 数组组装所有 Area，这样新增 Area 只需要在数组中添加一行。
87. 作为开发者，我想 Area 的接入格式为 `{ id: string, render: RenderFn, bind: BindFn }`。
88. 作为开发者，我想新增一个 Area 的完整步骤是：(1) 创建 areas/xxx/ 目录，(2) 实现 render + bind + types + style，(3) 在 main.ts 数组中添加一行。
89. 作为开发者，我想新增一个包的完整步骤是：(1) 创建 packages/xxx/ 目录，(2) 实现 src/index.ts，(3) 在根 package.json workspaces 中注册。
90. 作为开发者，我想每个 Area 的 types.ts 包含该 Area 的 ViewModel 类型定义和从 domain 派生的类型别名。

### 八、全面复查与验证（12 个）

91. 作为 QA，我想运行 npm run v2:test 确认所有契约测试通过。
92. 作为 QA，我想运行 npm run v2:typecheck 确认 TypeScript 编译无错误。
93. 作为 QA，我想运行每个包的独立测试确认包级测试通过。
94. 作为 QA，我想运行 npm run v2:build 确认前端构建成功。
95. 作为 QA，我想启动 Tauri 桌面应用确认 Control Center 正常显示。
96. 作为 QA，我想在 Control Center 中点击每个 Tab 确认内容区域正确切换。
97. 作为 QA，我想拖拽桌面伴侣窗口到屏幕边缘确认自动吸附功能正常。
98. 作为 QA，我想运行 vitest run 确认所有包的测试通过。
99. 作为 QA，我想确认删除的包目录不再存在于 packages/ 中。
100. 作为 QA，我想确认 package-lock.json 重新生成且无过时依赖。
101. 作为 QA，我想运行泄漏检测：grep 所有 Area 目录，确认没有 Area 直接 import 另一个 Area 的代码。
102. 作为 QA，我想运行删除测试：临时删除一个 Area 目录，确认项目仍然编译通过。

---

## Implementation Decisions

### ID-1: Area 目录结构

每个 Control Center Area 采用统一目录结构：

```
apps/desktop-v2/src/areas/<area-name>/
├── CLAUDE.md          # 局部上下文
├── render.ts          # 渲染函数
├── bind.ts            # 事件绑定
├── types.ts           # Area 专属类型
└── style.css          # Area 样式（BEM 命名）
```

公共组件放在 `apps/desktop-v2/src/shared/`：shell.ts、nav.ts、app-switcher.ts、modal.ts、context-menu.ts。

Area 列表（12 个）：companion、gateway、skills、sessions、conversations、costs、safety、settings、settings-full、sessions-mgr、mcp、prompts。

### ID-2: AreaContext 接口

```typescript
interface AreaContext {
  target: HTMLElement;
  snapshot: CompanionRuntimeSnapshot;
  controller: DesktopCompanionController;
  controlClient: LocalControlClient;
  t: TranslationFunction;
}
```

每个 Area 的 bind 函数签名统一为 `bind(ctx: AreaContext): void`。

### ID-3: ViewModel 类型派生

桌面层 ViewModel 从 domain 类型派生：

```typescript
type ChannelCardVM = Channel & { statusLabel: string; costLabel: string; }
```

确保 domain 变更自动传导到 UI 层（编译时保护）。

### ID-4: Tab 切换保持 CSS display toggle

符合 ADR-0010：所有 Area 的 DOM 节点始终保持 mounted，通过 `data-active-tab` 属性 + CSS 选择器控制可见性。

### ID-5: 合并后的包结构（18 → 12）

| 新包名 | 来源 | 职责 |
|--------|------|------|
| `domain` | 保留 | 纯类型定义 |
| `core` | 新 | config + health + pad-engine + security + runtime |
| `persistence` | 瘦身 | 仅 init + migrate + AuditRepository |
| `companion` | 扩展 | Companion 行为 + CompanionRepository |
| `memory` | 扩展 | memory + entity + semantic + Repository |
| `gateway-server` | 新 | HTTP 壳 + 路由 + Provider 适配器 |
| `gateway-channels` | 新 | Channel Store + Failover + Circuit Breaker |
| `gateway-cost` | 新 | Cost Tracker |
| `gateway-audit` | 新 | Audit Repository |
| `safety` | 保留 | 安全策略 + 审批 + 信任授权 |
| `skills` | 保留 | 技能包管理 |
| `sessions` | 扩展 | 会话管理 + SessionRepository |
| `export` | 保留 | 数据导出 |
| `mcp-adapter` | 保留 | MCP 协议转换（去除 McpMemoryStore） |
| `provider` | 保留 | Provider Profile |

### ID-6: Persistence Schema 不拆分

仍然使用单一 SQLite 数据库（符合 ADR-0001），但 Repository 类按领域归属到各自功能包。Schema DDL 保留在 persistence 的 initializeV2Database() 中。

### ID-7: Gateway 子模块接口

```typescript
interface ChannelStore { getChannel(id: string): Channel | null; ... }
interface CostTracker { recordUsage(channelId: string, tokens: number): void; ... }
interface AuditRepository { insert(record: AuditRecord): void; ... }
```

依赖注入在 startLocalGateway() 中完成。Gateway 仍支持 sidecar 和独立模式（符合 ADR-0008）。

### ID-8: 记忆去重迁移

1. 将 mcp_memory_records 数据复制到 memory_entries
2. McpMemoryStore 改为调用 @agentsoul/memory 的 MemoryStore 接口
3. 废弃 mcp_memory_records 表

### ID-9: i18n key 按 Area 嵌套

```json
{
  "companion": { "title": "...", "feed": "..." },
  "gateway": { "title": "...", "addChannel": "..." }
}
```

### ID-10: 新增 ADR-0011

记录本次架构深化的决策：包合并策略、Gateway 拆分策略、记忆去重策略、前端 Area 拆分策略。

### ID-14: 配置文件更新清单

| 文件 | 变更 |
|------|------|
| `package.json` | workspaces 18→12，scripts 更新 |
| `vitest.config.mts` | test.include 模式审查 |
| 14 个 `tsconfig.json` | paths 更新为新包名 |
| 18 个 `package.json`（包级） | dependencies 更新为新包名 |
| 39 个 `tests/v2/*.test.mjs` | 包名字符串断言更新 |
| `apps/desktop-v2/launcher.mjs` | import 路径更新 |
| `scripts/migrate-tests.mjs` | 路径引用更新 |

### ID-15: Area 简单数组组装

main.ts 使用一个 const 数组组装所有 Area，不做过度抽象：

```typescript
// main.ts
import { renderCompanionArea, bindCompanionArea } from "./areas/companion/render";
import { renderGatewayArea, bindGatewayArea } from "./areas/gateway/render";
// ... import 所有 Area

const areas = [
  { id: "companion", render: renderCompanionArea, bind: bindCompanionArea },
  { id: "gateway",   render: renderGatewayArea,   bind: bindGatewayArea },
  { id: "skills",    render: renderSkillsArea,     bind: bindSkillsArea },
  // ... 12 个 Area
];

// 遍历渲染和绑定
for (const area of areas) {
  const html = area.render(ctx);
  // 插入 DOM
  area.bind(ctx);
}
```

**为什么不用 Registry：** 12 个 Area 全在一个代码库里，不是第三方插件。Registry 多了 area-registry.ts 文件 + 每个 Area 多一个 index.ts 入口文件，收益为零。

**新增 Area 的完整步骤（3 步）：**
1. 创建 `areas/xxx/` 目录，实现 render.ts + bind.ts + types.ts + style.css
2. 在 `main.ts` 的 areas 数组中添加一行
3. 在 i18n 翻译文件中添加对应 key

### ID-16: 包间接缝（Seam）设计原则

每个包通过接口（而非实现）与其他包交互。接缝位置：

| 包 | 对外接口（Seam） | 适配器（Adapter） |
|----|-----------------|-------------------|
| `persistence` | `initializeV2Database()` | SQLite 实现 |
| `companion` | `CompanionRepository` | SQLite Repository |
| `memory` | `MemoryStore` / `EntityStore` / `SemanticStore` | SQLite Repository |
| `gateway-channels` | `ChannelStore` | SQLite Channel CRUD |
| `gateway-cost` | `CostTracker` | 内存聚合 + SQLite 持久化 |
| `gateway-audit` | `AuditRepository` | SQLite 审计记录 |
| `core` | `createHealthChecker` / `applyPadEvent` / `createCredentialStore` | 纯函数 / SQLite |
| `safety` | `SafetyPolicy` | 规则引擎 |
| `mcp-adapter` | MCP tool 协议转换 | 调用其他包接口 |

**关键原则：**
- 一个适配器 = 假想接缝（当前只有一种实现）
- 两个适配器 = 真实接缝（可以替换实现）
- 测试时注入 mock 适配器 = 接缝发挥作用

### ID-17: 泄漏检测规则

以下模式被视为"泄漏"（Leakage），在 Code Review 中必须消除：

| 泄漏类型 | 示例 | 修复方式 |
|----------|------|----------|
| 前端重复定义领域类型 | types.ts 定义 `Channel` 而非从 domain 派生 | 改为 `type ChannelVM = Channel & {...}` |
| Area 直接 import 另一个 Area | companion/bind.ts import gateway/render.ts | 通过 shared/ 公共组件解耦 |
| 包绕过接口直接访问数据库 | health 包用 `require("better-sqlite3")` 裸 SQL | 改用 persistence 的 Repository |
| Gateway 子模块直接 import 另一个子模块 | gateway-server 内部直接调用 gateway-channels 的 SQLite | 通过 ChannelStore 接口注入 |
| MCP adapter 包含业务逻辑 | McpMemoryStore 自己实现记忆读写 | 改为调用 @agentsoul/memory 接口 |

### ID-18: 删除测试验证清单

重构完成后，执行以下删除测试验证模块独立性：

1. **Area 删除测试**：临时删除 `areas/skills/` 目录，确认项目编译通过（除 skills 相关测试外）
2. **包删除测试**：临时注释 `packages/export` 的 workspace 条目，确认其他包不受影响
3. **前端-领域泄漏测试**：grep `apps/desktop-v2/src/areas/` 确认没有 import 其他 Area 的代码
4. **包间泄漏测试**：grep 每个包的 src/ 确认只 import 自己的 dependencies 中声明的包
5. **数据库泄漏测试**：grep 除 persistence 外的所有包，确认没有 `require("better-sqlite3")` 裸调用

### ID-19: 新增模块的标准接入流程

**新增一个 Control Center Area：**
```
1. 创建 apps/desktop-v2/src/areas/<name>/
2. 实现 render.ts (返回 HTML) + bind.ts (注册事件) + types.ts (Area 专属类型) + style.css (BEM)
3. 创建 index.ts 调用 registerArea()
4. 在 main.ts 添加 import "./areas/<name>"
5. 在 i18n/zh.json 和 i18n/en.json 添加翻译 key
6. 在 areas/<name>/CLAUDE.md 描述接口和约束
```

**新增一个 npm workspace 包：**
```
1. 创建 packages/<name>/ 目录
2. 实现 src/index.ts 导出公开接口
3. 创建 package.json (name: @agentsoul/<name>)
4. 创建 tsconfig.json (paths 映射)
5. 在根 package.json workspaces 中注册
6. 在需要依赖它的包的 package.json dependencies 中添加
7. 在 packages/<name>/CLAUDE.md 描述接口和约束
```

---

## Testing Decisions

### TD-1: 好的测试标准

- 只测试外部行为（render 输出、bind 后的 DOM 状态变化、API 响应）
- 通过公开接口驱动，不依赖内部函数名或文件结构
- 每个测试用例独立，不依赖执行顺序

### TD-2: 前端 Area 测试

每个 Area 目录包含 `__tests__/` 子目录：
- `render.test.ts` — 测试 render 输出包含预期的 data 属性和结构
- `bind.test.ts` — 测试 bind 注册的事件监听器在交互后产生预期状态变化
- 参考：`apps/desktop-v2/tests/companion-view.test.mjs`

### TD-3: 包级测试

每个合并后的包保留独立 `tests/` 目录：
- `@agentsoul/core` — health checker、PAD 计算、credential store
- `@agentsoul/memory` — 分层记忆读写、实体 CRUD、语义搜索
- `@agentsoul/gateway-*` — 频道路由、成本计算、审计记录

### TD-4: 契约测试

`tests/v2/` 中的 39 个契约测试在重构后必须全部通过。需要更新包名断言。

### TD-5: 回归测试策略

每个工作流完成后运行：
1. `npm run v2:test` — 全部契约测试
2. `npm run v2:typecheck` — TypeScript 类型检查
3. 各包独立测试
4. `npm run v2:build` — 前端构建

### TD-6: Tauri 桌面应用冒烟测试

启动 `npm run v2:tauri dev` 后验证：
- Control Center 窗口正常显示
- 所有 12 个 Tab 切换正常
- 桌面伴侣窗口可拖拽并自动吸附
- 右键菜单正常工作
- 交互按钮（Feed/Play/Pet/Sleep）正常响应

### TD-7: Snapshot 测试

使用 `apps/desktop-v2/tests/helpers/snapshot.js` 的现有 snapshot 工具验证 render 输出稳定性。

### TD-8: 模块独立性测试

新增测试文件验证模块间无泄漏：

**Area 独立性测试** (`apps/desktop-v2/tests/area-independence.test.mjs`)：
- 遍历所有 `areas/*/` 目录
- 读取每个 Area 的 render.ts 和 bind.ts
- 断言：没有 Area import 其他 Area 的代码（只允许 import shared/ 和 area-registry）
- 断言：每个 Area 的 render 函数签名匹配 `(ctx: AreaContext) => string`
- 断言：每个 Area 的 bind 函数签名匹配 `(ctx: AreaContext) => void`

**包独立性测试** (`tests/v2/package-independence.test.mjs`)：
- 遍历所有 `packages/*/package.json`
- 读取每个包的 dependencies
- 读取每个包的 src/index.ts 中的 import 语句
- 断言：所有 import 的包都在 dependencies 中声明
- 断言：没有包 import 被合并删除的旧包名（runtime、entity、semantic 等）

**数据库泄漏测试** (`tests/v2/database-leakage.test.mjs`)：
- 遍历除 persistence 外的所有包
- 断言：没有包包含 `require("better-sqlite3")` 或 `import Database from "better-sqlite3"` 的调用
- 例外：persistence 包允许

### TD-9: 接缝（Seam）验证测试

验证每个包的对外接口是稳定的：

**接口导出测试** (`tests/v2/interface-exports.test.mjs`)：
- 读取每个包的 `src/index.ts`
- 记录所有 `export` 语句
- 断言：导出数量在合理范围内（不超过 20 个）
- 断言：没有导出内部实现细节（以 `_` 前缀命名的内部函数）

### TD-10: 删除测试（自动化）

新增测试文件，自动化验证删除测试：

**Area 删除测试** (`tests/v2/area-deletion.test.mjs`)：
- 选择一个非核心 Area（如 skills）
- 临时重命名其目录
- 运行 TypeScript 编译
- 断言：编译通过（除 skills 相关的测试文件外）
- 恢复目录

**包删除测试** (`tests/v2/package-deletion.test.mjs`)：
- 选择一个非核心包（如 export）
- 临时从 package.json workspaces 中移除
- 运行 TypeScript 编译
- 断言：其他包的编译不受影响
- 恢复 workspaces 配置

---

## Out of Scope

1. **迁移到 React 18 + shadcn/ui**：ADR-0009 指定的目标技术栈，本次不涉及框架迁移。
2. **迁移到 Zustand 状态管理**：保持当前 localStorage + re-render 模式。
3. **CSS Modules / Tailwind 迁移**：保持原生 CSS，通过 BEM 命名和文件拆分实现隔离。
4. **云端同步 / WebDAV**：符合 ADR-0005（Local-first），不涉及远程同步。
5. **通用数据迁移框架**：mcp_memory_records → memory_entries 的迁移在本次处理，但不提供通用框架。
6. **CI/CD 流水线重建**：旧 Python CI 已删除，新 CI 配置作为独立任务。
7. **性能优化**：本次关注模块化和可维护性，不关注运行时性能。

---

## Further Notes

### 执行顺序

所有工作流一次性完成，不分 Phase。内部执行顺序：

```
 1. 浅模块合并（包结构变更）
 2. Gateway 内部拆文件（依赖包结构变更）
 3. 记忆去重（依赖包结构变更）
 4. 前端 Area 拆分（依赖包结构变更后的 import 路径）
 5. 文档与配置同步（CLAUDE.md + README.md + CONTEXT.md + ADR-0011）
 6. 模块独立性测试（依赖所有结构变更完成）
 7. 全面复查与验证（测试 + 构建 + 冒烟测试 + 删除测试）
```

### 核心设计理念

本次架构深化遵循以下设计理念（吸收自外部架构审查报告）：

**1. 接缝（Seam）优先**
- 模块之间通过接口连接，而非直接 import 实现
- 接口就是测试面 — 接口稳定，测试就不需要频繁修改
- 一个适配器 = 假想接缝，两个适配器 = 真实接缝

**2. 泄漏（Leakage）检测**
- 前端层不应重复定义领域类型（类型泄漏）
- Area 之间不应直接 import 彼此的代码（依赖泄漏）
- 包不应绕过接口直接访问数据库（实现泄漏）
- Gateway 子模块不应直接 import 另一个子模块的内部实现

**3. 删除测试（Deletion Test）**
- 想象删除一个模块：如果复杂性消失了，它是透传的（浅模块）
- 如果复杂性在 N 个调用处重新出现，它在发挥作用（深模块）
- 删除一个 Area 应该只需要删除它的目录，不修改任何其他文件

**4. 插件化扩展（Plugin Architecture）**
- 新增 Area = 创建目录 + 实现接口 + 注册到 Registry
- 新增包 = 创建目录 + 实现接口 + 注册到 workspaces
- 零现有文件修改 = 真正的模块独立性

### 影响范围统计

| 类别 | 文件数 |
|------|--------|
| 根配置文件 | 3 |
| 包级 package.json | 18 |
| 包级 tsconfig.json | 14 |
| 包级源文件（import 更新） | 17 |
| 包级测试文件（import 更新） | 13 |
| 契约测试（包名断言更新） | 39+ |
| 桌面应用文件 | 2 |
| 文档文件 | 8+ |
| 新增文件（.claude/rules/、.claude/skills/、局部 CLAUDE.md） | 30+ |
| 新增测试文件（模块独立性、删除测试、泄漏检测） | 5+ |
| 删除目录（合并的包） | 8 |
| **总计** | **~160 个文件** |

### 风险评估

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|----------|
| import 路径遗漏 | 中 | 中 | TypeScript 编译检查 + 全量测试 |
| 契约测试包名断言遗漏 | 中 | 低 | grep 所有 @agentsoul/* 引用 |
| Gateway 拆分破坏 sidecar 模式 | 低 | 高 | 保留 startLocalGateway() 接口不变 |
| 记忆去重时数据丢失 | 低 | 高 | 先复制再废弃，保留兼容读取期 |
| Tauri 桌面应用回归 | 中 | 高 | 冒烟测试覆盖所有 Tab 和交互 |

### 核心设计决策

| 决策 | 选择 | 理由 |
|------|------|------|
| Area 组装方式 | 简单 const 数组 | 12 个 Area 不需要 Registry 抽象 |
| `core` 包 | 不创建，合并进 `companion` | Companion 是核心实体，PAD/健康/人格是它的属性 |
| `security` 归属 | 合并进 `provider` | 凭据是 Provider 认证的一部分 |
| Gateway 拆分 | 一个包，内部拆文件 | Gateway 是一个功能模块 |
| 前端-domain 耦合 | 现在就耦合 | 不 defer，一步到位 |
| 记忆去重 | 直接删表 | 两个表都为空，不需要迁移 |
| Claude Code 集成 | 砍掉 | .claude/skills 是开发工具，不是项目的一部分 |
