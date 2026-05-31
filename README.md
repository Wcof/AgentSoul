# AgentSoul v2 · Local-first AI Agent Companion

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)

## 📖 项目介绍

**AgentSoul v2** 是一个本地优先的 AI Agent 伴侣框架，使用 TypeScript + Tauri 构建。它提供了一个可拖拽、自动吸附的桌面宠物伴侣，以及一个功能完整的控制中心界面。

### 核心特性

- 🐾 **桌面伴侣** — Canvas 2D 精灵动画桌面宠物，支持拖拽和屏幕边缘自动吸附
- ⚡ **控制中心** — Tab 导航的全功能配置界面（伴侣、网关、技能、会话、安全、设置等）
- 🔌 **本地网关** — HTTP 服务端，支持频道路由、成本追踪、审计记录、Agent Loop
- 🧠 **分层记忆** — 日/周/月/年时间切片 + 主题记忆 + 核心记忆 + 实体记忆 + 语义搜索
- ❤️ **PAD 情感模型** — 三维情感空间（愉悦度/唤醒度/支配度），驱动伴侣自主行为
- 🔒 **安全策略** — 三级安全模型（PUBLIC/PROTECTED/SEALED）+ 审批流程 + 风险通知
- 🌐 **双语支持** — 中文/英文界面动态切换
- 🔌 **MCP 适配** — Model Context Protocol 集成
- 💬 **伴侣对话** — 内置聊天控制器，支持上下文压缩和自主循环
- 🐾 **宠物资源包** — 可切换的形象包系统，支持本地/远程资源加载
- 🏠 **Tauri 原生集成** — IPC 通信、本地资产加载、原生窗口管理

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
npm run companion:test      # 伴侣运行时 + 灵魂 + 提示词 + PAD
npm run gateway:test        # 网关服务 + Agent Loop + 直调
npm run safety:test         # 安全策略引擎
npm run skills:test         # 技能包管理
npm run sessions:test       # 会话管理
npm run persistence:test    # SQLite 持久化层
npm run provider:test       # 提供商配置 + 凭证存储
npm run mcp-adapter:test    # MCP 协议适配
npm run export:test         # 数据导出
npm run memory:test         # 分层记忆 + 实体 + 语义

# 运行前端测试
npx vitest run apps/desktop-v2/tests/

# 运行所有包测试
vitest run
```

### 类型检查

```bash
npm run v2:typecheck       # 前端类型检查
npm run domain:typecheck   # 领域类型
npm run companion:typecheck
npm run gateway:typecheck
npm run safety:typecheck
npm run memory:typecheck
# ... 各包均有 :typecheck 命令
```

---

## 📁 项目结构

```
AgentSoul/
├── apps/
│   └── desktop-v2/                # Tauri 桌面应用
│       ├── src/                   # 前端 (TypeScript)
│       │   ├── main.ts            # 入口，启动引导
│       │   ├── renderers.ts       # HTML 渲染函数
│       │   ├── controller.ts      # 事件绑定与交互逻辑
│       │   ├── canvas-renderer.ts # Canvas 2D 精灵动画
│       │   ├── chat-controller.ts # 伴侣聊天控制器
│       │   ├── chat-renderer.ts   # 聊天界面渲染
│       │   ├── styles.css         # 全部 CSS + Tab 路由
│       │   ├── types.ts           # TypeScript 接口定义
│       │   ├── areas/             # 控制中心各功能区域
│       │   │   ├── companion/     # 伴侣配置区
│       │   │   ├── conversations/ # 对话区
│       │   │   ├── costs/         # 成本统计区
│       │   │   ├── gateway/       # 网关配置区
│       │   │   ├── mcp/           # MCP 适配区
│       │   │   ├── prompts/       # 提示词管理区
│       │   │   ├── safety/        # 安全策略区
│       │   │   ├── sessions/      # 会话区
│       │   │   ├── sessions-mgr/  # 会话管理区
│       │   │   ├── settings/      # 设置区
│       │   │   ├── settings-full/ # 完整设置区
│       │   │   └── skills/        # 技能区
│       │   ├── shared/            # 共享 UI 组件
│       │   ├── i18n/              # 双语 (zh/en) 国际化
│       │   └── utils/             # 工具：弹窗、右键菜单、窗口吸附
│       ├── src-tauri/             # Rust 后端 (Tauri v2)
│       │   └── src/lib.rs         # Tauri 命令，资产加载
│       └── tests/                 # 前端测试
├── packages/
│   ├── domain/                    # 共享领域类型（纯类型，无依赖）
│   ├── companion/                 # 核心：运行时、PAD、健康、配置、灵魂、自主行为
│   ├── gateway/                   # 本地 HTTP 网关（频道、成本、审计、Agent Loop）
│   ├── persistence/               # SQLite 初始化、迁移、ControlPlaneStore
│   ├── sessions/                  # 会话管理 + SessionRepository
│   ├── provider/                  # 提供商配置 + 凭证存储
│   ├── safety/                    # 安全策略引擎 + 审批流程
│   ├── skills/                    # 技能包管理
│   ├── memory/                    # 统一：分层记忆 + 实体 + 语义搜索
│   ├── mcp-adapter/               # MCP 协议适配（协议转换）
│   └── export/                    # 数据导出
├── tests/
│   └── v2/                        # 跨包契约测试
├── docs/
│   ├── adr/                       # 架构决策记录 (ADR)
│   └── v2/                        # v2 文档（PRD、TDD 计划）
└── data/
    └── desktop-v2/                # SQLite 数据库 + 宠物资源
```

---

## 🏗️ 架构

### 桌面伴侣

- Canvas 2D 精灵动画，支持多形象包切换
- 拖拽移动 + 屏幕边缘自动吸附（30px 阈值）
- 右键上下文菜单（喂食、玩耍、抚摸、睡觉）
- 双击切换形象包
- 内置聊天界面，支持上下文压缩

### 控制中心

- 基于 `data-active-tab` 属性的 CSS 路由
- 12 个功能区域：伴侣、网关、技能、会话、对话、成本、安全、设置、MCP、提示词等
- App 切换器支持多应用管理
- 各区域独立模块，按需加载

### 伴侣智能

- **PAD 情感模型**：三维情感空间驱动伴侣行为
- **自主循环**：基于情感状态生成自主行为
- **灵魂系统**：持续演化的伴侣个性与记忆
- **Agent Loop**：网关侧多轮对话编排
- **上下文压缩**：自动压缩长对话上下文

### 安全模型

| 级别 | 说明 |
|------|------|
| PUBLIC | 可在对话中直接引用 |
| PROTECTED | 仅内部使用 |
| SEALED | 严格禁止输出（API 密钥等） |

---

## 📝 架构决策记录

| ADR | 标题 |
|-----|------|
| 0001 | 运行时状态归数据库所有 |
| 0002 | 网关路由默认提供商激活 |
| 0003 | 审计记录默认仅存元数据 |
| 0004 | 审批超时拒绝高风险操作 |
| 0005 | 本地优先的伴侣 |
| 0006 | 使用 TypeScript + Tauri 重写 v2 |
| 0007 | 双语策略 |
| 0008 | 桌面伴侣 + 控制中心 |
| 0009 | v2 技术栈 |
| 0010 | 可停靠深色毛玻璃 UI |
| 0011 | 伴侣智能架构 |

---

## 📄 许可证

MIT License
