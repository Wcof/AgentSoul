<!-- BEGIN AGENTSOUL V2 STARTUP -->
# AgentSoul v2 Project Context

This is an AgentSoul v2 project — a local-first AI Agent Companion built with TypeScript + Tauri.

## Project Structure

- `apps/desktop-v2/` — Tauri desktop app (Desktop Body-first companion widget)
- `packages/` — npm workspace packages (domain, companion, persistence, provider, memory, export)
- `tests/v2/` — cross-package contract tests
- `docs/adr/` — architecture decision records

## Key Commands

- `npm run dev` — start native Tauri desktop companion body widget
- `npm run v2:dev` — start Vite dev server only
- `npm run v2:test` — run contract tests
- `npm run v2:tauri dev` — run native Tauri desktop

## Architecture Notes

- Tauri commands in `src-tauri/src/lib.rs` exposed via `invoke()`
- Window auto-snap on drag near screen edges (30px threshold)
- Bilingual i18n (zh/en) via i18next
<!-- END AGENTSOUL V2 STARTUP -->
