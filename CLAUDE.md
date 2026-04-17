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
python3 install.py --persona --name "AgentName"

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
# Run all tests
python3 -m pytest tests/ -v

# Run a single test file
python3 -m pytest tests/test_health_check.py -v

# Run privacy scan (check for sensitive information)
python3 scripts/scan_privacy.py

# Build MCP server manually
cd mcp_server && npm install && npm run build

# Type checking with mypy
mypy src/

# Linting with ruff
ruff check src/

# Format code with black
black src/
```

### Health Check CLI (for CI/automation)
```bash
# Full health check with text output
python3 src/health_check.py

# Full health check with machine-readable JSON output (uses standard HealthSummary schema)
python3 src/health_check.py --summary-json

# Health check with score gate - exits with non-zero if score < 70 (for CI)
python3 src/health_check.py --min-score 70

# Companionship continuity check (measures 5 core metrics)
python3 src/companionship_checker.py

# Entry detection - detects current running environment
python3 src/entry_detect.py
```

## Code Architecture

### Directory Structure
```
AgentSoul/
├── common/                     # Root common Python utilities (project root, not src/common)
│   └── __init__.py            # Provides `get_project_root()`, `log`, `load_config`
├── config/                    # Configuration files
│   ├── persona.yaml           # Main persona configuration (AI + user)
│   └── behavior.yaml          # Behavior toggles and priorities
├── schemas/                   # JSON Schema definitions for interoperability
│   └── health-summary.json    # Unified HealthSummary schema for all CLI checkers
├── src/                       # Python core framework
│   ├── config_loader.py       # Type-safe configuration loader
│   ├── path_compat.py         # Path compatibility utilities
│   ├── *.md                   # System rule files (SKILL, soul_base, memory_base, etc.)
│   ├── adaptive_learning/     # Adaptive learning module
│   ├── common/                # Common modules within src
│   │   └── health_gate.py     # Shared health gate types and utilities (used by all 3 checkers)
│   ├── config_manager/        # Configuration management (CLI, templates, validation)
│   └── memory_enhanced/       # Enhanced memory (priority, tags, search)
├── .github/workflows/         # GitHub Actions CI examples
│   ├── health-check.yml       # Example: health check CI gate
│   └── companionship-check.yml # Example: companionship check CI gate
├── apps/mcp-server/                # MCP server implementation (TypeScript)
│   ├── src/
│   │   ├── index.ts           # MCP service entry
│   │   ├── tools/             # Individual tool implementations
│   │   │   ├── soul.ts        # Soul/personality tools
│   │   │   ├── memory.ts      # Hierarchical memory tools
│   │   │   ├── adaptive.ts    # Adaptive learning tools
│   │   │   ├── memory_enhanced.ts # Enhanced memory tools
│   │   │   ├── core-memory.ts # Core memory tools
│   │   │   ├── entity-memory.ts # Entity memory tools
│   │   │   ├── kv-cache.ts    # KV-Cache tools
│   │   │   ├── soul-board.ts  # Soul Board & Ledger tools
│   │   │   └── subscription.ts # Event subscription & webhook push
│   │   ├── lib/               # Core libraries
│   │   │   └── kv-cache/      # 3-tier KV-Cache with Ebbinghaus GC
│   │   └── language/          # Multi-language support (中文/英文)
├── integrations/openclaw/           # OpenClaw integration
├── scripts/                   # Utility scripts
├── tests/                     # Python unit tests
├── apps/web/                    # Pure static Web UI for visualization
└── install.py                 # Main installation script
```

### Core Components

1. **Configuration Layer**
   - `config_loader.py`: Dataclass-based configuration with fallback for backward compatibility
   - `src/*.md`: Markdown rule files define system architecture and behavior
   - Configuration validation ensures type safety

2. **MCP Server (TypeScript)**
   - Follows Model Context Protocol standard
   - Full multi-language support for tool descriptions
   - All tools are stateless, read/write from disk
   - Enforces 3-level security model (PUBLIC/PROTECTED/SEALED)

3. **Memory System**
   - **Hierarchical**: Daily/Weekly/Monthly/Yearly time-slice memory + topic-based memory
   - **Enhanced**: Priority + tags + fuzzy search
   - **Core Memory**: Per-agent persistent key-value facts, auto-injected at boot
   - **Entity Memory**: Structured tracking of person/hardware/project/concept/place/service
   - **KV-Cache**: 3-tier (hot/warm/cold) session snapshot cache with automatic GC

4. **Project Management**
   - **Soul Board**: Project state, decision tracking, file ownership for multi-agent safety
   - **Ledger**: Immutable work session ledger

5. **Additional Features**
   - **Event Subscription**: Webhook push notifications for memory writes, state changes
   - **PAD Emotion Model**: 3D emotional space with dynamic adjustments
   - **Adaptive Learning**: Learns user preferences from feedback
   - **Version Rollback**: Soul state snapshots can be rolled back

### Available MCP Tools by Category

| Category | Tools |
|----------|-------|
| **Soul/Personality** | `get_persona_config`, `write_persona_config`, `get_soul_state`, `update_soul_state`, `health_check`, `get_growth_curve`, `get_base_rules`, `get_mcp_usage_guide`, `mcp_tool_index`, `get_persona_version`, `list_soul_versions`, `rollback_soul` |
| **Hierarchical Memory** | `read_memory_day`, `write_memory_day`, `read_memory_week`, `write_memory_week`, `read_memory_month`, `write_memory_month`, `read_memory_year`, `write_memory_year`, `read_memory_topic`, `write_memory_topic`, `list_memory_topics`, `archive_memory_topic` |
| **Core Memory** | `core_memory_read`, `core_memory_write`, `core_memory_delete`, `core_memory_list` |
| **Entity Memory** | `entity_upsert`, `entity_get`, `entity_search`, `entity_list`, `entity_delete`, `entity_prune` |
| **Enhanced Memory** | `enhanced_memory_search`, `add_memory_tags`, `remove_memory_tags`, `get_memory_tags`, `list_all_tags`, `set_memory_priority`, `get_high_priority_memories` |
| **KV-Cache** | `kv_cache_save`, `kv_cache_load`, `kv_cache_search`, `kv_cache_list`, `kv_cache_gc`, `kv_cache_backend_info` |
| **Soul Board** | `board_read`, `board_update_summary`, `board_add_decision`, `board_claim_file`, `board_release_file`, `board_set_active_work`, `board_add_labels`, `board_remove_labels`, `board_list_labels`, `board_search_decisions` |
| **Ledger** | `ledger_list`, `ledger_read` |
| **Adaptive Learning** | `get_learning_preferences`, `get_interaction_statistics`, `submit_feedback`, `reset_learning`, `set_learning_intensity` |
| **Event Subscription** | `subscribe`, `unsubscribe`, `list_subscriptions` |

## Key MCP Usage Rules

In MCP mode, **all persistent memory must be written via MCP tools**. If you don't call the corresponding write tool, the memory cannot be saved and will be lost in the next conversation. This is a mandatory rule.

### Mandatory Startup Sequence (MCP Mode)
**Always call tools in this order:**
1. `mcp_tool_index` → Get complete tool index
2. `get_persona_config` → Load AI identity and user profile
3. `get_soul_state` → Load current PAD emotion state
4. `get_base_rules` with `name=SKILL` → Read top-level rules
5. `get_base_rules` with `name=memory_base` → Read memory rules
6. `get_mcp_usage_guide` → Confirm workflow
7. `list_memory_topics` → Understand active topics

### Mandatory Tool Call Timing
| Timing | Must Call Tool |
|--------|----------------|
| Conversation startup | `mcp_tool_index` first step |
| Conversation end | `write_memory_day` + `update_soul_state` |
| Weekend end | `write_memory_week` |
| Month end | `write_memory_month` |
| Year end | `write_memory_year` |
| Before discussing a topic | `read_memory_topic` |
| After discussing a topic | `write_memory_topic` |
| Topic completed | `archive_memory_topic` |

## Configuration

### Persona Configuration (`config/persona.yaml`)
```yaml
agent:
  name: AgentName
  nickname: ''
  role: AI Assistant
  personality: [friendly, professional]
  core_values: [user_privacy_protection]
  interaction_style:
    tone: neutral          # neutral/friendly/professional/casual
    language: chinese       # chinese/english
    emoji_usage: minimal    # minimal/moderate/frequent

master:
  name: ''                       # User name (optional)
  nickname: []                   # User nicknames (optional)
  timezone: Asia/Shanghai        # User timezone
  labels: []                     # User labels/interests
```

### Behavior Configuration (`config/behavior.yaml`)
```yaml
enabled: true
auto_memory: true
emotional_response: true
task_scheduling: true
memory_daily_summary: true
response_length_limit: 0
forbidden_topics: []
allowed_topics: []
priority:                           #靠前优先级更高
  - privacy_protection
  - task_completion
  - emotional_support
  - professional_assistance
```

## Security Model

The framework enforces a strict 3-level security model:
- **Level 1 (PUBLIC)**: Can be directly read/quoted in conversations
- **Level 2 (PROTECTED)**: Internal use only, cannot output raw content
- **Level 3 (SEALED)**: Strictly forbidden to output in any context (API keys, credentials)

**Priority**: Sealed layer security > Privacy protection > Task completion > User experience

## Important Development Notes

### Circular Import Pattern
The project has a circular import dependency for `get_project_root()`:
- `common/` at project root provides `get_project_root()`
- `src/` modules need to import from `common/`
- Therefore, **all CLI entry points in `src/` must manually calculate the project root before importing `common`** to avoid circular import errors.

Example pattern:
```python
# Calculate project root manually before importing common
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from common import get_project_root, log  # noqa: E402
```

## Generated Output Files

When run with `--persona`, the installer generates:
- `agent-persona.md` - Complete personality profile for Claude Desktop/Trae
- `.cursorrules` - Cursor editor rules (auto-loaded)
- `.windsurfrules` - Windsurf editor rules (auto-loaded)

When installing to OpenClaw, it creates:
- `data/identity/self/` - AI identity profile
- `data/identity/master/` - User identity profile
- `data/soul/` - PAD emotion state storage
- `data/memory/` - Hierarchical memory directories
- `agent/base_rules/` - All AgentSoul base rules
