# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AgentSoul is a general-purpose AI Agent personality framework. It provides a configurable personality system for AI assistants with:
- Configurable AI identity and user profile
- PAD (Pleasure-Arousal-Dominance) emotion model for affective computing
- Hierarchical memory management system
- **MCP Service** exposes personality and memory capabilities via Model Context Protocol
- **OpenClaw** deep integration support

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
# Run all tests with pytest
python3 -m pytest tests/ -v

# Run a single test file
python3 -m pytest tests/test_agent_soul.py -v

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
│   ├── soul_base.md              # PAD affective computing engine
│   ├── memory_base.md            # Memory system rules
│   ├── master_base.md            # User profile rules
│   ├── secure_base.md            # Security protocol (PROTECTED)
│   ├── skills_base.md            # Skill system rules
│   └── tasks_base.md             # Task scheduling rules
├── mcp-server/                   # MCP service implementation (TypeScript)
├── scripts/
│   ├── scan_privacy.py           # Privacy scanning tool
│   └── migrate_from_xiaonuan.py  # Migration tool from old projects
├── tests/
│   └── test_agent_soul.py        # Unit tests
├── common/                       # Common utilities (logging, etc)
├── README.md                     # Project README
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
   - `soul_base.md`: PAD emotional space model, state transition algorithm
   - `memory_base.md`: Daily + topic-based memory with archiving
   - `secure_base.md`: Security protocol definition

3. **Installation Script** (`install.py`):
   - Creates identity profile files in `data/identity/`
   - Automates MCP server installation (Node.js/TypeScript)
   - Supports OpenClaw workspace integration

4. **MCP Server** (`mcp-server/`):
   - Exposes personality and memory tools via Model Context Protocol
   - Available tools: `get_persona_config`, `get_soul_state`, `update_soul_state`, `read_memory_day`, `write_memory_day`, `read_memory_topic`, `write_memory_topic`, etc.

### Security Model

The framework enforces a strict 3-level security model:
- **Level 1 (PUBLIC)**: Can be directly read/quoted in conversations
- **Level 2 (PROTECTED)**: Internal use only, cannot output raw content
- **Level 3 (SEALED)**: Strictly forbidden to output in any context (API keys, credentials)

**Priority**: Sealed layer security > Privacy protection > Task completion > User experience

## Configuration

### Persona Configuration (`config/persona.yaml`)
Edit to customize AI and user identity:
- `agent.name`: Agent name
- `agent.nickname`: Agent nickname
- `agent.role`: Agent role description
- `agent.personality`: List of personality traits
- `agent.core_values`: List of core values
- `master.name`: User name (optional)
- `master.nickname`: User nicknames (optional)
- `master.timezone`: User timezone (default: Asia/Shanghai)

### Behavior Configuration (`config/behavior.yaml`)
Controls feature toggles and runtime behavior:
- `enabled`: Enable/disable AgentSoul
- `auto_memory`: Automatic memory updates
- `emotional_response`: Enable emotional responses
- `task_scheduling`: Enable task scheduling
- `memory_daily_summary`: Automatic daily memory summary
- `forbidden_topics`: List of forbidden discussion topics
- `allowed_topics`: List of allowed discussion topics (empty = all allowed)

## Output Generation

After installation, the script generates:
- `agent-persona.md`: Portable persona file for Claude Desktop/Trae/etc
- `.cursorrules`: Auto-loaded by Cursor editor
- `.windsurfrules`: Auto-loaded by Windsurf editor
