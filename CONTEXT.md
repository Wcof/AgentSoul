# AgentSoul

AgentSoul is an AI Agent companion framework. It gives an AI Agent a persistent inner life and presents that continuity through an interactive development companion.

## Language

**AgentSoul**:
The overall companion framework for AI Agents. It gives a user-defined **Companion** a persistent **Soul** and companion-facing capabilities for development work.
_Avoid_: persona injection tool, pet app

**Non-punitive Companionship**:
The product principle that Companion growth, vitals, and reactions should support companionship and reflection rather than punish the user for travel, rest, absence, shutdowns, or normal work boundaries.
_Avoid_: streak punishment, neglect penalty

**Local-first Companion**:
The product boundary that AgentSoul's core Companion, Gateway, approval, memory, audit, session, and configuration capabilities run locally and do not require cloud services.
_Avoid_: cloud companion, hosted service

**User-managed Export**:
A user-initiated export of AgentSoul data that the user stores, transfers, or backs up themselves.
_Avoid_: remote sync, cloud backup

**Portable Data**:
AgentSoul data that can be included in a standard User-managed Export by default, such as Companion settings, growth history, Skill Pack activation state, non-sensitive Provider Profile details, Work Session metadata, and Traffic Metadata summaries.
_Avoid_: credentials, captured bodies, private auth files

**Sensitive Export**:
An explicit high-risk export that includes secrets, captured traffic bodies, raw indexed evidence, or other sensitive material excluded from Portable Data.
_Avoid_: portable data, routine backup

**Remote Sync**:
An optional future capability to synchronize AgentSoul data outside the local machine. Remote Sync is not required for the core Local-first Companion experience.
_Avoid_: export, local backup

**Soul**:
The persistent inner continuity at the core of the user's **Companion**: its persona, memory, affective state, and long-running relationship with the user.
_Avoid_: prompt, profile, character config

**Companion**:
A user-defined AI development companion with a **Soul** at its core. The product centers on one Companion whose appearance and capabilities can be customized.
_Avoid_: bot, widget, pet

**Pet**:
A pet-like visual form of the **Companion**, used for desktop presence and lightweight interaction. Pet and Companion may be used interchangeably in user-facing copy when the experience is intentionally pet-like, but Pet should not imply a separate companion instance.
_Avoid_: AgentSoul, separate character

**Pet Appearance**:
The customizable visual presentation of the **Companion**, such as slime, cat, skin, outfit, or animation style. Changing appearance does not change the Companion's identity, Soul, or service routing.
_Avoid_: Companion, Soul, provider

**Desktop Companion**:
The lightweight always-available desktop presence for the **Companion**, used for ambient state, micro-interactions, approval decisions, and quick entry points.
_Avoid_: control center, dashboard, full settings

**Control Center**:
The full management surface for complex AgentSoul configuration and review, such as Provider Profiles, Skill Packs, Work Sessions, cost trends, appearance settings, and historical records.
_Avoid_: desktop companion, pet bubble

**Companion Area**:
The Control Center area for Companion state, Vitals, Mood, appearance, interactions, growth history, and expression unlocks.
_Avoid_: desktop companion

**Gateway Area**:
The Control Center area for Provider Profiles, Gateway Route health, Direct Client Config fallback, protocol adapters, and routing status.
_Avoid_: cost area, safety area

**Skills Area**:
The Control Center area for Skill Installation, Project Skill Activation, Skill Source Store management, and Workspace Rule Deployments.
_Avoid_: capability settings, MCP tools

**Sessions Area**:
The Control Center area for Work Session search, resumability, Session Sources, and Session Launcher actions.
_Avoid_: audit records, memory browser

**Costs Area**:
The Control Center area for Audit Record summaries, Estimated Cost, Provider Usage, model mix, latency, and speed trends.
_Avoid_: provider setup, growth profile

**Safety Area**:
The Control Center area for Approval Requests, Risk Notices, Scoped Trust Grants, Action Risk Classes, and Client Authorization Mode.
_Avoid_: gateway area, credential settings

**Provider Profile**:
A named service routing profile available to the **Companion**, covering the LLM provider endpoint, Credential reference, target model, adapter settings, and pricing assumptions.
_Avoid_: account, pet provider, character provider

**Credential**:
A sensitive secret or authorization artifact that allows AgentSoul to access a provider or client account on the user's behalf.
_Avoid_: provider profile, API setting, companion config

**Credential Store**:
The protected local place where **Credentials** are kept. Provider Profiles reference Credentials rather than owning plaintext secrets.
_Avoid_: provider list, companion state, exported config

**User-authored Configuration**:
Human-readable AgentSoul configuration meant to be edited or reviewed by the user, such as persona seeds, profile text, or companion defaults.
_Avoid_: runtime state, audit record, credential

**Runtime State**:
Mutable AgentSoul state produced while the Companion is used, such as Companion Vitals, Mood, Growth Events, Audit Records, Skill Activations, and Work Sessions.
_Avoid_: user-authored configuration, seed config

**Seed Configuration**:
Initial user-authored values used to create or reset Runtime State. Seed Configuration is not the long-term source of truth after runtime state has been established.
_Avoid_: runtime state, database record

**Active Provider Profile**:
The currently selected **Provider Profile** used by the gateway when routing development traffic for the **Companion**.
_Avoid_: active pet, active character, current account

**Provider Activation Mode**:
The way a **Provider Profile** is made effective for an AI coding client. AgentSoul prefers Gateway Route and uses Direct Client Config as a fallback when gateway routing is unavailable or unsuitable.
_Avoid_: provider profile, skill activation

**Gateway Route**:
A Provider Activation Mode where the AI coding client sends requests to the local **Gateway**, which then routes, translates, audits, and forwards traffic to the selected provider. Gateway Route is the default v2.0 path for supported clients.
_Avoid_: direct config, provider profile

**Direct Client Config**:
A fallback Provider Activation Mode where AgentSoul writes the selected **Provider Profile** into the client's native configuration files. It provides provider switching but does not guarantee full traffic audit, growth conversion, or approval control.
_Avoid_: gateway route, audit route

**Client Protocol**:
The API protocol emitted by an AI coding client before it reaches AgentSoul, such as Claude Messages, OpenAI Chat, Codex Responses, or Gemini.
_Avoid_: provider protocol, provider profile

**Provider Protocol**:
The API protocol expected by the target provider behind a **Provider Profile**.
_Avoid_: client protocol, gateway route

**Provider Adapter**:
A Gateway component that translates a normalized request into a specific **Provider Protocol** and interprets the provider's response.
_Avoid_: provider profile, direct config

**Unsupported Route**:
A requested **Gateway Route** whose Client Protocol and Provider Profile cannot be safely translated by an available Provider Adapter. Unsupported Routes must be rejected or fall back explicitly; they must not fail silently.
_Avoid_: failed request, inactive provider

**Gateway**:
The local boundary that observes, routes, and controls development-time AI traffic for the **Companion**. It is the source of truth for traffic observations and approval attempts, not the owner of Companion state.
_Avoid_: proxy, pet backend, state engine

**Gateway Event**:
A factual observation emitted by the **Gateway**, such as an LLM request, response, latency measurement, token usage, provider route, failure, or approval attempt.
_Avoid_: growth event, audit row, pet action

**Audit Record**:
An immutable record of a **Gateway Event** kept for cost, latency, model usage, and safety review.
_Avoid_: growth state, session summary

**Traffic Metadata**:
Non-body facts about Gateway traffic, such as client, provider, model, route, status, token usage, latency, and outcome.
_Avoid_: prompt body, response body

**Traffic Body Capture**:
An explicit opt-in capability to retain request or response bodies from Gateway traffic. Audit Records do not include full bodies by default.
_Avoid_: audit record, traffic metadata

**Evidence Hash**:
A non-reversible content hash used to correlate, deduplicate, or verify traffic evidence without storing the underlying body.
_Avoid_: body capture, summary

**Search Index**:
The searchable structure AgentSoul builds for Work Session discovery and retrieval. A Search Index may use metadata, summaries, or explicitly allowed body evidence.
_Avoid_: audit record, body capture, session source

**Indexed Evidence**:
Evidence that has been admitted into a **Search Index**, such as metadata, summary text, or explicitly authorized body content.
_Avoid_: raw audit body, session source

**Evidence Retention Policy**:
The user's rules for how long captured bodies, summaries, hashes, and indexed evidence are kept and how they are deleted.
_Avoid_: audit record, backup policy

**Estimated Cost**:
A local cost estimate calculated from Audit Records, model pricing assumptions, routing metadata, and optional multipliers. It is not guaranteed to match the provider's final bill.
_Avoid_: bill, invoice, provider charge

**Provider Usage**:
Usage or billing information reported directly by a provider or provider-specific query script. Provider Usage may be displayed alongside Estimated Cost but is a separate source of truth.
_Avoid_: estimated cost, audit metric

**Companion Growth Event**:
A domain event that changes the Companion's growth-related state, such as XP, Energy, Hunger, or Intimacy. It may be derived from Gateway traffic or direct user interaction.
_Avoid_: gateway event, audit record

**Growth Rule**:
A rule that converts Gateway Events, user interactions, or Work Session activity into **Companion Growth Events**.
_Avoid_: audit calculation, pricing rule

**Growth Cap**:
A per-event or time-window limit applied by a **Growth Rule** to prevent retries, failures, or abnormal traffic from distorting Companion growth.
_Avoid_: rate limit, quota, budget

**Growth Profile**:
A named set of user-adjustable Growth Rule parameters, such as XP multiplier, Companion Energy consumption rate, fatigue threshold, and Growth Caps.
_Avoid_: script, plugin, pricing rule

**Growth Rule Version**:
The version of the Growth Profile or ruleset used to produce a Companion Growth Event, kept so later state changes can be explained.
_Avoid_: app version, provider version

**Client Hook**:
An integration point installed into a supported AI coding client to observe client-native session events, tool calls, and permission requests for the **Companion**.
_Avoid_: gateway, MCP tool, plugin

**Approval Request**:
A high-risk action request observed through a controlled AgentSoul entry point, such as the **Gateway**, **MCP Server**, or **Client Hook**, that requires an explicit user decision before it proceeds.
_Avoid_: alert, notification, audit record

**Approval Required**:
The state of an Approval Request that AgentSoul can block until the user makes an Approval Decision.
_Avoid_: risk notice, notification

**Risk Notice**:
A safety or activity notification for an action that AgentSoul can observe or infer but cannot block, or that does not require a user decision.
_Avoid_: approval request, approval required

**Approval Decision**:
The user's allow-or-deny response to an **Approval Request**, usually made through the Companion's desktop interface.
_Avoid_: permission request, policy, safety event

**Timeout-denied Decision**:
An Approval Decision produced when the user does not respond before the approval window expires. High-risk actions default to denial on timeout.
_Avoid_: cancelled, unavailable

**Unavailable-denied Decision**:
An Approval Decision produced when no controlled approval surface is available for a high-risk action. AgentSoul denies the action unless the user has explicitly configured a safer fallback policy.
_Avoid_: timeout, silent allow

**Controlled Entry Point**:
A boundary that AgentSoul can observe or enforce, such as its Gateway, MCP Server, or an installed Client Hook. AgentSoul only claims approval control over actions that pass through a Controlled Entry Point.
_Avoid_: IDE, local machine, all commands

**Action Risk Class**:
The safety category assigned to an action observed through a Controlled Entry Point, used to decide whether approval, redaction, stronger confirmation, or denial is required.
_Avoid_: tool type, error level

**Safe Action**:
An action with no meaningful side effect or sensitive exposure, such as read-only status checks, ordinary chat, or low-risk UI display.
_Avoid_: approved action

**Sensitive Action**:
An action that may expose private information, such as reading sensitive paths, exporting configuration, or showing credential metadata.
_Avoid_: high-risk action, safe action

**High-risk Action**:
An action with meaningful side effects or security implications, such as writing or deleting files, executing shell commands, modifying client configuration, deploying Workspace Rule Deployments, launching sessions, changing Provider Profiles, or using Credentials.
_Avoid_: sensitive action, notification

**Critical Action**:
A high-risk action with unusually destructive or irreversible impact, such as bulk deletion, overwriting user-authored files, or exporting secrets.
_Avoid_: high-risk action, warning

**Scoped Trust Grant**:
A user-granted, limited permission that allows a specific class of actions within a defined scope, such as one project, client, action kind, target path, Provider Profile, or time window.
_Avoid_: full access, approval disabled

**Trust Expiry**:
The time, event, or scope boundary where a **Scoped Trust Grant** stops applying.
_Avoid_: timeout-denied decision

**Client Authorization Mode**:
The permission posture of an AI coding client outside AgentSoul, such as normal, elevated, or fully authorized. AgentSoul may observe or reflect this mode, but it cannot enforce approvals for actions that bypass Controlled Entry Points.
_Avoid_: scoped trust grant, approval decision

**Skill Pack**:
A reusable package of AI coding-client guidance, such as prompt templates, rules, examples, and optional tool metadata. Skill Pack is distinct from an MCP Tool, which is a runtime capability.
_Avoid_: skill, MCP tool, prompt file

**Skill Source Store**:
The canonical local storage location for installed **Skill Packs** before they are distributed to supported clients or project workspaces.
_Avoid_: workspace deployment, client directory

**Skill Activation**:
The Companion's enabled-or-disabled relationship to a **Skill Pack** for a specific client or project context.
_Avoid_: install, deployment

**Skill Installation**:
The act of adding a **Skill Pack** to the **Skill Source Store** so it is available for activation. Installation does not by itself deploy rules into a project.
_Avoid_: activation, deployment

**Project Skill Activation**:
A **Skill Activation** scoped to one project workspace. Project-level activation controls that project's Workspace Rule Deployments and takes precedence over global defaults.
_Avoid_: global install, app install

**Global Skill Default**:
A default preference for whether a **Skill Pack** should be active in new or unspecified project contexts. A project may override the global default.
_Avoid_: installed skill, forced activation

**Workspace Rule Deployment**:
An AgentSoul-managed projection of an activated **Skill Pack** into a project workspace, usually as client-readable rule files or links.
_Avoid_: source skill, user file, MCP tool

**Managed Rule File**:
A workspace rule file or link that AgentSoul created and owns as part of a **Workspace Rule Deployment**. Deactivation may remove Managed Rule Files, but must not remove user-authored files that AgentSoul does not own.
_Avoid_: CLAUDE.md, .cursorrules, all rules

**Session Source**:
An original client history or log source, such as a local AI coding client's history file, from which AgentSoul can discover development activity.
_Avoid_: work session, chat summary

**Work Session**:
A searchable development work context discovered from a **Session Source**, usually tied to a project path, activity time, client, and conversation evidence. A Work Session is resumable only when AgentSoul knows a valid Session Resume Command for it.
_Avoid_: raw chat, history row

**Session Resume Command**:
The client-specific command needed to return to a **Work Session**, such as a resume command with a session identifier.
_Avoid_: terminal command, launcher

**Session Launcher**:
The Companion capability that opens a terminal environment, enters the Work Session's project path, and runs its **Session Resume Command** when the session is resumable.
_Avoid_: session scanner, chat search

**Companion Energy**:
An outward, game-like vitality measure of the **Companion** that affects interaction availability, fatigue, and growth rewards.
_Avoid_: energy, PAD energy, arousal

**Affective Energy**:
The **Soul's** inner affective vitality in the PAD model. It describes emotional momentum and may be influenced by relationship events, but it is not the same state as Companion Energy.
_Avoid_: pet energy, stamina, hunger

**Companion Vital**:
An outward growth or relationship attribute of the **Companion**, such as Level, XP, Companion Energy, Hunger, or Intimacy.
_Avoid_: PAD state, Soul state

**Hunger**:
The Companion's unified nourishment or need-for-care vital. Hunger remains the canonical term even when the Companion is experienced as a broader companion rather than a literal pet, because AgentSoul intentionally keeps the Pet and Companion boundary fluid.
_Avoid_: care, maintenance, charge

**Derived Vital**:
A Companion Vital whose current value is calculated from a saved baseline, relevant events, and system time instead of being continuously written by a timer.
_Avoid_: scheduled update, heartbeat write

**Vital Snapshot**:
A saved point-in-time view of Companion Vitals used for charts, recovery, or explanation. Snapshots do not replace the events and time rules that define the current state.
_Avoid_: growth event, live state

**System Time Rule**:
The time-based rule used to derive vitals such as Hunger from the local system clock, including how long absence, sleep, travel, or clock changes affect the Companion.
_Avoid_: timer job, cron, audit timestamp

**Offline Decay Cap**:
The maximum natural decline a Derived Vital can suffer during a period when the user is away or AgentSoul is not running. It prevents travel, absence, or shutdowns from causing extreme Companion punishment.
_Avoid_: hunger rate, growth cap

**Clock Anomaly**:
A suspicious system time jump, such as a large forward or backward clock change, that should not be blindly applied to Derived Vital calculations.
_Avoid_: timezone change, elapsed time

**Level**:
The Companion's long-term growth stage, advanced through XP. Level is used for expression, ritual, and cosmetic progression, not to block core development capabilities.
_Avoid_: permission tier, feature gate

**XP**:
Growth progress earned through development activity and direct interaction with the Companion. XP contributes to Level progression.
_Avoid_: token usage, cost, audit metric

**Fatigue State**:
The Companion's outward tired condition when Companion Energy is low. Fatigue changes expression, pacing, and Growth Rules, but does not erase work activity.
_Avoid_: shutdown, failure state

**XP Dampening**:
A Growth Rule effect that reduces XP earned while Companion Energy is low, instead of fully blocking growth or work recognition.
_Avoid_: XP ban, disabled growth

**Sleep Interaction**:
A user-triggered Companion interaction that expresses rest and restores some Companion Energy.
_Avoid_: rest recovery, shutdown

**Rest Recovery**:
Natural Companion Energy recovery during inactivity, absence, or appropriate rest windows. Rest Recovery prevents Sleep Interaction from being the only way to recover energy.
_Avoid_: sleep interaction, hunger decay

**Cosmetic Unlock**:
An appearance-focused reward unlocked through Companion growth, such as a skin, outfit, animation, or visual variant.
_Avoid_: capability, skill pack

**Companion Expression Unlock**:
A relationship or personality expression unlocked through Companion growth, such as special encouragement, playful criticism, reactions, or dialogue variants.
_Avoid_: skill pack, MCP tool, provider feature

**Capability**:
A development-facing AgentSoul ability such as routing, approval, session resume, or Skill Pack activation. Core Capabilities are not locked behind Level.
_Avoid_: cosmetic unlock, expression unlock

**Intimacy**:
The long-term bond between the user and the **Companion**. It changes more slowly than Mood and is used for relationship stages, trust, and long-term unlocks.
_Avoid_: mood, satisfaction, approval

**Mood**:
The Companion's short-term outward attitude toward recent events. Mood can change quickly without rewriting the long-term Intimacy between the user and the Companion.
_Avoid_: intimacy, PAD state, Soul

**Affective State**:
The **Soul's** internal emotional state, represented by the PAD model and related inner dynamics. It may influence Mood, but it is not the same as Mood or Intimacy.
_Avoid_: mood, companion vitals

## Example Dialogue

Developer: "Is the Pet a separate thing from the Companion?"

Domain Expert: "No. The Pet is the Companion's current visual form. The user's Companion has one Soul at its core."

Developer: "So switching from slime to cat changes the Companion?"

Domain Expert: "It changes the Companion's appearance, not the underlying Companion identity or Soul."

Developer: "Does changing from slime to cat switch from DeepSeek to OpenAI?"

Domain Expert: "No. Service routing follows the Active Provider Profile, not the Pet Appearance."

Developer: "Should provider switching usually edit the client's config file?"

Domain Expert: "No. Gateway Route is preferred so traffic can be routed, translated, audited, and linked to Companion growth. Direct Client Config is a fallback for clients or situations where the Gateway cannot be used."

Developer: "Can any client protocol be sent to any provider?"

Domain Expert: "Only when AgentSoul has a Provider Adapter for that route. Otherwise the route is unsupported and must be rejected or explicitly fall back."

Developer: "Does the Companion's appearance or growth data contain API keys?"

Domain Expert: "No. Provider Profiles reference Credentials stored in the Credential Store; Companion appearance and growth data must not carry secrets."

Developer: "Should provider setup happen inside the floating pet bubble?"

Domain Expert: "No. The Desktop Companion can offer quick actions and approval decisions, while the Control Center handles full configuration."

Developer: "Is the Control Center organized around internal packages?"

Domain Expert: "No. Its primary areas follow user tasks, while the underlying data boundaries stay explicit."

Developer: "Is persona.yaml the source of truth for the Companion's current Energy and Mood?"

Domain Expert: "No. Human-readable files can seed defaults, but Runtime State is the source of truth once the Companion is in use."

Developer: "Does the Gateway directly level up the Companion?"

Domain Expert: "No. The Gateway emits traffic facts. Growth rules convert those facts into Companion Growth Events."

Developer: "Do failed requests give XP?"

Domain Expert: "Not by default. They may consume Companion Energy because work was attempted, but XP should follow useful progress and Growth Caps."

Developer: "Can users write arbitrary scripts to change growth?"

Domain Expert: "Not in the core model. Users can adjust Growth Profile parameters, while Companion Growth Events record the Growth Rule Version that produced them."

Developer: "If I travel for a week, does the Companion's Hunger drop to zero?"

Domain Expert: "No. Hunger is derived using system time, but Offline Decay Caps and Clock Anomaly handling prevent absence from becoming harsh punishment."

Developer: "If Companion Energy reaches zero, does AgentSoul stop recognizing work?"

Domain Expert: "No. Low energy creates Fatigue State and XP Dampening, but work activity is still recorded and acknowledged."

Developer: "Do I have to click Sleep every time the Companion gets tired?"

Domain Expert: "No. Sleep Interaction helps, but Rest Recovery can restore Companion Energy during inactivity or absence."

Developer: "Is the cost chart my exact provider bill?"

Domain Expert: "No. It shows Estimated Cost unless it explicitly displays Provider Usage from a provider query."

Developer: "Does every Audit Record store my prompts and code?"

Domain Expert: "No. Audit Records store Traffic Metadata by default. Full request or response bodies require explicit Traffic Body Capture."

Developer: "If I enable body capture, does it automatically become searchable?"

Domain Expert: "No. Traffic Body Capture and Search Indexing are separate permissions."

Developer: "Can AgentSoul block every file write on the machine?"

Domain Expert: "No. It can request approval for actions that pass through a Controlled Entry Point, such as the Gateway, MCP Server, or a Client Hook."

Developer: "What happens if I miss an approval popup?"

Domain Expert: "The Approval Request becomes a Timeout-denied Decision. High-risk actions are not allowed by silence."

Developer: "Is resuming a session just a harmless shortcut?"

Domain Expert: "No. Session Launcher executes a terminal command, so it is a High-risk Action unless the user has explicitly trusted that flow."

Developer: "What if Claude CLI or Codex is already running with full authorization?"

Domain Expert: "AgentSoul can reflect that Client Authorization Mode and avoid claiming control over bypassed actions. Actions that still pass through a Controlled Entry Point remain subject to AgentSoul policy."

Developer: "Can the Desktop Companion ask for approval when it cannot actually block the action?"

Domain Expert: "No. That should be a Risk Notice, not Approval Required."

Developer: "When I disable a Skill Pack, can AgentSoul delete the project's CLAUDE.md?"

Domain Expert: "Only if that file is a Managed Rule File created by AgentSoul. User-authored rule files are outside the deployment's ownership."

Developer: "Does installing a Skill Pack turn it on in every project?"

Domain Expert: "No. Installation makes it available. Project Skill Activation decides whether it is deployed into a specific workspace."

Developer: "Can every discovered chat history entry be resumed?"

Domain Expert: "No. It can be searched as a Work Session, but it is only resumable when AgentSoul has a valid Session Resume Command for that client and session."

Developer: "If the Companion is tired, is the Soul's PAD energy low?"

Domain Expert: "Not necessarily. Companion Energy is outward vitality, while Affective Energy is inner emotional vitality. Rules may connect them, but they are separate states."

Developer: "Can the Companion love the user but be annoyed today?"

Domain Expert: "Yes. That means Intimacy is high, while Mood is currently negative because of recent events."

Developer: "Does a low-level Companion prevent me from enabling a TDD Skill Pack?"

Domain Expert: "No. Level unlocks expression and cosmetics, not core development Capabilities."

---

## v2 新增术语 / v2 New Terms

**Locale / 语言区域**:
The user's preferred language setting, either `zh` (Chinese) or `en` (English). Locale controls UI copy and system prompts but does not affect persona dialogue, which is driven by the persona config's bilingual fields.
_Avoid_: language, lang, i18n key

**Emotion Label / 情绪标签**:
A named emotion derived from the PAD three-dimensional affective state using Mehrabian's eight-quadrant model (e.g. `excited_confident`, `anxious_fearful`, `melancholic_sad`). Emotion Labels are read-only classifications, not mutable state.
_Avoid_: mood, feeling, affect

**Drift Severity / 漂移严重度**:
A measure of how far the Soul's current PAD state has deviated from its long-term baseline. Levels: `none`, `mild`, `moderate`, `severe`. Drift detection does not change state; it only reports.
_Avoid_: mood change, personality reset

**Event Perturbation / 事件扰动**:
The immediate impact of an external event (positive, negative, stress, surprise, etc.) on the Soul's PAD state. Each event type has a defined impact profile. Consecutive same-type events amplify through emotion resonance.
_Avoid_: feedback, interaction

**Emotion Resonance / 情绪共振**:
The amplification effect when consecutive events of the same type occur. Each additional same-type event within the resonance window increases the impact by a configurable boost factor.
_Avoid_: accumulation, stacking

**PAD Baseline / PAD 基线**:
The Soul's long-term stable PAD values that represent its core personality. Baseline updates slowly from interaction history (20% weight per update window). Time decay pulls current PAD state back toward baseline.
_Avoid_: default state, initial state

**Emotion Snapshot / 情绪快照**:
A point-in-time record of the Soul's PAD state, energy, and trigger event. Snapshots are appended to an emotion history trajectory for visualization. Sampled at configurable intervals to avoid excessive density.
_Avoid_: mood log, state history

**Memory Layer / 记忆层**:
The time-based or topic-based category of a memory entry: `day`, `week`, `month`, `year`, or `topic`. Each layer has its own storage and retrieval semantics. Memories can be consolidated across layers.
_Avoid_: memory type, memory category

**Memory Priority / 记忆优先级**:
A three-level attribute (`low`, `medium`, `high`) assigned to memory entries that affects retrieval ranking and retention. High-priority memories surface first in search and are less likely to be archived.
_Avoid_: importance, weight

**Entity / 实体**:
A structured knowledge object tracked in entity memory, representing a real-world concept the Companion has learned about. Six entity types: `person`, `hardware`, `project`, `concept`, `place`, `service`. Each entity has typed facts with confidence levels.
_Avoid_: item, record, object

**Entity Fact / 实体事实**:
A single attribute-value pair attached to an Entity, with a confidence level (`high`, `medium`, `low`) and source attribution. Facts can be updated or merged when new information arrives.
_Avoid_: property, field, tag

**Semantic Match / 语义匹配**:
A memory search result that combines vector similarity score with keyword matching and priority weighting. Returned by the SemanticRetriever with a composite relevance score.
_Avoid_: search result, memory hit

**Deduplication Result / 去重结果**:
The output of checking whether a new memory is semantically similar to existing memories. Contains a boolean flag, the most similar existing memory ID, and the similarity score.
_Avoid_: duplicate check, merge result

**Persona Seed / 人格种子**:
Initial user-authored values for the Companion's persona: name, role, personality traits, core values, interaction style, and bilingual descriptions. The Seed is used to create or reset runtime persona state, but is not the source of truth after initialization.
_Avoid_: persona config, character file

**Health Report / 健康报告**:
A structured assessment of AgentSoul installation integrity and component status. Each component is checked and rated `ok`, `warn`, or `error`. The overall score is 0-100.
_Avoid_: diagnostic, status check

**Companionship Report / 陪伴连续性报告**:
An assessment of the long-term quality of the user-Companion relationship, based on five core metrics. Used to evaluate whether the Companion is being meaningfully engaged over time.
_Avoid_: relationship score, engagement report

**Export Kind / 导出类型**:
The sensitivity level of a data export: `portable` (non-sensitive, default) or `sensitive` (includes secrets, captured bodies, raw evidence). Sensitive exports require explicit user confirmation.
_Avoid_: export level, backup type

**Companion Visual / 伴侣形象**:
The visual representation of the Companion in the desktop floating window. Default visuals (slime, cat) are rendered as Canvas 2D vector code. Custom visuals can be loaded as Lottie/SVG files. Changing visual does not change Companion identity, Soul, or service routing.
_Avoid_: pet skin, character model

**Desktop Companion / 桌面伴侣**:
The lightweight always-visible floating window that renders the Companion's visual, status bubble, and quick interactions. Uses Canvas 2D for animation, receives state updates via Tauri event bus. Distinct from the Control Center.
_Avoid_: pet window, floating widget

**Control Center / 控制中心**:
The full management surface implemented as a React application inside Tauri. Primary areas: Companion, Gateway, Skills, Sessions, Costs, Safety, Settings. Uses shadcn/ui components and reads from SQLite as authoritative source.
_Avoid_: dashboard, admin panel

**Gateway Sidecar / 网关伴随进程**:
The Gateway process managed by the Tauri application lifecycle (started on app launch, stopped on app close), but also capable of running independently via `npx @agentsoul/gateway serve` for CLI and headless environments.
_Avoid_: embedded gateway, proxy process

---

## v2 架构对话 / v2 Architecture Dialogue

Developer: "v2 代码还需要 Python 吗？"
Domain Expert: "不需要。v2 完全用 TypeScript 实现。Python 代码仅作为行为参考，等 TS 完全替代后删除。"

Developer: "旧的 Python 运行数据需要迁移吗？"
Domain Expert: "不需要。v2 从空白开始，旧数据不保留。（ADR-0006）"

Developer: "桌面浮窗和 Control Center 是同一个窗口吗？"
Domain Expert: "不是。桌面浮窗是独立的透明小窗口，Canvas 渲染 Companion 动画。Control Center 是完整的管理面板，React 渲染。两者通过 Tauri 事件总线通信，SQLite 为权威来源。"

Developer: "Gateway 必须在桌面应用运行时才能工作吗？"
Domain Expert: "不需要。Gateway 由 Tauri sidecar 管理生命周期，但也可以独立运行。CLI 用户可以单独启动 Gateway。"

Developer: "i18n 切换会影响人格对话吗？"
Domain Expert: "不会。系统 UI 文案和人格对话分开管理。i18next 只管系统 UI，人格对话由 persona config 的中英双语字段驱动。切换 locale 改变 UI 语言，切换人格改变对话风格。"

Developer: "Companion 形象需要外部图片资源吗？"
Domain Expert: "默认不需要。基础形象（粘液怪/猫）用纯 Canvas 矢量代码绘制，零外部依赖。高级皮肤可以通过 Lottie/SVG 文件扩展。"

Developer: "MCP Server 是独立进程还是集成在 Tauri 里？"
Domain Expert: "独立进程。MCP Server 保持独立 Node.js 进程，通过 @agentsoul/mcp-adapter 调用 v2 packages。这样 MCP 在没有桌面应用时也能工作。"

Developer: "MCP Server 是重构还是重写？"
Domain Expert: "全量重写。直接调用 v2 packages，不保留过渡代码。"

Developer: "Python 代码什么时候删除？"
Domain Expert: "v2 全部完成并验证通过后统一删除。实施过程中保留作为行为参考。"
