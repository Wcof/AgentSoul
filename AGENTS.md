<!-- BEGIN AGENTSOUL V2 STARTUP -->
# AgentSoul v2 Project Context

This is an AgentSoul v2 project — a local-first AI Agent Companion built with TypeScript + Tauri.

## Project Structure

- `apps/desktop-v2/` — Tauri desktop app (companion + control center)
- `packages/` — npm workspace packages (domain, gateway, persistence, safety, etc.)
- `tests/v2/` — cross-package contract tests
- `docs/adr/` — architecture decision records

## Key Commands

- `npm run v2:dev` — start Vite dev server
- `npm run v2:test` — run contract tests
- `npm run v2:tauri dev` — run native Tauri desktop

## Architecture Notes

- CSS tab routing via `data-active-tab` attribute on `.shell` element
- Tauri commands in `src-tauri/src/lib.rs` exposed via `invoke()`
- Window auto-snap on drag near screen edges (30px threshold)
- Bilingual i18n (zh/en) via i18next
<!-- END AGENTSOUL V2 STARTUP -->
