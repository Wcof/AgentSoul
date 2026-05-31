# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AgentSoul v2 is a local-first AI Agent Companion framework built with TypeScript and Tauri. It provides:
- Desktop Companion — a floating pet widget with sprite animation and auto-snap to screen edges
- Control Center — a full configuration UI with tab-based navigation
- Gateway — local HTTP server for channel routing, cost tracking, and session management
- PAD (Pleasure-Arousal-Dominance) emotion model for affective computing
- Hierarchical memory, entity memory, core memory, and KV-Cache
- MCP adapter for Model Context Protocol integration
- Safety policy with approval flows and risk notices

**Environment Requirements**:
- Node.js 18+
- Rust (for Tauri desktop builds)

## Common Commands

### Development
```bash
# Install dependencies
npm install

# Run desktop-v2 in browser dev mode (Vite)
npm run v2:dev

# Launch with Gateway sidecar
cd apps/desktop-v2 && npm run launch

# Run Tauri native desktop build
npm run v2:tauri dev
```

### Testing
```bash
# Run all v2 contract tests
npm run v2:test

# Run specific package tests
npm run companion:test      # Companion runtime + soul + prompt + PAD
npm run gateway:test        # Gateway server + agent-loop + direct-call
npm run safety:test
npm run skills:test
npm run sessions:test
npm run persistence:test
npm run provider:test
npm run mcp-adapter:test
npm run export:test
npm run memory:test

# Run frontend tests
npx vitest run apps/desktop-v2/tests/

# Run all package tests
vitest run
```

### Type Checking
```bash
# Type check desktop-v2
npm run v2:typecheck

# Type check all packages
npm run domain:typecheck
npm run gateway:typecheck
npm run safety:typecheck
# ... etc for each package
```

### Build
```bash
# Build desktop-v2 frontend
npm run v2:build
```

## Code Architecture

### Directory Structure
```
AgentSoul/
├── apps/
│   └── desktop-v2/                # Tauri desktop app
│       ├── src/                   # Frontend (TypeScript)
│       │   ├── main.ts            # Entry point, bootstrap
│       │   ├── renderers.ts       # All HTML rendering functions
│       │   ├── controller.ts      # Event binding and interaction logic
│       │   ├── canvas-renderer.ts # Canvas 2D animation for sprites
│       │   ├── styles.css         # All CSS with tab routing
│       │   ├── types.ts           # TypeScript interfaces
│       │   ├── i18n/              # Bilingual (zh/en) localization
│       │   └── utils/             # Modal, context menu, window snap
│       ├── src-tauri/             # Rust backend (Tauri)
│       │   └── src/lib.rs         # Tauri commands, asset loading
│       └── tests/                 # Frontend tests
├── packages/
│   ├── domain/                    # Shared domain types (pure types, no deps)
│   ├── companion/                 # Core: runtime, PAD, health, config, personality
│   ├── gateway/                   # Local HTTP gateway (channels, cost, audit)
│   ├── persistence/               # SQLite init, migrate, ControlPlaneStore
│   ├── sessions/                  # Session management + SessionRepository
│   ├── provider/                  # Provider profiles + credential store
│   ├── safety/                    # Safety policy engine + approval flows
│   ├── skills/                    # Skill pack management
│   ├── memory/                    # Unified: memory + entity + semantic
│   ├── mcp-adapter/               # MCP protocol adapter (protocol conversion only)
│   └── export/                    # Data export
├── tests/
│   └── v2/                        # Cross-package contract tests
├── docs/
│   ├── adr/                       # Architecture Decision Records
│   └── v2/                        # v2 documentation
└── data/
    └── desktop-v2/                # SQLite databases
```

### Core Components

1. **Desktop Companion (Tauri)**
   - Floating pet widget with canvas sprite animation
   - Auto-snaps to screen edges when dragged near
   - Right-click context menu for interactions
   - Two shell modes: `desktop-companion` (pet) and `control-center` (full UI)

2. **Control Center**
   - Tab-based navigation via `data-active-tab` CSS routing
   - Areas: Companion, Gateway, Skills, Sessions, Conversations, Costs, Safety, Settings, MCP, Prompts
   - App switcher for multi-app management

3. **Gateway**
   - Local HTTP server with channel routing
   - Cost tracking and audit records
   - Provider profile management

4. **Memory System**
   - Hierarchical: Daily/Weekly/Monthly/Yearly + topic-based
   - Core Memory: persistent key-value facts
   - Entity Memory: structured tracking (person, project, concept, etc.)
   - KV-Cache: 3-tier session cache with automatic GC

5. **Safety & Security**
   - 3-level security model: PUBLIC / PROTECTED / SEALED
   - Approval flows for high-risk actions
   - Risk notices with client authorization mode

### Key Design Patterns

- **CSS Tab Routing**: Navigation uses `data-active-tab` attribute on `.shell` element, CSS selectors show/hide content areas
- **Tauri Commands**: Rust backend exposes commands via `invoke()` from frontend
- **Window Snap**: Desktop companion listens to `onMoved` events and snaps to edges within 30px threshold
- **i18n**: Bilingual support (zh/en) via i18next, language persisted in localStorage

## Important Development Notes

### Workspace Structure
This is an npm workspace monorepo. Each package in `packages/` has its own `package.json`, tests, and TypeScript config.

### Tauri Development
- Frontend is standard TypeScript/Vite
- Backend is Rust (Tauri v2)
- Commands are registered in `lib.rs` via `tauri::generate_handler![]`
- Window config is in `src-tauri/tauri.conf.json`

### Testing Strategy
- Contract tests in `tests/v2/` verify cross-package integration
- Package-level tests in `packages/*/tests/` verify unit behavior
- Frontend tests in `apps/desktop-v2/tests/` verify UI rendering
