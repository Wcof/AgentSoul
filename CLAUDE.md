# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

AgentSoul is a general-purpose AI Agent personality framework. It provides a configurable personality system for AI assistants with customizable AI identity, user profile, memory management, and affective computing based on PAD emotional model.

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
```

### Development
```bash
# Run all tests
python3 -m pytest tests/ -v

# Run a single test file
python3 -m pytest tests/test_agent_soul.py -v

# Run privacy scan
python3 scripts/scan_privacy.py
```

## Code Architecture

### Directory Structure
```
AgentSoul/
├── config/              # Configuration files
│   └── persona.yaml     # Main persona configuration (YAML)
├── src/                 # Core system
│   ├── __init__.py      # Module initialization, version info
│   ├── config_loader.py # Configuration loader (dataclass model)
│   ├── path_compat.py   # Path compatibility utilities
│   ├── SKILL.md         # Core personality rules & security policy
│   ├── soul_base.md     # PAD affective computing engine
│   ├── memory_base.md   # Memory system rules
│   ├── master_base.md   # User profile rules
│   ├── secure_base.md   # Security protocol
│   ├── skills_base.md   # Skill system rules
│   └── tasks_base.md    # Task scheduling rules
├── scripts/             # Utility scripts
│   └── scan_privacy.py  # Privacy scanning tool
├── tests/               # Unit tests
│   └── test_agent_soul.py
├── common/              # Common utilities
└── install.py           # Installation & setup script
```

### Core Components

1. **Configuration Loader** (`src/config_loader.py`):
   - Uses dataclasses (`AgentConfig`, `MasterConfig`, `PersonaConfig`) for type-safe configuration
   - Supports multiple config formats with fallback logic for backward compatibility
   - Caches configuration in memory for performance
   - Converts to legacy format for compatibility with existing integrations

2. **Rule Files** (`src/*.md`):
   - Markdown files define the system architecture and behavior rules
   - `SKILL.md`: Top-level personality rules, security levels, startup流程
   - `soul_base.md`: PAD emotional space model, state transition algorithm
   - Security levels: PUBLIC (L1), PROTECTED (L2), SEALED (L3) - strict access control

3. **Installation Script** (`install.py`):
   - Generates persona output for multiple editors: `.cursorrules`, `.windsurfrules`, `agent-persona.md`
   - Creates identity profile files in `data/identity/`
   - Supports MCP server installation (requires Node.js/TypeScript)
   - Supports OpenClaw integration

### Security Model

The framework enforces a strict 3-level security model:
- **Level 1 (PUBLIC)**: Can be directly read/quoted in conversations
- **Level 2 (PROTECTED)**: Internal use only, cannot output raw content
- **Level 3 (SEALED)**: Strictly forbidden to output in any context (API keys, credentials)

**Priority**: Sealed layer security > Privacy protection > Task completion > User experience

## Configuration

Edit `config/persona.yaml` to customize:
- `agent.name`: Agent name
- `agent.nickname`: Agent nickname
- `agent.role`: Agent role description
- `agent.personality`: List of personality traits
- `agent.core_values`: List of core values
- `master.name`: User name (optional)
- `master.nickname`: User nicknames (optional)
- `master.timezone`: User timezone (default: Asia/Shanghai)

## Output Generation

After installation, the script generates:
- `agent-persona.md`: Portable persona file for Claude Desktop/Trae/etc
- `.cursorrules`: Auto-loaded by Cursor editor
- `.windsurfrules`: Auto-loaded by Windsurf editor
