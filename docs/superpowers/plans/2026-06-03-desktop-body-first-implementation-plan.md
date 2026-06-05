# Desktop Body-first AgentSoul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 AgentSoul 的主运行路径切到 Desktop Body-first，去掉旧 Control Center 的主产品地位，并为 Agent Mind、Memory、Extension Runtime 建立可继续迁移的目录与接口。

**Architecture:** 第一阶段不追求一次删光旧模块，而是先让启动入口、Tauri 窗口默认行为、桌面菜单和主渲染路径都以 Desktop Body 为中心。旧 Control Center 保留为临时遗留实现，但从默认启动、用户可见入口、主路径依赖里退出。

**Tech Stack:** TypeScript, Tauri v2, Vitest, existing desktop companion runtime modules

---

### Task 1: 建立新架构目录壳子

**Files:**
- Create: `apps/desktop-v2/src/desktop-body/index.ts`
- Create: `apps/desktop-v2/src/agent-mind/index.ts`
- Create: `apps/desktop-v2/src/memory/index.ts`
- Create: `apps/desktop-v2/src/extension-runtime/index.ts`
- Test: `apps/desktop-v2/tests/desktop-body-architecture.test.ts`

- [ ] **Step 1: 写失败测试**

检查新目录壳子已经存在，并且导出当前第一阶段会继续复用的最小接口。

- [ ] **Step 2: 创建最小 barrel**

为四个新目录创建 `index.ts`，用最小导出把当前已有模块映射到新语言。

- [ ] **Step 3: 跑测试确认通过**

Run: `npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts`
Expected: PASS

### Task 2: 把主入口切到 Desktop Body-only

**Files:**
- Modify: `apps/desktop-v2/src/main.ts`
- Modify: `apps/desktop-v2/src/shared/app-controller.ts`
- Modify: `apps/desktop-v2/src-tauri/tauri.conf.json`
- Modify: `apps/desktop-v2/src-tauri/src/lib.rs`
- Test: `apps/desktop-v2/tests/dev-entrypoint.test.ts`
- Test: `tests/v2/tauri-desktop-shell-contract.test.mjs`

- [ ] **Step 1: 写/更新失败测试**

测试默认运行只启动 `desktop-companion` 主路径，`control-center` 不再默认可见。

- [ ] **Step 2: 实现入口切换**

让 `main.ts` 默认只走 `desktop-companion`；保留 URL override 仅用于测试和临时遗留调试。

- [ ] **Step 3: 实现窗口默认行为**

让 Tauri 配置里 `control-center` 默认不可见；必要时保留 `show_control_center` 命令作为遗留调试 seam。

- [ ] **Step 4: 跑测试**

Run: `npm exec vitest run apps/desktop-v2/tests/dev-entrypoint.test.ts tests/v2/tauri-desktop-shell-contract.test.mjs`
Expected: PASS

### Task 3: 去掉 Desktop Body 中的旧 Control Center 用户入口

**Files:**
- Modify: `apps/desktop-v2/src/desktop-companion-surface.ts`
- Modify: `apps/desktop-v2/src/desktop-companion-experience.ts`
- Modify: `apps/desktop-v2/src/data/defaultSnapshot.ts`
- Modify: `apps/desktop-v2/src/types.ts`
- Test: `apps/desktop-v2/tests/desktop-companion-experience.test.ts`

- [ ] **Step 1: 写/更新失败测试**

测试桌面右键菜单和快捷能力不再暴露 “控制中心” 入口。

- [ ] **Step 2: 实现菜单收口**

移除桌面工具中的 `control-center`，保留状态、更换形象、刷新、隐藏和对话交互。

- [ ] **Step 3: 收口默认 quick actions**

去掉 `open-control-center` 这类旧主产品语言。

- [ ] **Step 4: 跑测试**

Run: `npm exec vitest run apps/desktop-v2/tests/desktop-companion-experience.test.ts`
Expected: PASS

### Task 4: 更新主产品词汇

**Files:**
- Modify: `CONTEXT.md`
- Modify: `apps/desktop-v2/src/i18n/en.json`
- Modify: `apps/desktop-v2/src/i18n/zh.json`
- Test: `apps/desktop-v2/tests/shell.test.mjs`

- [ ] **Step 1: 更新词汇**

把主产品词汇从 Control Center/Gateway 迁移到 Desktop Body/Agent Mind/Memory/Extension Runtime。

- [ ] **Step 2: 收紧测试**

去掉对旧控制台文案的核心依赖，改成验证 Desktop Body 语义。

- [ ] **Step 3: 跑测试**

Run: `npm exec vitest run apps/desktop-v2/tests/shell.test.mjs`
Expected: PASS

### Task 5: 整体验证

**Files:**
- Verify only

- [ ] **Step 1: 跑类型检查**

Run: `npm --workspace @agentsoul/desktop-v2 run typecheck`
Expected: PASS

- [ ] **Step 2: 跑第一阶段回归**

Run: `npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts apps/desktop-v2/tests/dev-entrypoint.test.ts apps/desktop-v2/tests/desktop-companion-experience.test.ts apps/desktop-v2/tests/shell.test.mjs tests/v2/tauri-desktop-shell-contract.test.mjs`
Expected: PASS

- [ ] **Step 3: 跑原生编译检查**

Run: `cd apps/desktop-v2/src-tauri && cargo check`
Expected: PASS

- [ ] **Step 4: 记录剩余迁移项**

列出仍然存在但已不在主路径的旧模块，作为第二阶段删除清单。
