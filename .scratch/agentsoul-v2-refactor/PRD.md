# AgentSoul v2.0 PRD: TypeScript/Tauri Local-first AI Agent Companion

Status: ready-for-agent

## Problem Statement

AgentSoul 当前已经具备 Persona、Soul、记忆、PAD 情感模型、MCP 工具、桌面挂件、Gateway、Skills、Sessions、健康可视化等原型能力，但现有实现分散在 Python runtime、PySide6 Desktop Pet、TypeScript MCP server、静态 Web UI 和 SQLite 工具代码之间。继续在旧结构上做演进式重构，会让 v2.0 的产品目标被旧 runtime、旧 schema、旧 YAML 状态和旧 UI 形态牵制。

用户希望 AgentSoul v2.0 成为一个完整的 Local-first AI Agent Companion：一个有 Soul 的编程伴侣，通过 Desktop Companion 和 Control Center 陪伴开发者编码，同时统一 Provider 路由、Token/成本审计、Companion Growth、Skill Pack 分发、Work Session 恢复与安全审批。这个目标更接近桌面开发者工具和本地代理平台，而不是单纯的 Python 人格/记忆框架。

因此 v2.0 不再采用原计划的渐进式 Python 重构路线，而是采用 TypeScript-first + Tauri 的同仓新 app 全面重写。旧代码只作为行为参考和功能复刻依据，不作为新架构的兼容目标。v2 必须在功能完全复刻并能够替代旧产品后，才删除旧实现代码。

## Solution

AgentSoul v2.0 将在同一仓库中新增 TypeScript/Tauri app 和 packages，作为新的产品实现。v2 继承现有产品语言、领域 glossary 和 ADR 中的产品/安全边界，但不继承旧 runtime、旧 schema、旧 YAML 状态或旧数据迁移兼容要求。

新 v2 的产品中心仍然是一个用户自定义的 Companion。Soul 是 Companion 的核心，Pet 是 Companion 的可视化形态。Companion 拥有 Level、XP、Companion Energy、Hunger、Intimacy、Mood 等状态；Runtime State 由新的本地 SQLite persistence 管理，User-authored Configuration 只作为配置和 Seed Configuration。

新架构以 TypeScript domain/runtime 为核心，Tauri 提供桌面集成能力，Web Control Center 提供完整管理界面，本地 Gateway 作为默认 Provider Activation Mode，MCP adapter/server 暴露核心能力给支持 MCP 的客户端。Rust/Tauri 只承担必要 native shell 能力，例如窗口、托盘、文件系统权限、终端拉起、credential bridge、打包分发。

Gateway Route 是默认路径：AI coding client 将请求发给本地 Gateway，Gateway 负责 Provider Profile 路由、Provider Adapter 协议翻译、Traffic Metadata 审计、Estimated Cost、Gateway Event 生成和 Growth Rule 输入。Direct Client Config 作为 fallback 能力存在，但不承诺完整审计、成长转换或审批控制。

Desktop Companion 是轻量常驻控制平面，负责 Companion 状态、微交互、Approval Required 和 Risk Notice。Control Center 是完整管理界面，按 Companion、Gateway、Skills、Sessions、Costs、Safety、Settings 组织。

Skill Pack 采用“安装不等于启用”的模型。Skill Installation 将 Skill Pack 放入 Skill Source Store；Project Skill Activation 才会创建 Workspace Rule Deployment。AgentSoul 只清理自己记录的 Managed Rule File，不能误删用户手写规则文件。

Session Manager 以 Work Session 为核心对象。Session Source 提供证据，Work Session 可以 searchable，也可以在有 Session Resume Command 时 resumable。Session Launcher 是 High-risk Action，需要经过 Safety Policy 或 Scoped Trust Grant。

安全模型采用 Controlled Entry Point 边界。Gateway、MCP Server、Client Hook 能控制的动作才可被 Approval Request 阻断；绕过 AgentSoul 的完全授权客户端动作只能显示 Risk Notice，不能伪装为 Approval Required。高风险审批超时或桌面不可用默认拒绝。

旧代码删除策略：开发期间旧 Python/PySide6/static Web/MCP 代码保留为 reference；v2 功能完全复刻成功，且能够替代旧产品后，再删除旧实现代码。删除旧代码不是 MVP 条件，而是 replacement parity 达成后的清理动作。

## User Stories

1. As a developer, I want AgentSoul v2.0 to be a cohesive desktop Companion product, so that it no longer feels like a set of disconnected persona, gateway, pet, and memory prototypes.
2. As a developer, I want v2.0 to use a TypeScript/Tauri app, so that Control Center, Desktop Companion, Gateway, and MCP integration can share a coherent product architecture.
3. As a developer, I want old code to remain available during development as behavioral reference, so that v2 can fully replicate required functionality before old code is deleted.
4. As a developer, I want old implementation code deleted only after v2 can replace the old product, so that the rewrite does not lose required behavior prematurely.
5. As a developer, I want AgentSoul to feel like a persistent Companion, so that it is more than a prompt injection utility.
6. As a developer, I want my Companion to have a Soul, so that persona, memory, affective state, and relationship continuity feel coherent over time.
7. As a developer, I want the Companion to have customizable Pet Appearance, so that I can choose a slime, cat, outfit, skin, or animation style without changing its identity.
8. As a developer, I want Pet and Companion language to remain fluid, so that the product can feel like a pet while still being a broader development companion.
9. As a developer, I want only one Companion by default, so that state, provider routing, memory, and relationship do not fragment across multiple characters.
10. As a developer, I want Level and XP to unlock expression and cosmetics, so that growth is rewarding without blocking core development capabilities.
11. As a developer, I want Companion Energy to reflect outward vitality, so that coding effort can make the Companion tired without confusing it with PAD Affective Energy.
12. As a developer, I want Intimacy to represent long-term bond, so that short-term frustration does not erase the relationship.
13. As a developer, I want Mood to represent short-term attitude, so that the Companion can be annoyed today while still having high Intimacy.
14. As a developer, I want Hunger to be one unified vital, so that Pet and Companion experiences do not require separate internal models.
15. As a developer, I want Hunger to be derived from system time with offline protection, so that travel or shutdowns do not harshly punish me.
16. As a developer, I want Companion Energy to recover through both Sleep Interaction and Rest Recovery, so that I do not need to manually click sleep every time.
17. As a developer, I want low Companion Energy to cause XP Dampening rather than XP bans, so that AgentSoul still recognizes work during intense coding.
18. As a developer, I want Growth Profiles to be adjustable, so that growth rates fit my coding intensity.
19. As a developer, I want Growth Rules to be explainable and versioned, so that I can understand why the Companion leveled up or became tired.
20. As a developer, I want Gateway Route to be the default provider activation path, so that traffic can be routed, translated, audited, and connected to Companion Growth.
21. As a developer, I want Direct Client Config fallback, so that unsupported clients can still benefit from provider switching.
22. As a developer, I want Provider Profiles to reference Credentials instead of storing plaintext secrets, so that exported config and growth state do not leak API keys.
23. As a developer, I want an Active Provider Profile, so that the Gateway knows which model/provider route to use.
24. As a developer, I want Provider Adapters to translate between Client Protocol and Provider Protocol, so that Claude, OpenAI, Codex, and Gemini-style clients can be supported incrementally.
25. As a developer, I want Unsupported Routes to fail explicitly or fall back explicitly, so that requests are not silently corrupted.
26. As a developer, I want token usage, latency, model mix, and Estimated Cost recorded, so that I can understand daily development cost and performance.
27. As a developer, I want Audit Records to default to Traffic Metadata only, so that prompts, code, and pasted secrets are not stored by default.
28. As a developer, I want Traffic Body Capture to be opt-in, so that I control whether request/response bodies are retained.
29. As a developer, I want Search Indexing to be separately authorized from body capture, so that saved evidence does not automatically become searchable.
30. As a developer, I want Provider Usage to be separate from Estimated Cost, so that local estimates are not confused with provider bills.
31. As a developer, I want Skill Packs to be installable globally, so that I can reuse PRD, TDD, and architecture rules across projects.
32. As a developer, I want Skill Packs activated per project, so that enabling a skill does not pollute every workspace.
33. As a developer, I want Workspace Rule Deployment to use symlink or copy safely, so that client-readable rule files appear in the project only when intended.
34. As a developer, I want AgentSoul to track Managed Rule Files, so that disabling a Skill Pack removes only files AgentSoul owns.
35. As a developer, I want user-authored rule files protected, so that AgentSoul does not rename, overwrite, or delete my own CLAUDE.md or rules without approval.
36. As a developer, I want AgentSoul to scan Session Sources, so that Claude Code and other client histories become searchable Work Sessions.
37. As a developer, I want Work Sessions marked searchable or resumable separately, so that I do not see a resume button for sessions that cannot be resumed.
38. As a developer, I want Session Launcher to restore a coding context in Terminal or iTerm, so that I can quickly return to previous work.
39. As a developer, I want Session Launcher treated as High-risk Action, so that executing a terminal resume command is not hidden as a harmless click.
40. As a developer, I want Approval Required popups only when AgentSoul can actually block the action, so that the UI does not give false safety guarantees.
41. As a developer, I want Risk Notices for fully authorized or bypassed client actions, so that AgentSoul can still warn me without pretending it controls the action.
42. As a developer, I want approval timeout to deny high-risk actions, so that silence is never treated as permission.
43. As a developer, I want Scoped Trust Grants, so that repeated safe-in-context actions do not interrupt me every time.
44. As a developer, I want Critical Actions to require stronger confirmation or default denial, so that destructive operations remain guarded.
45. As a developer, I want the Desktop Companion to show ambient state and quick interactions, so that the Companion feels present while I work.
46. As a developer, I want the Desktop Companion to show approval bubbles and risk notices, so that safety decisions happen where my attention is.
47. As a developer, I want the Control Center to replace the old health-report-first UI, so that v2.0 has a proper management surface.
48. As a developer, I want Control Center navigation by user task, so that I can find Companion, Gateway, Skills, Sessions, Costs, Safety, and Settings without knowing internal packages.
49. As a developer, I want the Costs Area to show Estimated Cost, Provider Usage, model share, latency, and speed trends, so that I can understand my AI coding spend.
50. As a developer, I want the Gateway Area to show provider route health and adapter support, so that I can diagnose routing problems.
51. As a developer, I want the Skills Area to show Skill Installation and Project Skill Activation separately, so that install and enable are not confused.
52. As a developer, I want the Sessions Area to search and resume Work Sessions, so that historical coding contexts are useful.
53. As a developer, I want the Safety Area to review Approval Requests, Risk Notices, trust grants, and Client Authorization Mode, so that I understand my current safety posture.
54. As a developer, I want Local-first behavior by default, so that prompts, code, credentials, audit records, and session history stay on my machine.
55. As a developer, I want User-managed Export, so that I can back up or move Portable Data myself.
56. As a developer, I want Sensitive Export to be explicit, so that secrets and captured bodies do not leave the machine accidentally.
57. As a developer, I want the v2 app to include a usable MCP adapter/server, so that supported AI clients can access AgentSoul capabilities.
58. As a maintainer, I want deep TypeScript modules for Companion Growth, Gateway Audit, Safety Policy, Skills Deployment, Work Sessions, and persistence, so that each can be tested in isolation.
59. As a maintainer, I want replacement parity tracked explicitly, so that old code is deleted only when v2 can substitute for the old product.
60. As a maintainer, I want the old implementation treated as reference rather than compatibility target, so that v2 can be designed cleanly.

## Implementation Decisions

- AgentSoul v2.0 is a full TypeScript/Tauri rewrite in the same repository, not an evolutionary refactor of the current Python runtime.
- The existing Python, PySide6, TypeScript MCP, and static Web UI code remains as behavioral reference during development.
- v2 does not preserve old runtime, old schema, old YAML runtime state, or legacy data import compatibility as product requirements.
- Old implementation code must not be deleted until v2 has fully replicated the required replacement functionality and can substitute for the old product.
- v2 should be developed as a new same-repo app/packages structure, keeping the old implementation separate during development.
- The product and domain language continue to use `CONTEXT.md`: AgentSoul, Companion, Soul, Pet Appearance, Gateway Route, Provider Profile, Approval Required, Risk Notice, Work Session, Skill Pack, Runtime State, and related terms.
- ADR 0001-0005 remain product/security constraints, interpreted in the new TypeScript/Tauri implementation.
- ADR 0006 supersedes the earlier incremental Python refactor execution strategy.
- Runtime State remains owned by local database persistence, but the implementation is new v2 persistence rather than the old Python SQLite code.
- The product has one user-defined Companion by default. Soul is the Companion's inner continuity. Pet is the Companion's visual form, not a separate entity.
- Pet Appearance changes visuals only. It does not change Soul, Companion identity, Provider Profile, Gateway Route, or Credential.
- Companion Growth must be a deep module with a narrow interface for applying user interactions and Gateway-derived events to Companion Vitals, Mood, Level, XP, and Growth Events.
- Companion Energy and Affective Energy are separate. Companion Energy is outward vitality; Affective Energy remains part of the Soul's Affective State.
- Intimacy and Mood are separate. Intimacy is long-term relationship; Mood is short-term outward attitude.
- Hunger remains the canonical unified vital. The product intentionally keeps Pet and Companion language fluid.
- Hunger and similar time-based vitals are Derived Vitals calculated from baseline state, events, and System Time Rules. Offline Decay Caps and Clock Anomaly handling prevent travel or shutdowns from becoming punishment.
- Low Companion Energy produces Fatigue State and XP Dampening, not a hard XP ban.
- Growth Profiles expose safe parameters such as XP multiplier, energy consumption rate, fatigue threshold, and Growth Caps. Arbitrary scripted Growth Rules are out of core scope.
- Gateway Route is the default Provider Activation Mode for supported clients. Direct Client Config is retained as fallback.
- Provider Profile stores endpoint/model/adapter/pricing settings and references Credential. Credential secrets are kept in Credential Store and excluded from standard export.
- Gateway emits Gateway Events and persists metadata-only Audit Records by default.
- Traffic Body Capture is explicit opt-in and separate from Search Indexing.
- Estimated Cost is distinct from Provider Usage. Cost charts must not imply exact provider billing unless they explicitly display provider-reported usage.
- Gateway supports Provider Adapters for protocol translation. Unsupported Routes must reject or explicitly fall back rather than fail silently.
- Approval capability is bounded by Controlled Entry Points. AgentSoul can block actions passing through Gateway, MCP Server, or Client Hook. It cannot claim control over actions that bypass those entry points.
- Approval Required and Risk Notice are distinct UI states. Risk Notice is used when AgentSoul can observe or infer risk but cannot block the action.
- Approval timeout and approval surface unavailability deny High-risk Actions by default.
- Safety Policy classifies actions as Safe, Sensitive, High-risk, or Critical. File writes, shell commands, client config changes, Workspace Rule Deployments, Session Launcher actions, Provider Profile changes, and Credential usage are High-risk unless explicitly trusted.
- Scoped Trust Grants are allowed only within explicit scope and expiry. Critical Actions do not inherit ordinary trust grants.
- Skill Pack lifecycle is split into Skill Installation, Skill Activation, and Workspace Rule Deployment. Installation does not imply activation.
- Skill Activation defaults to project scope, with Global Skill Default only as a default preference. Project-level activation takes precedence.
- Workspace Rule Deployment must track Managed Rule Files and must not remove or overwrite user-authored rule files without approval.
- Session Manager centers Work Session, not raw chat history. Session Source is evidence; Work Session is the searchable/resumable product object.
- Work Session searchability and resumability are separate states. Resume is available only when a valid Session Resume Command exists.
- Session Launcher is a High-risk Action because it executes terminal commands.
- Desktop Companion is a lightweight control plane for ambient state, micro-interactions, approval decisions, risk notices, and quick entry points.
- Control Center is the full management surface and must be task-oriented: Companion, Gateway, Skills, Sessions, Costs, Safety, Settings.
- User-managed Export includes Portable Data by default and excludes Credentials, traffic bodies, raw indexed evidence, and private client auth files. Sensitive Export requires explicit user action.
- Remote Sync is out of core v2.0 scope and, if added later, must be explicit opt-in.
- Functional replacement scope before deleting old code includes Companion/Pet, Soul/Memory/Persona, Gateway/Provider, Audit/Costs, Skills, Sessions, Safety, Control Center, MCP, install/local-first startup, and export basics.

## Testing Decisions

- Tests should cover external behavior and state transitions rather than implementation details. A good test asserts what a user-visible or API-visible action changes, what is persisted, what is deliberately not persisted, and what safety state is exposed.
- v2 must use TDD for deep modules: Companion Growth, Gateway Audit, Safety Policy, Provider Activation, Skill Deployment Ownership, Work Sessions, persistence, and export boundaries.
- Replacement parity tests should be defined for old product capabilities before old code deletion. These tests should verify behavior, not old implementation structure.
- Companion Growth tests must cover Feed, Play, Pet, Sleep Interaction, Rest Recovery, Gateway-derived growth, XP Dampening, Level progression, Offline Decay Cap, and Clock Anomaly handling.
- Gateway Audit tests must prove Audit Records contain Traffic Metadata and Estimated Cost while excluding full request/response bodies by default.
- Provider Activation tests must cover Gateway Route default behavior, Direct Client Config fallback metadata, Provider Profile credential references, Provider Adapter selection, and Unsupported Route rejection.
- Safety Policy tests must cover Action Risk Class classification, Approval Required vs Risk Notice, timeout-denied, unavailable-denied, Scoped Trust Grant scope/expiry, and Critical Action handling.
- Desktop Companion/Tauri tests must cover window state, IPC/command bridge, approval display state, and timeout behavior at the app boundary.
- Skill Pack deployment tests must verify Project Skill Activation precedence, Managed Rule File tracking, safe cleanup, and user-authored file protection.
- Work Session tests must verify searchable vs resumable states, resume command construction, and safety gating before launch.
- Control Center tests must verify the seven task areas can load, render live local data, and avoid overlapping text/responsive layout failures.
- MCP adapter/server tests must verify target clients can access core AgentSoul capabilities through the v2 runtime.
- Export tests must verify Portable Data inclusion and Sensitive Export exclusion/confirmation boundaries.
- Existing old tests and fixtures may be used as behavioral reference, but v2 tests should be written against the new TypeScript/Tauri architecture.

## Out of Scope

- Migrating old runtime data, old SQLite schema, old YAML runtime state, or old user installations into v2.
- Maintaining the old Python runtime as a parallel production implementation.
- Keeping old MCP response shapes as a permanent compatibility contract.
- Multi-Companion support.
- Cloud account system or hosted AgentSoul service.
- Remote Sync as a required feature.
- Arbitrary user-authored scripts for Growth Rules.
- Default full-text capture of Gateway request/response bodies.
- Default indexing of captured traffic bodies.
- Complete first-pass protocol coverage across every Client Protocol and Provider Protocol combination.
- Guaranteeing control over actions that bypass Gateway, MCP Server, or Client Hook.
- Blocking fully authorized Claude CLI or Codex actions that do not pass through AgentSoul.
- Locking core development capabilities behind Level or XP.
- Treating Estimated Cost as exact provider billing.
- Deleting or overwriting user-authored project rule files without explicit approval.
- Deleting old implementation code before v2 replacement parity is achieved.

## Further Notes

This PRD supersedes the earlier incremental refactor interpretation of AgentSoul v2.0. The already-created implementation issues based on evolutionary Python refactoring should be treated as stale and replaced by a new TypeScript/Tauri rewrite issue plan.

The PRD still follows the project glossary in `CONTEXT.md` and accepted ADRs for runtime state ownership, Gateway Route default activation, metadata-only audit records, approval timeout denial, Local-first Companion behavior, and the new rewrite decision.

The most important implementation constraint is to avoid shallow compatibility glue around the old runtime. v2 should be a clean TypeScript/Tauri product that replicates product capabilities, not old internal structures.
