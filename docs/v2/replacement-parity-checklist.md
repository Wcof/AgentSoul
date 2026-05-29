# AgentSoul v2 Replacement Parity Checklist

Delete legacy implementation: BLOCKED

This checklist defines when AgentSoul v2 can substitute for the old product. It is based on Product behavior, not old module parity. Passing this checklist does not require preserving old internal modules, schemas, YAML files, response shapes, or database layouts. It requires that the user-facing behavior is available, tested, and locally operable.

Every unchecked item is a Blocker before deletion of the old Python, PySide6, static Web UI, and legacy MCP implementation.

## Companion/Pet

Required v2 behavior:
- Active Companion exists as the user-facing programmable companion, with Soul as its core.
- Pet Appearance is customizable without changing Companion identity or Soul.
- Level, XP, Companion Energy, Hunger, Intimacy, Mood, and Growth Events are persisted locally.
- Feed, Play, Pet, and Sleep affect runtime state according to the PRD.
- Gateway traffic can drive growth without the Gateway owning Companion state.
- Growth Profile parameters are user-adjustable for XP multiplier, energy consumption, fatigue threshold, and per-event Growth Caps.

References:
- Issues: #43, #44, #45, #46, #55
- Tests: `tests/v2/runtime-contract.test.mjs`, `tests/v2/growth-contract.test.mjs`, `tests/v2/growth-profile-contract.test.mjs`, `tests/v2/companion-energy-contract.test.mjs`, `tests/v2/desktop-companion-render-contract.test.mjs`, `tests/v2/desktop-interactions-contract.test.mjs`, `tests/v2/control-center-companion-area-contract.test.mjs`

Current status:
- Covered by v2 runtime and desktop shell tests.
- Covered by browser-level desktop/mobile screenshot smoke checks for the Desktop Companion and Control Center shell, including horizontal overflow and clipped control text assertions.

## Soul/Memory/Persona

Required v2 behavior:
- Soul remains the Companion core, separate from Pet Appearance.
- Internal affective state is separate from external Mood and short-term interaction outcomes.
- Persona baseline can be updated without changing Companion identity or Provider Profile.
- Existing memory/persona behavior must be available through v2 MCP or an explicitly retained compatibility path until v2 replacement is complete.

References:
- Issues: #43, #47, #60
- Tests: `tests/v2/soul-affective-contract.test.mjs`, `tests/v2/mcp-adapter-contract.test.mjs`

Current status:
- Soul/Affective State baseline is covered.
- Covered for v2 MCP startup compatibility: `mcp_tool_index`, `get_persona_config`, `get_soul_state`, `get_base_rules`, `get_mcp_usage_guide`, `write_memory_day`, `write_memory_topic`, `list_memory_topics`, and `update_soul_state` are exposed through the v2 MCP adapter with local memory persistence.

## Gateway/Provider

Required v2 behavior:
- Local Gateway Route is the primary provider activation path.
- Direct Client Config fallback exists only as a fallback, with reduced guarantees made visible.
- Provider Profile can be created, selected, and used by Gateway Route without exposing secret values.
- Provider adapters translate supported client/provider protocol pairs and reject unsupported routes without live provider calls.

References:
- Issues: #48, #49, #50, #56
- Tests: `tests/v2/provider-profile-contract.test.mjs`, `tests/v2/direct-client-config-contract.test.mjs`, `tests/v2/gateway-server-contract.test.mjs`, `tests/v2/gateway-adapter-contract.test.mjs`, `tests/v2/control-center-gateway-costs-contract.test.mjs`

Current status:
- Covered for provider lifecycle, gateway health, fallback limits, first adapter translation, and target client activation support matrix for Claude Code, Cursor, Codex, and Trae with either Gateway Route support or explicit Direct Client Config fallback notes.

## Audit/Costs

Required v2 behavior:
- Gateway audit persists traffic metadata, token counts, latency, outcome, cost estimate, and evidence hash.
- Default records exclude captured request/response bodies.
- Cost views show daily cost, provider/model usage, token totals, latency, and route mix from local data.

References:
- Issues: #50, #56, #61
- Tests: `tests/v2/gateway-audit-contract.test.mjs`, `tests/v2/control-center-gateway-costs-contract.test.mjs`, `tests/v2/user-managed-export-contract.test.mjs`

Current status:
- Covered for metadata-only audit, Control Center rendering, and persisted historical cost trend reads by retention window with daily cost, token, latency, model mix, and provider mix summaries.

## Skills

Required v2 behavior:
- Skill Pack installation is separate from Project Skill Activation.
- Project activation overrides global defaults.
- Workspace Rule Deployment creates managed symlink/copy files only when activation allows it.
- Cleanup removes only Managed Rule Files owned by AgentSoul.
- User-authored workspace files require approval before replacement.

References:
- Issues: #51, #57
- Tests: `tests/v2/skills-source-store-contract.test.mjs`, `tests/v2/skills-project-activation-contract.test.mjs`, `tests/v2/skills-workspace-rule-deployment-contract.test.mjs`, `tests/v2/control-center-skills-area-contract.test.mjs`

Current status:
- Covered for install, activation, deployment, conflict, and cleanup.
- Covered for importing representative external local Skill Pack directories with `package.yaml`, `CLAUDE.md`, and `.cursorrules` without deploying rules until Project Skill Activation allows it.

## Sessions

Required v2 behavior:
- Session Source scanning extracts Work Session metadata from local assistant history.
- Search supports project, source, client, keyword, and activity window filters.
- Searchable and resumable states are separate.
- Session Launcher executes only resumable sessions and is safety-gated.

References:
- Issues: #52, #53, #58
- Tests: `tests/v2/session-source-scanning-contract.test.mjs`, `tests/v2/work-session-search-contract.test.mjs`, `tests/v2/session-launcher-contract.test.mjs`, `tests/v2/control-center-sessions-area-contract.test.mjs`

Current status:
- Covered for JSONL scanning, search, resumability, and launch safety.
- Covered for representative Claude Code, Codex, and target IDE JSONL history aliases and nested message evidence while keeping scanned sessions searchable-only unless explicitly resumable.

## Safety

Required v2 behavior:
- Safe, sensitive, high-risk, and critical actions are classified consistently.
- Approval Required blocks controlled high-risk actions until explicit allow/deny.
- Risk Notice records bypassed fully authorized actions without blocking.
- Scoped Trust Grants are scoped by action, project, client, target path, provider profile, expiry, and revocation.
- Desktop approval surface shows pending approvals, notices, trust grants, and authorization mode.

References:
- Issues: #54, #59, #60, #61
- Tests: `tests/v2/safety-policy-contract.test.mjs`, `tests/v2/safety-approval-flow-contract.test.mjs`, `tests/v2/safety-risk-notice-contract.test.mjs`, `tests/v2/safety-scoped-trust-contract.test.mjs`, `tests/v2/control-center-safety-area-contract.test.mjs`, `tests/v2/mcp-adapter-contract.test.mjs`, `tests/v2/user-managed-export-contract.test.mjs`

Current status:
- Covered for policy decisions, approval flows, risk notices, trust grants, MCP controlled actions, and Sensitive Export gating.
- Covered by browser visual smoke for pending approvals, risk notices, trust grants, action risk classes, and authorization mode across desktop/mobile viewports.
- #54 remains ready-for-human for final product review even though automated visual checks now cover the Control Center shell.

## Control Center

Required v2 behavior:
- Existing pages are replaced by v2 Control Center areas, not left as disconnected legacy views.
- Control Center includes Companion, Gateway, Costs, Skills, Sessions, and Safety areas.
- Each area renders from local v2 state snapshots and exposes expected controls/statuses.

References:
- Issues: #55, #56, #57, #58, #59
- Tests: `tests/v2/control-center-companion-area-contract.test.mjs`, `tests/v2/control-center-gateway-costs-contract.test.mjs`, `tests/v2/control-center-skills-area-contract.test.mjs`, `tests/v2/control-center-sessions-area-contract.test.mjs`, `tests/v2/control-center-safety-area-contract.test.mjs`

Current status:
- Covered by static shell and view-model tests.
- Covered by Playwright Chromium visual smoke checks across desktop and mobile viewports, including responsive layout, screenshot generation, no horizontal overflow, and no clipped button/link/heading/vital text.

## MCP

Required v2 behavior:
- MCP clients can query Companion status through v2 runtime.
- MCP clients can invoke supported Companion interactions through controlled v2 services.
- High-risk MCP actions use Safety Policy with `controlledEntryPoint: "mcp-server"`.
- Tool registration schemas are tested and do not require preserving old MCP response shapes.

References:
- Issues: #60
- Tests: `tests/v2/mcp-adapter-contract.test.mjs`, `packages/mcp-adapter/tests/mcp-adapter.test.ts`

Current status:
- Covered for status, interactions, controlled action safety, schema registration, startup persona/Soul rules, local memory writes, topic listing, and Soul affective state updates.

## Install/Local-first Startup

Required v2 behavior:
- v2 app runs locally without cloud dependency.
- Same-repo TypeScript/Tauri workspace exists alongside legacy code until parity is achieved.
- Root commands can test, typecheck, build, and run v2 workspaces.
- Secrets stay local and are accessed through controlled credential references.

References:
- Issues: #34, #37, #41, #63
- Tests: `tests/v2/workspace-scaffold.test.mjs`, `tests/v2/credential-store-contract.test.mjs`, `tests/v2/persistence-contract.test.mjs`

Current status:
- Covered for workspace scaffold, persistence foundation, and credential boundaries.
- Blocker before deletion: #63 remains ready-for-human, so final cleanup/deletion must wait until a human accepts replacement parity.

## Export

Required v2 behavior:
- User-managed Export is local and user controlled.
- Portable Data includes Companion settings/growth, Skill activation state, non-sensitive Provider Profile details, Work Session metadata, and Traffic Metadata summaries.
- Default export excludes Credentials, captured bodies, raw indexed evidence, and private client auth files.
- Sensitive Export requires explicit high-risk confirmation.

References:
- Issues: #61, #62
- Tests: `tests/v2/user-managed-export-contract.test.mjs`, `packages/export/tests/export.test.ts`

Current status:
- Covered for Portable Data inclusion/exclusion and Sensitive Export confirmation.
- Covered for export format versioning with `formatVersion: "agentsoul-export-v1"` and `schemaVersion: 1` on Portable Data and Sensitive Export payloads.

## Final Deletion Gate

Old implementation code can be deleted only when all of the following are true:
- Every section above has no remaining Blocker before deletion.
- All referenced v2 tests pass in one run.
- #34, #54, and #63 are no longer `ready-for-human` blockers.
- The user has accepted that v2 behavior can replace the old product.
- A final branch/PR explicitly lists the old files being removed and the v2 behavior that replaces each user-facing capability.
