# v2 技术栈选型 / v2 Tech Stack

## 状态

已接受 / Accepted

## 背景 / Context

AgentSoul v2 需要从 Python 迁移到 TypeScript，覆盖 macOS、Windows 桌面端和 Web 端。需要选择前端框架、测试工具、构建工具和 monorepo 管理方案。

## 决策 / Decision

| 层 / Layer | 选型 / Choice | 理由 / Rationale |
|---|---|---|
| 桌面容器 / Desktop shell | Tauri v2 (Rust 胶水 + TS 业务逻辑) | 比 Electron 轻 10x+，Rust 只做薄桥接 |
| 前端框架 / Frontend | React 18 + TypeScript | 三端零额外成本，生态最成熟 |
| UI 组件库 / UI library | shadcn/ui (Radix + Tailwind CSS) | 专业级 Control Center UI |
| 图表 / Charts | Recharts | React 生态原生 |
| 状态管理 / State mgmt | Zustand | 轻量，适合 Tauri IPC |
| Companion 动画 / Animation | Canvas 2D | 桌面浮窗专用，独立于 React |
| 国际化 / i18n | i18next | 成熟稳定，React 集成好 |
| 测试 / Testing | Vitest | 与 Vite 共享配置，API 兼容 Jest |
| 构建 / Build | Vite | Tauri 默认，前端 HMR |
| Monorepo | npm workspaces | 零额外依赖，当前规模够用 |
| 持久层 / Persistence | better-sqlite3 | 已有完整 schema (ADR-0001) |

## 后果 / Consequences

- 现有 `node:test` 测试逐步迁移到 Vitest
- `apps/desktop-v2` 的 Rust 层尽量薄，业务逻辑全在 TS
- 每个 `packages/*` 独立可测试，通过 npm workspaces 互相引用
