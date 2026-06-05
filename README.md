# AgentSoul v2 · Local-first AI Agent Companion

[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![Tauri](https://img.shields.io/badge/Tauri-v2-orange)

## 📖 项目介绍

**AgentSoul v2** 是一个本地优先的 AI Agent 伴侣框架，使用 TypeScript + Tauri 构建。项目基于 **Desktop Body-first** 设计理念，提供了一个可拖拽、自动吸附的原生桌面宠物伴侣悬浮窗，集成了分层记忆与情感行为系统，支持高度扩展。

### 核心特性

- 🐾 **桌面伴侣 (Desktop Body)** — Canvas 2D 精灵动画桌面宠物，支持拖拽和屏幕边缘自动吸附（30px 阈值）。
- 🧠 **决策核心 (Agent Mind)** — 统一负责交互回合 (Interaction Turn)、提示词层级构建、自主行为循环与输出策略决策。
- 💾 **分层记忆 (Memory)** — 日/周/月/年时间切片 + 主题记忆 + 核心记忆 + 实体记忆 + 语义搜索。
- ❤️ **PAD 情感模型** — 三维情感空间（愉悦度/唤醒度/支配度），驱动伴侣在桌面的状态演化。
- 🔌 **扩展运行时 (Extension Runtime)** — 唯一的外部能力装载口，支持动态加载扩展清单、功能注册与调用。
- 🔒 **内嵌安全确认 (Inline Safety)** — 在悬浮窗交互中直接提供轻量化的审批与授权通知。
- 🌐 **双语支持** — 中文/英文界面动态切换。
- 🏠 **Tauri 原生集成** — 进程间通信、本地资产加载、原生透明窗口管理。

---

## 🚀 快速开始

### 环境要求

- Node.js 18+
- Rust（Tauri 桌面构建需要）

### 安装依赖

```bash
npm install
```

### 默认桌面开发模式

```bash
npm run dev
```

这会启动 Tauri 原生桌面端，打开桌面伴侣悬浮窗窗口：
- **Desktop Companion** — 透明无边框总是置顶的宠物窗口。

### 浏览器开发模式

```bash
# 仅启动 Vite 开发服务器
npm run v2:dev
```

### Tauri 原生桌面开发模式

```bash
npm run v2:tauri dev
```

---

## 🧪 测试

```bash
# 运行所有 v2 契约测试与前端测试
npm run v2:test

# 运行特定模块测试
npm run companion:test      # 伴侣运行时 + 灵魂 + 提示词 + PAD 情感
npm run memory:test         # 分层记忆 + 实体 + 语义
npm run provider:test       # 提供商配置 + 凭证存储
npm run persistence:test    # SQLite 持久化层
npm run export:test         # 数据导出

# 运行前端测试
npx vitest run apps/desktop-v2/tests/

# 运行全量 Vitest 测试
npx vitest run
```

### 类型检查

```bash
npm run v2:typecheck       # 前端类型检查
npm run domain:typecheck   # 领域层类型检查
npm run companion:typecheck
npm run memory:typecheck
npm run provider:typecheck
npm run persistence:typecheck
npm run export:typecheck
```

---

## 📁 项目结构

```
AgentSoul/
├── apps/
│   └── desktop-v2/                # Tauri 桌面应用
│       ├── src/                   # 前端 TypeScript 源码
│       │   ├── main.ts            # 入口引导
│       │   ├── renderers.ts       # 全局渲染映射
│       │   ├── controller.ts      # 事件绑定控制器
│       │   ├── types.ts           # 共享前端类型
│       │   ├── styles.css         # 悬浮窗样式与过渡动画
│       │   ├── chat-controller.ts # 内置聊天控制器
│       │   ├── chat-renderer.ts   # 内置聊天界面渲染
│       │   ├── desktop-body/      # [Desktop Body] 模块 (身体、动画、悬浮窗渲染、交互)
│       │   │   ├── animation.ts   # Canvas 2D 精灵动画引擎
│       │   │   ├── surface.ts     # 桌面宠物主体 DOM 渲染与事件绑定
│       │   │   ├── menu.ts        # 快速交互气泡与内嵌对话表单
│       │   │   ├── window.ts      # Tauri 原生窗口交互（拖拽、隐藏、刷新）
│       │   │   ├── appearance-pack.ts # 皮肤资产包解析与动态导入
│       │   │   ├── embedded-panels.ts # 未来内嵌扩展板卡槽
│       │   │   ├── status-actions.ts # 状态小气泡呈现
│       │   │   ├── bootstrap.ts   # 本地运行时引导与状态合并
│       │   │   └── index.ts       # 身体模块 Barrel 导出
│       │   ├── agent-mind/        # [Agent Mind] 模块 (大脑决策、提示词架构、自主行为)
│       │   │   ├── interaction-turn.ts # 交互回合并行构建与 LLM 负载准备
│       │   │   ├── autonomy-loop.ts   # 自主唤醒与行动循环投影
│       │   │   ├── output-strategy.ts # 根据用户状态与紧迫度计算输出模式
│       │   │   ├── prompt-layers.ts   # 三层 Hermes 提示词组装层
│       │   │   └── index.ts           # 决策模块 Barrel 导出
│       │   ├── memory/            # [Memory] 模块 (状态载体、主人画像修正)
│       │   │   ├── soul-document.ts   # 伴侣自身性格核心
│       │   │   ├── master-model.ts    # 用户特征认知模型
│       │   │   ├── memory-store.ts    # 分层长期记忆存取
│       │   │   ├── correction.ts      # 观察学习与主人画像纠正
│       │   │   └── index.ts           # 记忆模块 Barrel 导出
│       │   ├── extension-runtime/ # [Extension Runtime] 模块 (能力注册、外部适配)
│       │   │   ├── manifest.ts        # 扩展声明清单规范
│       │   │   ├── registry.ts        # 运行时扩展与功能注册表
│       │   │   ├── adapter.ts         # 能力适配层与历史遗留项
│       │   │   ├── events.ts          # 执行期总线事件流
│       │   │   └── index.ts           # 扩展模块 Barrel 导出
│       │   ├── shared/            # 共享样式与实用程序
│       │   ├── utils/             # 本地存储、窗口吸附、Tauri IPC 封装
│       │   └── i18n/              # 中英双语翻译包
│       ├── src-tauri/             # Rust 原生后端 (Tauri v2)
│       └── tests/                 # 前端单元测试与冒烟测试
├── packages/
│   ├── domain/                    # 领域共享基础类型（无依赖）
│   ├── companion/                 # 伴侣实体、情绪模型与成长系统
│   ├── persistence/               # 基础数据库初始化与迁移
│   ├── provider/                  # 提供商激活与本地凭证桥接
│   ├── memory/                    # 时间切片分层与语义实体记忆存储
│   └── export/                    # 便携式数据确认与数据导出
├── tests/
│   └── v2/                        # 跨包集成契约测试 (Contract Tests)
├── docs/
│   ├── adr/                       # 架构决策记录 (ADR)
│   └── v2/                        # 项目设计说明与 PRD 文档
└── data/
    └── desktop-v2/                # 初始数据库定义与测试资源包
```

---

## 🏗️ 架构与设计理念

### 1. Body-first (身体优先)
新版架构彻底删除了旧版页面式的控制中心。整个应用仅保留桌面悬浮窗，所有的配置、状态检查、更换皮肤、甚至是敏感操作确认，全部通过悬浮窗内的交互式 DOM 面板（小面板）、动态对话气泡与微型气泡输入框完成。

### 2. Mind-driven (大脑驱动)
伴侣行为并非简单的 LLM 问答。
- **三层提示词结构 (3-Layer Prompt)**：每次对话包含稳定层（魂魄文档）、上下文层（情绪与环境状态）、以及最易发生变化的会话层。
- **输出策略引擎 (Output Strategy)**：计算用户的离线/忙碌状态，自适应地进行静默队列缓冲、通知栏打断或气泡渲染。

### 3. Unified Memory (统一记忆)
将过去碎片化的会话状态存储整合进统一的分层记忆（日/周/月/年）中，并基于 **Master Model** 自主发现主人习惯与特征，支持随时纠偏。

### 4. Registry Extensibility (扩展运行时)
所有未来添加的新功能（包括 MCP、自定义提示模板、特定网络请求）一律通过 **Extension Runtime** 声明为 capability，注册到运行时进行事件分发，不侵入主应用的 UI 和大脑逻辑。

---

## 📄 许可证

MIT License
