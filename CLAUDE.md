# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AgentSoul is a general-purpose AI Agent personality framework. It provides:
- Configurable AI identity and user profile
- PAD (Pleasure-Arousal-Dominance) emotion model for affective computing
- Hierarchical memory management system
- MCP Service exposing personality and memory capabilities via Model Context Protocol
- OpenClaw deep integration support

**Environment Requirements**:
- Python 3.10+
- Node.js 18+ (required for MCP server installation)

## Common Commands

### Installation & Setup
```bash
# Interactive installation (default)
python3 install.py

# Generate persona package only
python3 install.py --persona

# Generate with custom agent name
python3 install.py --persona --name "小明"

# Install and start MCP service (requires Node.js 18+)
python3 install.py --mcp

# Install MCP without starting
python3 install.py --mcp --no-run

# Install to OpenClaw (current session scope)
python3 install.py --openclaw --scope current

# Install to OpenClaw (global permanent)
python3 install.py --openclaw --scope global
```

### Development
```bash
# Run all tests (unittest style, works with pytest too)
python3 -m pytest tests/ -v

# Run a single test file
python3 -m pytest tests/test_agent_soul.py -v

# Or run directly with unittest
python3 -m unittest tests/test_agent_soul.py -v

# Run privacy scan (check for sensitive information)
python3 scripts/scan_privacy.py

# Migrate from old xiaonuan project to AgentSoul
python3 scripts/migrate_from_xiaonuan.py /path/to/old/config

# Build MCP server manually
cd mcp-server && npm install && npm run build
```

## Code Architecture

### Directory Structure
```
AgentSoul/
├── config/
│   ├── persona.yaml              # Main persona configuration
│   └── behavior.yaml             # Behavior configuration (feature toggles)
├── src/
│   ├── __init__.py               # Module initialization, version info
│   ├── config_loader.py          # Configuration loader (dataclass model)
│   ├── path_compat.py            # Path compatibility utilities
│   ├── openclaw_installer.py     # OpenClaw integration installer
│   ├── SKILL.md                  # Top-level personality rules & security policy
│   ├── soul_base.md              # PAD affective computing engine rules
│   ├── memory_base.md            # Memory system rules
│   ├── master_base.md            # User profile rules
│   ├── secure_base.md            # Security protocol (PROTECTED level)
│   ├── skills_base.md            # Skill system rules
│   └── tasks_base.md             # Task scheduling rules
├── mcp-server/                   # MCP service implementation (TypeScript)
│   ├── src/
│   │   ├── index.ts              # MCP service entry
│   │   ├── types.ts              # Type definitions
│   │   ├── storage.ts            # Storage utilities
│   │   ├── lib/                  # Core libraries (from soul-main)
│   │   │   ├── core-memory.ts    # Per-agent persistent facts
│   │   │   ├── entity-memory.ts  # Structured entity tracking
│   │   │   ├── soul-engine.ts    # Soul Board & Ledger
│   │   │   ├── utils.ts          # Shared utilities
│   │   │   ├── config.ts         # Configuration
│   │   │   └── kv-cache/         # 3-tier KV-Cache with Ebbinghaus GC
│   │   └── tools/
│   │       ├── soul.ts           # Soul/personality tools
│   │       ├── memory.ts         # Memory tools
│   │       ├── core-memory.ts     # Core memory MCP tools
│   │       ├── entity-memory.ts   # Entity memory MCP tools
│   │       ├── kv-cache.ts       # KV-Cache MCP tools
│   │       └── soul-board.ts      # Soul Board & Ledger tools
├── scripts/
│   ├── scan_privacy.py           # Privacy scanning tool
│   └── migrate_from_xiaonuan.py  # Migration tool
├── tests/
│   └── test_agent_soul.py        # Unit tests
├── common/
│   └── __init__.py               # Common utilities (logging, etc)
└── install.py                    # Main installation script
```

### Core Components

1. **Configuration Loader** (`src/config_loader.py`):
   - Uses dataclasses (`AgentConfig`, `MasterConfig`, `PersonaConfig`, `BehaviorConfig`) for type-safe configuration
   - Supports multiple config formats with fallback logic for backward compatibility
   - Caches configuration in memory for performance
   - Converts to legacy format for compatibility with existing integrations

2. **Rule Files** (`src/*.md`):
   - Markdown files define system architecture and behavior rules
   - `SKILL.md`: Top-level personality rules, security levels, startup flow
   - `soul_base.md`: PAD (Pleasure-Arousal-Dominance) emotional space model, state transition algorithm
   - `memory_base.md`: Full hierarchical memory system - daily/weekly/monthly/yearly time-slice memory + topic-based memory with archiving
   - `master_base.md`: User profile rules
   - `secure_base.md`: Security protocol definition
   - `skills_base.md`: Skill system rules
   - `tasks_base.md`: Task scheduling rules

3. **Installation Script** (`install.py`):
   - Creates identity profile files in `data/identity/`
   - Interactive bilingual configuration wizard for guided setup
   - Automates MCP server installation (Node.js/TypeScript)
   - Supports OpenClaw workspace integration
   - Bilingual (Chinese/English) interactive selection for all configurable fields

4. **MCP Server** (`mcp-server/`):
   - Exposes personality and memory tools via Model Context Protocol
   - Full multi-language support (Chinese/English) for tool descriptions
   - Available tools:
     - `get_persona_config`: Get current persona configuration
     - `get_soul_state`: Read current PAD emotion state
     - `update_soul_state`: Update emotion state
     - `get_base_rules`: Get base rules documentation with security access control
     - `get_mcp_usage_guide`: Get complete MCP usage guide and workflow instructions (mandatory on startup)
     - `mcp_tool_index`: Agent research tool - get MCP tool reference (full index or by category/tool name)
     - `read_memory_day`: Read daily memory by date (YYYY-MM-DD)
     - `write_memory_day`: Write daily memory
     - `read_memory_week`: Read weekly memory by week (YYYY-WW)
     - `write_memory_week`: Write weekly memory
     - `read_memory_month`: Read monthly memory by month (YYYY-MM)
     - `write_memory_month`: Write monthly memory
     - `read_memory_year`: Read yearly memory by year (YYYY)
     - `write_memory_year`: Write yearly memory
     - `read_memory_topic`: Read topic memory
     - `write_memory_topic`: Write topic memory
     - `list_memory_topics`: List memory topics filtered by status
     - `archive_memory_topic`: Archive a memory topic

### New Tools (from soul-main integration)

#### Core Memory Tools
Core memory provides per-agent persistent key-value facts that are auto-injected at boot:
- `core_memory_read`: Read all core memory entries for an agent
- `core_memory_write`: Write or update a key-value fact in core memory
- `core_memory_delete`: Delete a key from core memory
- `core_memory_list`: List all keys in core memory

#### Entity Memory Tools
Structured entity tracking for people, hardware, projects, concepts, places, and services:
- `entity_upsert`: Create or update a structured entity
- `entity_get`: Get a specific entity by name
- `entity_search`: Search entities by keyword
- `entity_list`: List all entities, optionally filtered by type
- `entity_delete`: Delete an entity by name
- `entity_prune`: Prune old entities not mentioned recently

#### 3-Tier KV-Cache Tools
Session cache with automatic Hot/Warm/Cold tiering and Ebbinghaus forgetting curve GC:
- `kv_cache_save`: Save a session snapshot to the 3-tier KV-Cache
- `kv_cache_load`: Load the most recent session snapshot with automatic token trimming
- `kv_cache_search`: Search across KV-Cache snapshots by keyword
- `kv_cache_list`: List all snapshots for a project
- `kv_cache_gc`: Run garbage collection based on Ebbinghaus forgetting curve
- `kv_cache_backend_info`: Get KV-Cache backend information and statistics

#### Soul Board Tools (P2)
Project state management and multi-agent safety:
- `board_read`: Read the complete project board state
- `board_update_summary`: Update the project summary
- `board_add_decision`: Record a project decision
- `board_claim_file`: Claim file ownership (prevents multi-agent conflicts)
- `board_release_file`: Release all files claimed by this agent
- `board_set_active_work`: Set the current active work task

#### Ledger Tools (P2)
Immutable work session ledger:
- `ledger_list`: List ledger entries for a project
- `ledger_read`: Read a specific ledger entry by ID

### Security Model

The framework enforces a strict 3-level security model:
- **Level 1 (PUBLIC)**: Can be directly read/quoted in conversations
- **Level 2 (PROTECTED)**: Internal use only, cannot output raw content
- **Level 3 (SEALED)**: Strictly forbidden to output in any context (API keys, credentials)

**Priority**: Sealed layer security > Privacy protection > Task completion > User experience

## Configuration

### Persona Configuration (`config/persona.yaml`)
```yaml
agent:
  name: AgentName                # Agent's name
  nickname: ''                   # Agent's nickname
  role: AI Assistant             # Role description
  personality:                   # List of personality traits
    - friendly
    - professional
  core_values:                   # List of core values
    - user_privacy_protection
  interaction_style:
    tone: neutral                # neutral/friendly/professional/casual
    language: chinese            # chinese/english
    emoji_usage: minimal         # minimal/moderate/frequent

master:
  name: ''                       # User's name (optional)
  nickname: []                   # List of user nicknames (optional)
  timezone: Asia/Shanghai        # User's timezone
  labels: []                     # User's labels/interests
```

### Behavior Configuration (`config/behavior.yaml`)
```yaml
enabled: true                    # Enable/disable AgentSoul
auto_memory: true               # Automatic memory updates
emotional_response: true        # Enable emotional responses
task_scheduling: true           # Enable task scheduling
memory_daily_summary: true      # Automatic daily memory summary
response_length_limit: 0        # Response length limit (0 = unlimited)
forbidden_topics: []            # List of forbidden topics
allowed_topics: []              # List of allowed topics (empty = all allowed)
priority:                       # Behavior priority (top = higher priority)
  - privacy_protection
  - task_completion
  - emotional_support
  - professional_assistance
```

## Installation Flow

1. When `install.py` starts, it first runs `check_and_initialize_configs()`:
   - Detects if existing soul and master configurations exist
   - If neither exists (first-time install): forces initialization
   - If some exist: asks user whether to re-initialize
   - If initialization is confirmed: offers choice of interactive configuration wizard

2. Interactive configuration wizard (`run_interactive_config_wizard()`):
   - Language selection (Chinese/English)
   - Guides through all agent configuration fields
   - Uses numbered selection for enum-style choices (no free text input, avoids errors)
   - Bilingual display names for all options
   - Guides through all master configuration fields
   - Shows summary before writing
   - Writes directly to `config/persona.yaml`
   - Initializes default PAD soul state
   - Updates identity profiles via `initialize_identity()`

3. Proceeds with selected installation mode (generate persona, install MCP, or install OpenClaw)

## Generated Output Files

When run with `--persona`, the installer generates:
- `agent-persona.md` - Complete personality profile for Claude Desktop/Trae and other AI editors
- `.cursorrules` - Cursor editor rules (auto-loaded by Cursor)
- `.windsurfrules` - Windsurf editor rules (auto-loaded by Windsurf)

When installing to OpenClaw, it creates:
- `data/identity/self/` - AI identity profile
- `data/identity/master/` - User identity profile
- `data/soul/` - PAD emotion state storage
- `data/memory/` - Hierarchical memory directories
- `agent/base_rules/` - All AgentSoul base rules
