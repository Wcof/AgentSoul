# 桌面浮窗 + Control Center 双层架构 / Desktop Companion + Control Center Architecture

## 状态

已接受 / Accepted

## 背景 / Context

AgentSoul v2 需要两种用户交互界面：一个轻量的桌面伴侣（实时状态感知、快速操作），和一个完整的管理面板（Provider 配置、技能管理、审批历史等复杂操作）。参考 Codex 桌面端的做法。

## 决策 / Decision

采用双层架构：

### 桌面浮窗（Desktop Companion）
- **技术**: Tauri WebView + Canvas 2D
- **职责**: Companion 动画渲染、状态气泡、快速交互（feed/play/pet/sleep）、审批通知弹窗
- **通信**: 高频动画数据本地 Canvas 自管理；低频状态变化通过 Tauri 事件总线接收
- **形象**: 基础形象（粘液怪/猫）用纯 Canvas 矢量代码绘制；高级皮肤通过 Lottie/SVG 文件扩展

### Control Center
- **技术**: React 18 + shadcn/ui + Tailwind CSS
- **职责**: 完整管理面板（Companion Area、Gateway Area、Skills Area、Sessions Area、Costs Area、Safety Area、Settings）
- **Gateway Area**: Channel-first 本地控制面；Channel CRUD、健康检查、故障切换、成本指标均基于本地权威存储（SQLite）。
- **通信**: 通过 Tauri invoke 命令读写 SQLite（权威来源），通过事件总线接收实时更新

### 窗口通信
- SQLite 为权威来源（ADR-0001）
- 低频状态（审批通知、能量变化、人格漂移）通过 Tauri `emit`/`listen` 推送
- 高频动画数据（位置、帧状态）Canvas 本地管理不走 IPC

### Gateway 部署
- Gateway 作为 Tauri sidecar 管理生命周期（桌面应用启动时拉起，关闭时停止）
- 也可独立运行（`npx @agentsoul/gateway serve`），支持 CLI 和无桌面环境

## 理由 / Rationale

- 和 Codex 保持一致的双层交互模式
- 浮窗做状态感知和快速操作，复杂管理走独立面板，职责清晰
- Canvas 本地动画不受 IPC 延迟影响，保证流畅度
- Gateway sidecar 模式兼顾桌面用户体验和 CLI 灵活性

## 后果 / Consequences

- `apps/desktop-v2` 包含两个窗口配置（浮窗 + Control Center）
- 需要实现 Tauri 事件总线的 TypeScript 封装
- Gateway 包需要支持两种运行模式（嵌入式 + 独立）
- Canvas 动画引擎需要独立于 React 实现
