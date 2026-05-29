# AgentSoul v2 Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AgentSoul from a persona/memory framework with v2 prototypes into a local-first AI Agent Companion framework with a desktop Companion, Gateway-first provider routing, auditable growth, project-scoped Skill Packs, resumable Work Sessions, and clear safety approvals.

**Architecture:** Keep the product local-first. Move mutable runtime facts out of persona YAML into SQLite-backed services, route supported client traffic through the Gateway by default, and use the Desktop Companion for lightweight state/approval while the Web Control Center handles full management. Treat Gateway, Safety, Skills, Sessions, and Companion Growth as separate service boundaries even while they share one root glossary.

**Tech Stack:** Python 3.10+, SQLite, existing zero-dependency HTTP Gateway, PySide6 desktop companion modules, static/local Web Control Center, TypeScript MCP server, pytest.

---

## Current Decisions

Use these docs as the source of language and constraints before implementation:

- `CONTEXT.md`
- `docs/adr/0001-runtime-state-owned-by-database.md`
- `docs/adr/0002-gateway-route-default-provider-activation.md`
- `docs/adr/0003-audit-records-default-to-metadata-only.md`
- `docs/adr/0004-approval-timeouts-deny-high-risk-actions.md`
- `docs/adr/0005-local-first-companion.md`

## Refactor Boundaries

Do not implement everything in one branch. The work splits into seven independently testable tracks:

1. Runtime state database foundation
2. Companion growth and derived vitals
3. Gateway events, provider activation, and audit records
4. Safety approvals and risk notices
5. Skill Pack deployment ownership
6. Work Session indexing and resume safety
7. Control Center restructuring

Each track must leave existing CLI/MCP behavior either working or explicitly compatibility-wrapped.

## Target File Structure

Create or modify these focused modules.

### Companion Runtime

- Create `src/agentsoul/companion/__init__.py`
- Create `src/agentsoul/companion/models.py`
  - Dataclasses/enums for CompanionVitals, Mood, GrowthEvent, GrowthProfile, VitalSnapshot.
- Create `src/agentsoul/companion/repository.py`
  - SQLite persistence for runtime Companion state.
- Create `src/agentsoul/companion/growth.py`
  - Growth Rule conversion from Gateway Events and user interactions.
- Create `src/agentsoul/companion/vitals.py`
  - Derived Vital calculation using system time, Offline Decay Cap, Clock Anomaly handling, Rest Recovery.
- Modify `src/gateway/proxy_server.py`
  - Remove direct persona YAML mutation for XP/Energy/Hunger; call growth service instead.
- Modify `apps/mcp-server/src/tools/pet.ts`
  - Stop treating `config/persona.yaml` as runtime state source.

### Storage

- Modify `src/agentsoul/storage/db.py`
  - Add schema migration layer and tables for runtime state, growth events, audit records, provider profiles, skill deployments, approval records, trust grants.
- Create `src/agentsoul/storage/migrations.py`
  - Idempotent SQLite schema versioning.
- Add tests in `tests/test_storage_migrations.py`.

### Gateway

- Create `src/gateway/events.py`
  - GatewayEvent and TrafficMetadata models.
- Create `src/gateway/audit.py`
  - AuditRecord writer/reader, Estimated Cost summaries, metadata-only default.
- Create `src/gateway/providers.py`
  - ProviderProfile, Credential reference, ProviderActivationMode.
- Create `src/gateway/adapters/base.py`
  - Provider Adapter interface.
- Create `src/gateway/adapters/openai_chat.py`
  - First adapter for current OpenAI-compatible path.
- Modify `src/gateway/proxy_server.py`
  - Emit Gateway Events, write Audit Records, route through Provider Profile, reject Unsupported Routes explicitly.
- Add tests in `tests/test_gateway_audit.py`, `tests/test_gateway_provider_activation.py`.

### Safety

- Create `src/agentsoul/safety/models.py`
  - ActionRiskClass, ApprovalRequest, ApprovalDecision, RiskNotice, ScopedTrustGrant.
- Create `src/agentsoul/safety/policy.py`
  - Risk classification and default timeout/unavailable deny rules.
- Create `src/agentsoul/safety/repository.py`
  - Approval history and trust grant persistence.
- Modify `src/desktop_pet/ipc_server.py`
  - Support Approval Required vs Risk Notice messages and timeout-denied response.
- Add tests in `tests/test_safety_policy.py`, `tests/test_desktop_ipc_approval_timeout.py`.

### Skills

- Modify `src/skills/skills_manager.py`
  - Rename internal concepts toward Skill Pack, Skill Installation, Project Skill Activation.
  - Track Managed Rule File ownership before deploy/cleanup.
  - Stop renaming arbitrary user files as `.bak` unless user approved.
- Add tests in `tests/test_skills_managed_rule_files.py`.

### Sessions

- Modify `src/sessions/scanners/base.py`
- Modify `src/sessions/scanners/claude_jsonl.py`
- Modify `src/sessions/session_launcher.py`
  - Represent Work Session separately from raw Session Source entries.
  - Mark sessions as searchable vs resumable.
  - Route launch through safety policy before execution.
- Add tests in `tests/test_work_sessions.py`, `tests/test_session_launcher_safety.py`.

### Control Center

- Replace or split `apps/web/index.html`.
- Create `apps/web/src/` only if the project accepts a build step; otherwise split static files:
  - `apps/web/index.html`
  - `apps/web/styles.css`
  - `apps/web/app.js`
  - `apps/web/api.js`
- Modify `src/gateway/proxy_server.py`
  - Serve the actual `apps/web` Control Center rather than `web-ui/index.html`.
- Control Center primary areas:
  - Companion
  - Gateway
  - Skills
  - Sessions
  - Costs
  - Safety
  - Settings

## Phase 1: Runtime State Foundation

### Task 1: Add SQLite Schema Versioning

**Files:**
- Create: `src/agentsoul/storage/migrations.py`
- Modify: `src/agentsoul/storage/db.py`
- Test: `tests/test_storage_migrations.py`

- [ ] **Step 1: Write failing migration tests**

```python
from __future__ import annotations

import sqlite3

from src.agentsoul.storage.db import DatabaseManager


def test_database_has_schema_version_table(temp_dir):
    db = DatabaseManager(temp_dir / "agentsoul.db")

    with sqlite3.connect(db.db_path) as conn:
        row = conn.execute(
            "SELECT version FROM schema_version ORDER BY version DESC LIMIT 1"
        ).fetchone()

    assert row is not None
    assert row[0] >= 1


def test_database_initializes_runtime_tables(temp_dir):
    db = DatabaseManager(temp_dir / "agentsoul.db")

    with sqlite3.connect(db.db_path) as conn:
        tables = {
            row[0]
            for row in conn.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }

    assert "companion_state" in tables
    assert "growth_events" in tables
    assert "audit_records" in tables
    assert "provider_profiles" in tables
    assert "approval_requests" in tables
    assert "managed_rule_files" in tables
```

- [ ] **Step 2: Run the tests and verify failure**

Run: `pytest tests/test_storage_migrations.py -v`

Expected: fails because `schema_version` and new runtime tables do not exist.

- [ ] **Step 3: Implement idempotent migrations**

Create `src/agentsoul/storage/migrations.py` with a `run_migrations(conn)` function. Add these tables:

- `schema_version(version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL)`
- `companion_state(key TEXT PRIMARY KEY, value_json TEXT NOT NULL, updated_at TEXT NOT NULL)`
- `growth_events(id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, source_type TEXT NOT NULL, source_id TEXT, event_json TEXT NOT NULL, growth_rule_version TEXT NOT NULL)`
- `audit_records(id INTEGER PRIMARY KEY AUTOINCREMENT, occurred_at TEXT NOT NULL, gateway_event_id TEXT NOT NULL, traffic_metadata_json TEXT NOT NULL, estimated_cost REAL NOT NULL, outcome TEXT NOT NULL, evidence_hash TEXT)`
- `provider_profiles(id TEXT PRIMARY KEY, name TEXT NOT NULL, activation_mode TEXT NOT NULL, credential_ref TEXT, config_json TEXT NOT NULL, enabled INTEGER NOT NULL DEFAULT 1)`
- `approval_requests(id TEXT PRIMARY KEY, created_at TEXT NOT NULL, action_risk_class TEXT NOT NULL, status TEXT NOT NULL, request_json TEXT NOT NULL, decision_json TEXT)`
- `managed_rule_files(id INTEGER PRIMARY KEY AUTOINCREMENT, workspace_path TEXT NOT NULL, target_path TEXT NOT NULL, source_path TEXT NOT NULL, skill_name TEXT NOT NULL, deployment_method TEXT NOT NULL, content_hash TEXT, created_at TEXT NOT NULL, UNIQUE(workspace_path, target_path))`

Modify `DatabaseManager._init_db()` to call `run_migrations(conn)` before or after legacy table creation, keeping legacy tables intact.

- [ ] **Step 4: Run storage tests**

Run: `pytest tests/test_storage_migrations.py tests/test_skills_mapping.py tests/test_session_scanner_incremental.py -v`

Expected: all pass.

## Phase 2: Companion Growth

### Task 2: Move Companion Runtime State Out of Persona YAML

**Files:**
- Create: `src/agentsoul/companion/models.py`
- Create: `src/agentsoul/companion/repository.py`
- Create: `src/agentsoul/companion/growth.py`
- Create: `src/agentsoul/companion/vitals.py`
- Modify: `src/gateway/proxy_server.py`
- Test: `tests/test_companion_growth.py`

- [ ] **Step 1: Write failing tests for interaction and token growth**

Test that:

- Feed increases Hunger and Intimacy through a Growth Event.
- Play below 20 Companion Energy is blocked as interaction but does not corrupt state.
- Gateway success creates XP and Energy changes through Growth Rule.
- Low Companion Energy applies XP Dampening instead of zeroing XP.
- Hunger derivation uses system time with Offline Decay Cap.

- [ ] **Step 2: Implement Companion models**

Use enums/typed dataclasses for:

- `Mood`
- `CompanionVitals`
- `GrowthProfile`
- `CompanionGrowthEvent`
- `VitalSnapshot`

Keep field names aligned with `CONTEXT.md`: `companion_energy`, `hunger`, `intimacy`, `level`, `xp`, `mood`.

- [ ] **Step 3: Implement repository**

Persist current state in `companion_state` as JSON values and append every growth change to `growth_events`.

- [ ] **Step 4: Implement growth rules**

Default behavior:

- Feed: Hunger +30, Intimacy +5, positive Mood.
- Play: if Companion Energy <20, reject play and set Fatigue State; otherwise Energy -20, Intimacy +15, XP +15.
- Pet: Intimacy +10, XP +5, positive Mood.
- Sleep Interaction: Companion Energy +40.
- Gateway success: Energy consumption based on tokens, XP based on useful successful output, bounded by Growth Cap.
- Gateway failure: Energy may decrease; XP does not increase by default.
- Low energy: apply XP Dampening, not XP ban.

- [ ] **Step 5: Remove direct YAML mutation from Gateway growth path**

In `src/gateway/proxy_server.py`, replace `_update_pet_growth(...)` with a call into `src/agentsoul/companion/growth.py`. Persona YAML can still seed defaults but must not be the runtime source of truth.

- [ ] **Step 6: Run tests**

Run: `pytest tests/test_companion_growth.py tests/test_pad_engine.py -v`

Expected: all pass and PAD Affective Energy remains separate from Companion Energy.

## Phase 3: Gateway-first Provider Activation

### Task 3: Introduce Gateway Events and Metadata-only Audit Records

**Files:**
- Create: `src/gateway/events.py`
- Create: `src/gateway/audit.py`
- Create: `src/gateway/providers.py`
- Create: `src/gateway/adapters/base.py`
- Create: `src/gateway/adapters/openai_chat.py`
- Modify: `src/gateway/proxy_server.py`
- Test: `tests/test_gateway_audit.py`

- [ ] **Step 1: Write failing audit tests**

Test that successful requests persist:

- client protocol
- provider profile id
- model
- tokens in/out
- latency
- outcome
- estimated cost
- optional evidence hash

Also test full request/response bodies are not persisted by default.

- [ ] **Step 2: Implement GatewayEvent and TrafficMetadata**

The model should represent request facts without requiring body persistence.

- [ ] **Step 3: Implement AuditRecord writer**

Write metadata-only audit rows to `audit_records`. Add body capture only behind an explicit setting; default must be off.

- [ ] **Step 4: Implement ProviderProfile resolution**

Support `Gateway Route` as default and `Direct Client Config` as fallback in the model, even if Direct Client Config remains implemented by existing compatibility code.

- [ ] **Step 5: Add first Provider Adapter**

Start with the current OpenAI-compatible behavior as `openai_chat.py`. Unsupported protocol/profile combinations must return explicit Unsupported Route errors.

- [ ] **Step 6: Run Gateway tests**

Run: `pytest tests/test_gateway_audit.py tests/test_client_detectors.py -v`

Expected: all pass.

## Phase 4: Safety Approval Model

### Task 4: Make Approval Required Different From Risk Notice

**Files:**
- Create: `src/agentsoul/safety/models.py`
- Create: `src/agentsoul/safety/policy.py`
- Create: `src/agentsoul/safety/repository.py`
- Modify: `src/desktop_pet/ipc_server.py`
- Modify: `src/sessions/session_launcher.py`
- Modify: `src/skills/skills_manager.py`
- Test: `tests/test_safety_policy.py`
- Test: `tests/test_desktop_ipc_approval_timeout.py`

- [ ] **Step 1: Write failing policy tests**

Cover:

- Safe Action does not require approval.
- High-risk Action requires approval.
- Critical Action requires stronger confirmation or denial.
- Timeout produces timeout-denied.
- Missing approval surface produces unavailable-denied.
- Fully authorized client bypass produces Risk Notice, not Approval Required.

- [ ] **Step 2: Implement risk classes**

Use the exact classes from `CONTEXT.md`: Safe Action, Sensitive Action, High-risk Action, Critical Action.

- [ ] **Step 3: Extend IPC protocol**

Support messages for:

- `approval_required`
- `risk_notice`
- `approval_decision`
- `state_change`

Existing `permission_request` messages should be compatibility-mapped to `approval_required`.

- [ ] **Step 4: Add approval timeout handling**

Timeout default: `timeout-denied`. Desktop unavailable default: `unavailable-denied`.

- [ ] **Step 5: Route high-risk operations through policy**

Start with:

- Session Launcher
- Skill deployment/cleanup
- Provider Profile changes
- Credential usage/export

- [ ] **Step 6: Run safety tests**

Run: `pytest tests/test_safety_policy.py tests/test_desktop_ipc.py tests/test_desktop_ipc_approval_timeout.py -v`

Expected: all pass.

## Phase 5: Skill Pack Ownership

### Task 5: Track Managed Rule Files Before Cleanup

**Files:**
- Modify: `src/skills/skills_manager.py`
- Modify: `src/agentsoul/storage/db.py`
- Test: `tests/test_skills_managed_rule_files.py`

- [ ] **Step 1: Write failing ownership tests**

Cover:

- Deploying a symlink records a Managed Rule File.
- Deactivation removes only recorded Managed Rule Files.
- Existing user-authored `CLAUDE.md` is not renamed or deleted without explicit approval.
- Project Skill Activation overrides Global Skill Default.

- [ ] **Step 2: Add managed rule DAO methods**

Add methods:

- `record_managed_rule_file(...)`
- `get_managed_rule_files(workspace_path)`
- `delete_managed_rule_file(workspace_path, target_path)`

- [ ] **Step 3: Update deployment flow**

If destination exists and is not AgentSoul-managed, classify the write as High-risk Action. Do not rename it automatically as `.bak` without an approval decision.

- [ ] **Step 4: Update cleanup flow**

Cleanup only files found in `managed_rule_files`, and only when path/hash checks match expected ownership.

- [ ] **Step 5: Run skills tests**

Run: `pytest tests/test_skills_mapping.py tests/test_skills_managed_rule_files.py -v`

Expected: all pass.

## Phase 6: Work Sessions

### Task 6: Separate Searchable Work Sessions From Resumable Sessions

**Files:**
- Modify: `src/sessions/scanners/base.py`
- Modify: `src/sessions/scanners/claude_jsonl.py`
- Modify: `src/sessions/session_scanner.py`
- Modify: `src/sessions/session_launcher.py`
- Modify: `src/agentsoul/storage/db.py`
- Test: `tests/test_work_sessions.py`
- Test: `tests/test_session_launcher_safety.py`

- [ ] **Step 1: Write failing Work Session tests**

Cover:

- A scanned history entry becomes a Work Session.
- Work Session can be searchable without resumable.
- Resume command exists only when client and session id support it.
- Launching a session is a High-risk Action and goes through safety policy.

- [ ] **Step 2: Extend sessions schema**

Add fields to support:

- `session_source`
- `is_searchable`
- `is_resumable`
- `resume_command`
- `search_evidence_json`

- [ ] **Step 3: Update Claude JSONL scanner**

Keep incremental offset behavior. Populate Work Session fields from `history.jsonl`.

- [ ] **Step 4: Update launcher**

Refuse launch if `is_resumable` is false. Request approval or honor Scoped Trust Grant before executing Terminal/iTerm command.

- [ ] **Step 5: Run session tests**

Run: `pytest tests/test_session_scanner_incremental.py tests/test_work_sessions.py tests/test_session_launcher_safety.py -v`

Expected: all pass.

## Phase 7: Control Center Restructure

### Task 7: Split Web UI and Replace Health-report-first Layout

**Files:**
- Modify: `apps/web/index.html`
- Create: `apps/web/styles.css`
- Create: `apps/web/app.js`
- Create: `apps/web/api.js`
- Modify: `src/gateway/proxy_server.py`
- Test: browser/manual plus lightweight endpoint tests

- [ ] **Step 1: Create Control Center shell**

Primary navigation:

- Companion
- Gateway
- Skills
- Sessions
- Costs
- Safety
- Settings

The first screen should be the Companion Area dashboard, not a marketing page and not a health report importer.

- [ ] **Step 2: Move existing health visualization into Settings or Diagnostics**

Keep existing health report functionality, but demote it to a diagnostics view.

- [ ] **Step 3: Add API module**

Centralize fetch calls in `apps/web/api.js`:

- `/api/status`
- `/api/skills`
- `/api/sessions`
- `/api/token_stats`
- future `/api/safety`
- future `/api/provider_profiles`

- [ ] **Step 4: Fix static serving path**

`src/gateway/proxy_server.py` currently serves `web-ui/index.html`. Change it to serve `apps/web/index.html` and static CSS/JS files.

- [ ] **Step 5: Verify UI manually**

Run Gateway locally, open `http://127.0.0.1:8000`, and verify:

- Navigation loads.
- Companion status renders.
- Costs chart uses token stats.
- Skills list loads.
- Sessions list loads.
- No text overlaps at desktop and mobile widths.

## Phase 8: MCP and Compatibility

### Task 8: Align MCP Pet Tools With Runtime Services

**Files:**
- Modify: `apps/mcp-server/src/tools/pet.ts`
- Modify: `apps/mcp-server/src/index.ts`
- Test: existing TypeScript test command or package build

- [ ] **Step 1: Stop runtime writes to persona YAML**

MCP `pet_interact` should call the Python/runtime service or DB-backed command path instead of editing `config/persona.yaml` directly.

- [ ] **Step 2: Keep tool response shapes compatible**

Existing clients expect JSON with success/message/character. Preserve the response shape while sourcing state from runtime database.

- [ ] **Step 3: Build MCP server**

Run: `cd apps/mcp-server && npm run build`

Expected: TypeScript build passes.

## Verification Matrix

Run these before claiming implementation complete:

- `pytest tests/test_storage_migrations.py -v`
- `pytest tests/test_companion_growth.py -v`
- `pytest tests/test_gateway_audit.py -v`
- `pytest tests/test_safety_policy.py -v`
- `pytest tests/test_skills_mapping.py tests/test_skills_managed_rule_files.py -v`
- `pytest tests/test_session_scanner_incremental.py tests/test_work_sessions.py -v`
- `pytest tests/test_desktop_ipc.py tests/test_desktop_ipc_approval_timeout.py -v`
- `pytest -v`
- `cd apps/mcp-server && npm run build`
- Manual browser verification for `http://127.0.0.1:8000`

## Deferred Work

These are intentionally not first-pass implementation:

- Full Claude/OpenAI/Codex/Gemini protocol matrix.
- Remote Sync.
- Arbitrary scripted Growth Rules.
- Full text Traffic Body Capture search by default.
- Cloud account system.
- Multi-Companion support.

## Execution Order

Recommended branch sequence:

1. `codex/runtime-state-db`
2. `codex/companion-growth`
3. `codex/gateway-audit`
4. `codex/safety-approval`
5. `codex/skill-pack-ownership`
6. `codex/work-sessions`
7. `codex/control-center-v2`
8. `codex/mcp-runtime-alignment`

Each branch should update tests and docs for only that track.
