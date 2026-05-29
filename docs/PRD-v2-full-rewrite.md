# AgentSoul v2 全量重构 PRD

## 当前状态评估 / Current State Assessment

**评估日期 / Assessment Date**: 2026-05-29

### 代码仓库 / Codebase

- **Monorepo**: npm workspaces，11 packages + 3 apps
- **GitHub**: `git@github.com:Wcof/AgentSoul.git`
- **Issues**: 已有 4 个 GitHub Issues（含 PRD issue #1）
- **Labels**: `ready-for-agent`, `ready-for-human`, `enhancement`, `bug`, `stale-plan` 已配置

### 现有 TS 代码状态 / Existing TS Code Status

| 包 / Package | 测试文件 | 当前状态 | 行动 / Action |
|---|---|---|---|
| domain | 1 (空) | v1 类型 (132 行) | 扩展 v2 类型 |
| persistence | 1 | node:test，Vitest 下失败 | 迁移 + 扩展 schema |
| runtime | 1 | 14 tests (node:test)，失败 | 迁移 + 扩展 PAD v2 |
| safety | 1 | 13 tests (node:test)，失败 | 迁移 + 验证 + 扩展 |
| gateway | 1 | 6 tests (node:test)，失败 | 迁移 + 扩展适配器 |
| skills | 1 | 6 tests (node:test)，失败 | 迁移 + 验证 + 扩展 |
| sessions | 1 | 4 tests (node:test)，失败 | 迁移 + 验证 + 扩展 |
| provider | 1 | 4 tests (node:test)，失败 | 迁移 + 验证 + 扩展 |
| security | 1 | 2 tests (node:test)，失败 | 迁移 + 扩展健康检查 |
| export | 1 | 2 tests (node:test)，失败 | 迁移 + 验证 + 扩展 |
| mcp-adapter | 1 | 无有效测试 | 全量重写 |
| desktop-v2 | 3 | node:test，失败 | 迁移 + Tauri 重写 |
| mcp-server | 0 | 基础脚手架 | 全量重写 |
| web | 0 | 空壳 (index.html) | 待实现 |

**关键发现 / Key Findings**:
1. **测试全部失败** — 54 个测试文件使用 `node:test` + `node:assert/strict`，与 Vitest 不兼容。Layer 0 首要修复。
2. **类型覆盖不完整** — `packages/domain` 仅 132 行，缺少 PAD v2、Memory、Entity、Semantic、Config、Health、Export 类型。
3. **新包未创建** — `packages/memory`、`packages/entity`、`packages/semantic` 尚不存在。
4. **workspace 配置不完整** — `apps/web` 和新包未加入 `package.json` workspaces。
5. **domain 测试为空** — `packages/domain/tests/domain-types.test.ts` 无内容。

### 平台支持 / Platform Support

| 平台 | 状态 | 说明 |
|---|---|---|
| macOS | 主要目标 | Tauri v2 原生支持 |
| Windows | 支持 | Tauri v2 原生支持 |
| Web | 部分支持 | Control Center 可独立运行（无桌面浮窗）|

### 需要的包配置更新 / Required Workspace Updates

`package.json` workspaces 需新增：`apps/web`、`packages/memory`、`packages/entity`、`packages/semantic`

## Problem Statement

AgentSoul v1 是一个 Python + TypeScript 混合架构的 AI Agent 人格框架。随着产品边界扩大（桌面伴侣、Gateway 路由、安全审批、技能管理、工作会话），混合架构暴露出三个核心问题：

1. **语言分裂** — 核心逻辑在 Python，MCP Server 在 TypeScript，两套运行时、两套数据格式、两套构建流程，维护成本高且功能不同步。
2. **缺乏桌面体验** — 用户需要一个始终可见的桌面伴侣（类似 Codex），但 v1 只有静态 Web UI 和 CLI。
3. **国际化缺失** — 所有 UI 文案和文档仅英文，对中文用户不友好；人格配置不支持中英双语。

## Solution

将 AgentSoul 全面重构为 TypeScript-first 的 Tauri 桌面应用，实现 15 个核心模块的功能完全替代，提供中英双语支持、桌面浮窗伴侣、完整 Control Center，以及独立可运行的 Gateway 和 MCP Server。

## User Stories

### 人格与陪伴

1. As a user, I want to create a Companion with a customizable name, personality, and role, so that my AI assistant feels personal and unique.
2. As a user, I want to choose my Companion's visual appearance (slime, cat, or custom), so that I can personalize the desktop experience.
3. As a user, I want to change my Companion's skin and outfit without changing its identity or Soul, so that visual customization is independent of personality.
4. As a user, I want to see my Companion as a floating desktop window with animation, so that it provides ambient presence while I work.
5. As a user, I want my Companion to show status bubbles (thinking, idle, fatigued, sleeping), so that I can understand its current state at a glance.
6. As a user, I want to interact with my Companion through quick actions (feed, play, pet, sleep) from the floating window, so that I can care for it without switching contexts.
7. As a user, I want my Companion to grow through development activity (XP, level, energy, hunger, intimacy), so that our relationship deepens over time.
8. As a user, I want low energy to reduce XP gains (dampening) rather than block all growth, so that fatigue is realistic but not punishing.
9. As a user, I want my Companion's hunger to increase over time with an offline decay cap, so that absence (travel, sleep) does not cause extreme punishment.
10. As a user, I want clock anomaly detection, so that system time jumps do not corrupt my Companion's derived vitals.

### PAD 情感引擎

11. As a user, I want my Companion's Soul to have a three-dimensional affective state (Pleasure, Arousal, Dominance), so that its emotional responses are nuanced and believable.
12. As a user, I want my Companion's emotion to be named using Mehrabian's eight-quadrant model (excited_confident, anxious_fearful, etc.), so that I can understand its emotional state intuitively.
13. As a user, I want external events (positive, negative, stress, surprise, conflict) to perturb the Soul's PAD state with configurable intensity, so that the Companion reacts to what happens.
14. As a user, I want consecutive same-type events to amplify each other through emotion resonance, so that sustained experiences have compounding emotional impact.
15. As a user, I want the Soul's PAD state to drift back toward its personality baseline over time (time decay), so that the Companion's core personality is stable.
16. As a user, I want drift detection that reports when the Soul's PAD state deviates significantly from baseline, so that I can be aware of personality drift.
17. As a user, I want the PAD baseline itself to update slowly from interaction history, so that the Companion's personality can naturally evolve over long periods.
18. As a user, I want emotion snapshots recorded as a trajectory over time, so that I can visualize emotional history in the Control Center.

### 分层记忆

19. As a user, I want memories organized by time layers (day, week, month, year) and topics, so that information is structured and retrievable.
20. As a user, I want the system to automatically index new memories for semantic search after each write, so that I can find relevant memories without manual effort.
21. As a user, I want memories to have priority levels (low, medium, high) and tags, so that important information surfaces first.
22. As a user, I want to search memories by semantic similarity, not just keyword matching, so that I can find conceptually related information.
23. As a user, I want deduplication detection when adding new memories, so that redundant information is flagged before being stored.
24. As a user, I want to merge similar memories into a single consolidated entry, so that my memory store stays clean over time.
25. As a user, I want memory writes to gracefully degrade if the embedding service is unavailable, so that memory storage is never blocked by search infrastructure.

### 实体记忆

26. As a user, I want to track structured knowledge about entities (people, hardware, projects, concepts, places, services), so that the Companion has factual context about my world.
27. As a user, I want each entity to have typed facts with confidence levels and source attribution, so that I can trust and verify the Companion's knowledge.
28. As a user, I want to search entities by name or attribute, so that I can quickly retrieve what the Companion knows about a specific entity.
29. As a user, I want entity facts to be updated or merged when new information arrives, so that the Companion's knowledge stays current.

### Gateway 与 Provider 路由

30. As a user, I want a local Gateway that routes AI client traffic to my chosen Provider Profile, so that I can switch providers without reconfiguring each client.
31. As a user, I want the Gateway to be managed as a Tauri sidecar (auto-start/stop), so that it works seamlessly with the desktop app.
32. As a user, I want the Gateway to also run independently (`npx @agentsoul/gateway serve`), so that CLI and headless environments are supported.
33. As a user, I want Gateway Route as the default Provider Activation Mode, so that traffic is routed, translated, audited, and linked to Companion growth.
34. As a user, I want Direct Client Config as a fallback when Gateway routing is unavailable, so that provider switching still works.
35. As a user, I want Provider Adapters that translate between client protocols and provider protocols, so that different AI clients can talk to different providers.
36. As a user, I want unsupported protocol/profile combinations to be explicitly rejected, so that failures are visible rather than silent.
37. As a user, I want the Gateway to emit Gateway Events for every request, so that traffic is observable.

### 审计与成本

38. As a user, I want every Gateway request to produce a metadata-only Audit Record (model, tokens, latency, cost, outcome), so that I can track usage without exposing my prompts by default.
39. As a user, I want the Audit Record to NOT store request/response bodies by default, so that my code and prompts remain private.
40. As a user, I want estimated cost calculations from Audit Records, so that I can monitor my spending across providers.
41. As a user, I want to view cost trends and provider usage breakdowns in the Control Center, so that I can make informed decisions about my AI usage.

### 安全审批

42. As a user, I want actions classified by risk level (safe, sensitive, high-risk, critical), so that dangerous operations require my explicit approval.
43. As a user, I want high-risk actions to block until I make an approval decision, so that nothing destructive happens without my consent.
44. As a user, I want approval timeouts to default to deny, so that silence never equals permission.
45. As a user, I want unavailable approval surfaces to default to deny, so that the absence of a UI does not allow risky actions.
46. As a user, I want to distinguish Approval Required (blocks until decided) from Risk Notice (informational only), so that I know when action is needed vs. when I'm just being informed.
47. As a user, I want to grant Scoped Trust Grants for specific action classes within defined scopes and time windows, so that I can reduce approval friction for trusted workflows.
48. As a user, I want fully authorized clients to produce Risk Notices instead of Approval Requests, so that I'm informed without being blocked when I've already authorized the tool.

### 技能管理

49. As a user, I want to install Skill Packs that contain prompt rules, templates, and guidance, so that my AI clients get specialized capabilities.
50. As a user, I want Project Skill Activation to override Global Skill Defaults, so that different projects can have different skill configurations.
51. As a user, I want deployed rule files to be tracked as Managed Rule Files, so that deactivation only removes files AgentSoul owns.
52. As a user, I want user-authored rule files to never be deleted or renamed without explicit approval, so that my custom configurations are safe.

### 工作会话

53. As a user, I want development sessions to be automatically discovered from client history logs, so that I can search past work.
54. As a user, I want sessions to be searchable even when they are not resumable, so that I can find context even if the exact session cannot be reopened.
55. As a user, I want session launching to be a high-risk action that goes through safety policy, so that executing terminal commands is properly gated.

### 国际化

56. As a Chinese-speaking user, I want all system UI text (buttons, labels, tooltips, error messages) available in Chinese, so that the product feels native.
57. As an English-speaking user, I want all system UI text available in English, so that the product is accessible internationally.
58. As a user, I want to switch between Chinese and English in Settings, so that I can use the product in my preferred language.
59. As a user, I want my Companion's dialogue and personality expressions to come from the persona config (not system UI), so that switching locale changes UI language but not personality.
60. As a user, I want persona config to support bilingual personality descriptions (descriptionZh / descriptionEn), so that my Companion can express itself in my preferred language.

### Control Center

61. As a user, I want a full Control Center with navigation areas: Companion, Gateway, Skills, Sessions, Costs, Safety, Settings, so that I can manage all aspects of AgentSoul from one place.
62. As a user, I want the Companion Area to show vitals, mood, growth history, emotion trajectory, and appearance settings, so that I can understand and customize my Companion.
63. As a user, I want the Gateway Area to show Provider Profiles, routing health, and adapter status, so that I can manage my AI service connections.
64. As a user, I want the Skills Area to show installed Skill Packs, project activations, and managed rule files, so that I can manage my AI capabilities.
65. As a user, I want the Sessions Area to show searchable and resumable work sessions, so that I can find and resume past development work.
66. As a user, I want the Costs Area to show audit summaries, estimated costs, provider usage, and model mix, so that I can monitor spending.
67. As a user, I want the Safety Area to show approval history, risk notices, and trust grants, so that I can review security decisions.
68. As a user, I want the Settings Area to show persona configuration, locale selection, appearance settings, and health diagnostics, so that I can configure the product.

### 配置管理

69. As a user, I want preset persona templates (friendly, professional, creative, minimal) that I can apply with one click, so that I can quickly set up my Companion.
70. As a user, I want configuration validation that catches errors before they take effect, so that broken configs don't corrupt runtime state.
71. As a user, I want config changes to hot-reload without restarting the application, so that I can iterate quickly.

### 健康检查

72. As a user, I want an automated health check that verifies installation integrity (database, config, MCP registration, Gateway connectivity), so that I can diagnose issues quickly.
73. As a user, I want a companionship continuity report that evaluates long-term relationship quality across five metrics, so that I can understand how engaged I've been with my Companion.

### 数据导出

74. As a user, I want to export my data as Portable Data (settings, growth history, skill activations, non-sensitive metadata), so that I can back up or transfer my Companion.
75. As a user, I want Sensitive Export (secrets, captured bodies, raw evidence) to require explicit confirmation, so that sensitive data is never accidentally exposed.

### MCP Server

76. As a Claude Code or Codex user, I want the MCP Server to expose all AgentSoul capabilities through the Model Context Protocol, so that my AI coding assistant can interact with my Companion.
77. As a user, I want the MCP Server to run as an independent Node.js process, so that it works without the desktop application.
78. As a user, I want the MCP Server to be fully rewritten to call v2 TypeScript packages directly, so that there is a single source of truth for all business logic.

## Implementation Decisions

### Architecture

- **Monorepo**: npm workspaces with `packages/*` (11 domain packages) + `apps/*` (desktop-v2, mcp-server, web)
- **Desktop shell**: Tauri v2 with Rust thin bridge (window management, IPC, SQLite plugin) + TypeScript business logic
- **Dual-window**: Desktop Companion (Canvas 2D floating window) + Control Center (React application)
- **Communication**: Tauri event bus for low-frequency state; SQLite as authoritative source; Canvas local animation for high-frequency data
- **Gateway**: Tauri sidecar lifecycle, also independently runnable (`npx @agentsoul/gateway serve`)
- **MCP Server**: Independent Node.js process, full rewrite calling v2 packages

### Domain Model

New domain types added to `packages/domain`:

- PAD Engine v2: `EmotionLabel` (Mehrabian 8-quadrant), `DriftSeverity`, `PADEventType`, `PADBaseline`, `DriftReport`, `EventPerturbation`, `EmotionSnapshot`
- Memory: `MemoryLayer` (day/week/month/year/topic), `MemoryPriority`, `MemoryEntry`
- Entity: `EntityType` (6 types), `EntityFact`, `Entity`
- Semantic: `SemanticMatch`, `DeduplicationResult`
- Config: `Locale` (zh/en), `PersonaSeed`, `UserSeed`
- Health: `HealthCheckResult`, `HealthReport`, `CompanionshipMetric`, `CompanionshipReport`
- Export: `ExportKind` (portable/sensitive), `ExportManifest`

### Persistence

- SQLite via `better-sqlite3` (ADR-0001)
- Schema already defined in `packages/persistence` with 12 tables
- New tables needed for: layered memory entries, entity memory, semantic vector index, health snapshots, persona config versions
- No migration from Python v1 data — v2 starts fresh (ADR-0006)

### Tech Stack (ADR-0009)

- Frontend: React 18 + shadcn/ui (Radix + Tailwind CSS) + Recharts
- State: Zustand
- Animation: Canvas 2D (Companion floating window)
- i18n: i18next (system UI) + persona config bilingual fields (dialogue)
- Testing: Vitest (replacing node:test)
- Build: Vite
- Monorepo: npm workspaces

### Bilingual Strategy (ADR-0007)

- Code: English names, Chinese comments
- UI: i18n switch (zh/en)
- Docs: Bilingual
- Persona config: Bilingual description fields

### Companion Visual (ADR-0008)

- Default visuals (slime, cat): Pure Canvas 2D vector code, zero external dependencies
- Custom skins: Lottie/SVG file loading
- Visual changes do not affect Companion identity, Soul, or service routing

### Module List (Layer Order)

**Layer 0 — Foundation**
- `packages/domain`: Extend with PAD v2, memory, entity, semantic, config, health, export types
- `packages/persistence`: Extend schema with new tables
- i18n framework setup (`i18next` + `zh.json` / `en.json`)
- Vitest migration (existing 53 tests)

**Layer 1 — Core**
- `packages/runtime`: PAD Engine v2 (event perturbation, drift detection, emotion naming, resonance, time decay, baseline management, energy metrics)
- `packages/runtime`: Companion growth (already partially implemented — verify and extend)
- Config management (template loading, validation, hot reload)

**Layer 2 — Gateway**
- `packages/gateway`: Provider adapters, audit record writer, Gateway event emitter
- `packages/provider`: Provider profile resolution, activation mode switching

**Layer 3 — Safety**
- `packages/safety`: Risk classification, approval lifecycle, trust grants, timeout/unavailable deny (already 13 tests — verify and extend)

**Layer 4 — Capabilities**
- `packages/skills`: Managed rule file ownership, project activation (already 6 tests — verify and extend)
- `packages/sessions`: Work session model, searchable vs resumable, launcher safety (already 4 tests — verify and extend)
- New package `packages/memory`: Layered memory (day/week/month/year/topic), priority, tags
- New package `packages/entity`: Entity memory CRUD, typed facts, confidence
- New package `packages/semantic`: Embedding service, vector store, semantic retriever, deduplication, auto-index pipeline

**Layer 5 — Presentation**
- `apps/desktop-v2`: Tauri dual-window setup
- Desktop Companion: Canvas 2D animation engine, status bubbles, quick interactions
- Control Center: React UI with 7 areas (Companion, Gateway, Skills, Sessions, Costs, Safety, Settings)
- i18n integration

**Layer 6 — Integration**
- `apps/mcp-server`: Full rewrite calling v2 packages
- `packages/export`: Portable and sensitive data export (already 2 tests — verify and extend)
- `packages/security`: Health check, companionship continuity report (already 2 tests — verify extend)
- Gateway sidecar integration

### 已审计的现有 TS 代码 / Audited Existing TS Code

11 packages + 3 apps，共 54 个测试文件。测试使用 `node:test` 语法，与 Vitest 不兼容。需要迁移。功能代码保留并扩展：

| Package | Tests | Action |
|---|---|---|
| domain | typecheck | Extend with new types |
| persistence | 2 | Extend schema |
| gateway | 6 | Extend with adapters/audit |
| safety | 13 | Verify and extend |
| skills | 6 | Verify and extend |
| sessions | 4 | Verify and extend |
| provider | 4 | Verify and extend |
| security | 2 | Extend with health checks |
| runtime | 14 | Extend with PAD v2 |
| export | 2 | Verify and extend |
| mcp-adapter | - | Rewrite to call v2 packages |

## Testing Decisions

- **Framework**: Vitest for all packages and apps
- **Migration**: Existing 53 `node:test` tests migrate to Vitest syntax (describe/it/test compatible)
- **Principle**: Test external behavior through public interfaces, not implementation details. Tests must survive refactors.
- **TDD**: Red-Green-Refactor loop. One test at a time. Vertical slices.
- **Each module tested in isolation**: domain types (typecheck only), persistence (SQLite roundtrip), runtime (growth rules, PAD engine), gateway (adapter translation, audit write), safety (policy decisions), skills (deployment ownership), sessions (searchable/resumable), memory (CRUD + layer semantics), entity (fact management), semantic (embedding + vector search), config (validation + templates), health (check scoring), export (manifest generation).

### Modules Requiring New Test Suites

1. PAD Engine v2 — emotion naming, event perturbation, drift detection, resonance, time decay, baseline update
2. Layered Memory — CRUD per layer, consolidation, priority filtering
3. Entity Memory — upsert, fact merge, search by type/name/attribute
4. Semantic — mock embedding, vector store, retriever, deduplication, merge
5. Config — template application, validation, hot reload
6. Health — component checks, companionship metrics
7. Desktop Companion — Canvas rendering, state subscription, interaction dispatch
8. Control Center — React component tests per area

## Out of Scope

- **v1 Python code deletion** — deferred until v2 is fully verified
- **Remote Sync** — optional future capability, not in v2 (ADR-0005)
- **Full protocol matrix** — only Claude Messages, OpenAI Chat, Codex Responses, Gemini initially
- **Cloud account system** — v2 is local-first (ADR-0005)
- **Multi-Companion support** — v2 centers on one Companion
- **Arbitrary scripted Growth Rules** — users adjust Growth Profile parameters, not write scripts
- **Full text Traffic Body Capture search by default** — metadata-only by default (ADR-0003)

## Further Notes

- Python src/ code (120 files) remains as behavioral reference during v2 implementation
- Existing v1 tests (938 passing) continue to run against Python code during transition
- The v2 PRD supersedes the Python-focused PLAN-deepen-features.md for new development
- All ADRs (0001-0009) are binding constraints for this implementation
