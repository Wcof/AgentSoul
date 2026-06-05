# 桌面浮窗 + Control Center 双层架构 / Desktop Companion + Control Center Architecture

## 状态

已取代 / Superseded

本 ADR 保留为历史背景。当前产品路径由 Desktop Body-first 架构取代：Desktop Body 是唯一默认主界面，Agent Mind 负责决策，Memory 负责长期状态，Extension Runtime 负责外部能力装载。旧 Control Center、Channel-first Gateway Area、Sessions/Skills/Safety Areas 不再是当前架构。

## 背景 / Context

历史背景：AgentSoul v2 曾计划提供两种用户交互界面：一个轻量的桌面伴侣（实时状态感知、快速操作），和一个完整的管理面板（Provider 配置、技能管理、审批历史等复杂操作）。该路径后来被 Desktop Body-first 架构取代。

## 决策 / Decision

历史决策曾采用双层架构：

### 桌面浮窗（Desktop Companion）
- **技术**: Tauri WebView + Canvas 2D
- **职责**: Companion 动画渲染、状态气泡、快速交互（feed/play/pet/sleep）、审批通知弹窗
- **通信**: 高频动画数据本地 Canvas 自管理；低频状态变化通过 Tauri 事件总线接收
- **形象**: 基础形象（粘液怪/猫）用纯 Canvas 矢量代码绘制；高级皮肤通过 Lottie/SVG 文件扩展

### Control Center（历史）
- **技术**: React 18 + shadcn/ui + Tailwind CSS
- **职责**: 完整管理面板（Companion Area、Gateway Area、Skills Area、Sessions Area、Costs Area、Safety Area、Settings）
- **Gateway Area**: Channel-first 本地控制面；Channel CRUD、健康检查、故障切换、成本指标均基于本地权威存储（SQLite）。
- **通信**: 通过 Tauri invoke 命令读写 SQLite（权威来源），通过事件总线接收实时更新

### 窗口通信
- SQLite 为权威来源（ADR-0001）
- 低频状态（审批通知、能量变化、人格漂移）通过 Tauri `emit`/`listen` 推送
- 高频动画数据（位置、帧状态）Canvas 本地管理不走 IPC

### Gateway 部署（历史）
- Gateway sidecar 曾计划作为桌面内置模块管理生命周期。
- 当前架构不再内置 `@agentsoul/gateway`；外部工具、MCP、usage 或 provider adapter 能力应通过 Extension Runtime 装载。

### 当前替代路径
- Desktop Body 承担桌面身体、气泡、小面板、右键菜单、状态表达和默认审批入口。
- Agent Mind 承担 interaction turn、prompt layers、自主循环、输出策略和 model transport。
- Memory 承担 Soul Document、Master Model、长期记忆、关系记忆和用户修正。
- Extension Runtime 承担外部工具、MCP、prompt、skill、usage 或 inspector 类能力的 manifest、capability registry、adapter 和 runtime events。

## 理由 / Rationale

- 历史上希望通过双层界面区分快速交互和复杂管理。
- 该理由不再约束当前架构；当前架构优先保证 Agent 有一个连续的 Desktop Body，而不是把能力拆进页面化控制台。
- Canvas 本地动画不受 IPC 延迟影响这一点仍适用于 Desktop Body。

## 后果 / Consequences

- 旧双窗口 Control Center 路径被取代，不再作为默认产品形态。
- 内置 Gateway sidecar、Channel-first Gateway Area、Sessions/Skills/Safety Areas 是历史设计，不是当前功能扩展方式。
- 当前扩展能力通过 Extension Runtime 接入；长期状态通过 Memory 管理；决策通过 Agent Mind 管理。
- Canvas 动画引擎仍需要独立于 React 实现，以支撑 Desktop Body 表达。
