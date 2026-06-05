# Retire Legacy Control Center Modules Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the old Control Center modules from the Desktop Body product path while preserving future extensibility through Extension Runtime.

**Architecture:** The default desktop startup must flow through `desktop-body`, `agent-mind`, `memory`, and `extension-runtime`. Old areas such as gateway, costs, sessions, skills, mcp, prompts, safety, conversations, and settings-full may remain temporarily as isolated legacy/debug code, but the Desktop Body product path must not import or hydrate them.

**Tech Stack:** TypeScript, Tauri v2, Vitest, existing companion canvas/runtime utilities

---

### Task 1: Move Default Startup Behind Desktop Body

**Files:**
- Modify: `apps/desktop-v2/tests/desktop-body-architecture.test.ts`
- Create: `apps/desktop-v2/src/desktop-body/bootstrap.ts`
- Modify: `apps/desktop-v2/src/desktop-body/index.ts`
- Modify: `apps/desktop-v2/src/main.ts`

- [ ] **Step 1: Write the failing test**

Add a test proving `main.ts` imports the Desktop Body entrypoint and no longer imports legacy shell/controller/control-client modules.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts`
Expected: FAIL because `main.ts` still imports `./shared/shell`, `./shared/app-controller`, and `./utils/localControlClient`.

- [ ] **Step 3: Implement Desktop Body bootstrap**

Create `desktop-body/bootstrap.ts` with a small controller that renders `renderDesktopCompanionSurface`, starts the canvas loop, loads native companion state through Tauri, and binds Desktop Body interactions.

- [ ] **Step 4: Route main.ts through Desktop Body**

Replace legacy startup wiring in `main.ts` with `bootstrapDesktopBody(app)`.

- [ ] **Step 5: Run test to verify it passes**

Run: `rtk npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts`
Expected: PASS

### Task 2: Remove Legacy Module Hydration From Desktop Body Snapshot

**Files:**
- Modify: `apps/desktop-v2/tests/desktop-body-architecture.test.ts`
- Create: `apps/desktop-v2/src/desktop-body/snapshot.ts`
- Modify: `apps/desktop-v2/src/desktop-body/bootstrap.ts`

- [ ] **Step 1: Write the failing test**

Add a test proving Desktop Body snapshot loading does not hydrate gateway, costs, sessions, skills, mcp, prompts, safety, conversations, or settings-full data.

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts`
Expected: FAIL until Desktop Body owns its own snapshot loader.

- [ ] **Step 3: Implement Desktop Body snapshot loader**

Create a small loader that merges only companion identity, appearance, vitals, autonomy, and master model state from native Tauri.

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts`
Expected: PASS

### Task 3: Update Product Vocabulary Documents

**Files:**
- Modify: `CONTEXT.md`
- Modify: `apps/desktop-v2/src/i18n/en.json`
- Modify: `apps/desktop-v2/src/i18n/zh.json`
- Test: `apps/desktop-v2/tests/shell.test.mjs`

- [ ] **Step 1: Write or update vocabulary checks**

Tests should assert the primary product language is Desktop Body, Agent Mind, Memory, and Extension Runtime.

- [ ] **Step 2: Remove contradictory old product language**

Rewrite old Control Center/Gateway glossary entries so they are clearly marked as legacy implementation only, not product architecture.

- [ ] **Step 3: Run vocabulary tests**

Run: `rtk npm exec vitest run apps/desktop-v2/tests/shell.test.mjs apps/desktop-v2/tests/vocabulary-alignment.test.ts`
Expected: PASS

### Task 4: Record Legacy Deletion Backlog

**Files:**
- Create: `docs/superpowers/plans/2026-06-03-legacy-module-deletion-backlog.md`
- Modify: `docs/superpowers/plans/2026-06-03-retire-legacy-control-center-modules-plan.md`

- [ ] **Step 1: Write deletion backlog**

List each old module and whether it is ready to delete, needs replacement by Extension Runtime, or is still only used by legacy tests.

- [ ] **Step 2: Verify no Desktop Body default import depends on deletion backlog modules**

Run: `rtk rg -n "areas/(gateway|costs|sessions|sessions-mgr|skills|mcp|prompts|safety|conversations|settings-full)|localControlClient|renderAgentSoulShell|createDesktopCompanionController" apps/desktop-v2/src/main.ts apps/desktop-v2/src/desktop-body`
Expected: no matches.

### Task 5: Verification

**Files:**
- Verify only

- [ ] **Step 1: Run typecheck**

Run: `rtk npm --workspace @agentsoul/desktop-v2 run typecheck`
Expected: PASS

- [ ] **Step 2: Run focused architecture regression**

Run: `rtk npm exec vitest run apps/desktop-v2/tests/desktop-body-architecture.test.ts apps/desktop-v2/tests/dev-entrypoint.test.ts apps/desktop-v2/tests/desktop-companion-experience.test.ts apps/desktop-v2/tests/shell.test.mjs tests/v2/tauri-desktop-shell-contract.test.mjs`
Expected: PASS

- [ ] **Step 3: Run native check**

Run: `rtk cargo check`
Working directory: `apps/desktop-v2/src-tauri`
Expected: PASS
