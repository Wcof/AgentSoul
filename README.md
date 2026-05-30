# AgentSoul v2 · Local-first AI Agent Companion

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)

## 📖 项目介绍

**AgentSoul v2** 是一个本地优先的 AI Agent 伴侣框架，使用 TypeScript + Tauri 构建。它提供了一个可拖拽、自动吸附的桌面宠物伴侣，以及一个功能完整的控制中心界面。

### 核心特性

- 🐾 **桌面伴侣** — 矢量动画桌面宠物，支持拖拽和屏幕边缘自动吸附
- ⚡ **控制中心** — Tab 导航的全功能配置界面（伴侣、网关、技能、会话、安全、设置等）
- 🔌 **本地网关** — HTTP 服务端，支持频道路由、成本追踪、审计记录
- 🧠 **分层记忆** — 日/周/月/年时间切片 + 主题记忆 + 核心记忆 + 实体记忆
- ❤️ **PAD 情感模型** — 三维情感空间（愉悦度/唤醒度/支配度）
- 🔒 **安全策略** — 三级安全模型（PUBLIC/PROTECTED/SEALED）+ 审批流程
- 🌐 **双语支持** — 中文/英文界面动态切换
- 🔌 **MCP 适配** — Model Context Protocol 集成

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Rust（Tauri 桌面构建需要）

### 安装依赖

```bash
npm install
```

### 浏览器开发模式

```bash
# 启动 Vite 开发服务器
npm run v2:dev

# 或者同时启动 Gateway 侧车
cd apps/desktop-v2 && npm run launch
```

### Tauri 原生桌面模式

```bash
npm run v2:tauri dev
```

这会启动两个原生窗口：
- **Desktop Companion** — 280×320 悬浮宠物窗口
- **Control Center** — 1100×760 控制中心窗口

---

## 🧪 测试

```bash
# 运行所有 v2 契约测试
npm run v2:test

# 运行特定包测试
npm run gateway:test
npm run safety:test
npm run runtime:test

# 运行所有测试
vitest run
```

---

## 📁 项目结构

```
AgentSoul/
├── apps/
│   └── desktop-v2/          # Tauri 桌面应用
│       ├── src/             # 前端 (TypeScript)
│       └── src-tauri/       # 后端 (Rust)
├── packages/
│   ├── domain/              # 共享领域类型
│   ├── gateway/             # 本地 HTTP 网关
│   ├── persistence/         # SQLite 持久化层
│   ├── sessions/            # 会话管理
│   ├── runtime/             # 伴侣运行时状态
│   ├── companion/           # 伴侣行为
│   ├── pad-engine/          # PAD 情感引擎
│   ├── safety/              # 安全策略
│   ├── skills/              # 技能管理
│   ├── memory/              # 分层记忆
│   ├── entity/              # 实体记忆
│   ├── mcp-adapter/         # MCP 协议适配
│   └── ...                  # 更多包
├── tests/v2/                # 跨包契约测试
├── docs/adr/                # 架构决策记录
└── data/desktop-v2/         # SQLite 数据库
```

---

## 🏗️ 架构

### 桌面伴侣

- Canvas 2D 精灵动画
- 拖拽移动 + 屏幕边缘自动吸附（30px 阈值）
- 右键上下文菜单（喂食、玩耍、抚摸、睡觉）
- 双击切换形象包

### 控制中心

- 基于 `data-active-tab` 属性的 CSS 路由
- 12 个功能区域：伴侣、网关、技能、会话、对话、成本、安全、设置、MCP、提示词等
- App 切换器支持多应用管理

### 安全模型

| 级别 | 说明 |
|------|------|
| PUBLIC | 可在对话中直接引用 |
| PROTECTED | 仅内部使用 |
| SEALED | 严格禁止输出（API 密钥等） |

---

## 📄 许可证

MIT License
