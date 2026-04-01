# Changelog

All notable changes to AgentSoul will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- N/A

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [1.2.0] - 2024-04-01

### Added
- Memory system enhancements (src/memory_enhanced/)
  - Smart retrieval with fuzzy matching (Levenshtein distance)
  - Time range filtering for memory search
  - Relevance-based result sorting
  - Tag system for memory organization
  - Tag statistics and auto-suggestion
  - Three-level priority management (high/medium/low)
  - Auto-adjust priority based on access frequency
- Adaptive learning system (src/adaptive_learning/)
  - Interaction data collector with JSONL storage
  - User preference learning (response length, tone, emoji usage)
  - PAD progressive adjustment with feedback
  - Configurable learning intensity

### Changed
- Code optimization and refactoring
  - Added template caching to templates.py for better performance
  - Extracted common validation helpers in validator.py
  - Simplified CLI command processing with shared utilities
  - Improved code readability and maintainability

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [1.1.0] - 2024-04-01

### Added
- Configuration template system with 4 preset templates
  - friendly - 友好助手
  - professional - 专业顾问
  - creative - 创意伙伴
  - minimal - 简约助手
- Template management CLI tools
  - `list-templates` - List all available templates
  - `preview-template` - Preview template content
  - `apply-template` - Apply template with automatic backup
  - `validate-config` - Validate configuration file
  - `export-config` - Export current configuration
- Configuration validator
  - Validate required fields
  - Validate value ranges (e.g., PAD values between -1.0 and 1.0)
  - Validate interaction style options
  - Friendly error messages
- Project documentation
  - API reference documentation (docs/api-reference.md)
  - Getting started tutorial (docs/tutorials/01-getting-started.md)
  - Example code (examples/)
  - Custom configuration example
- Project metadata files
  - pyproject.toml - Modern Python project configuration
  - LICENSE - MIT license file
  - .editorconfig - Editor configuration
  - .env.example - Environment variable template
- Updated .gitignore with data/learning/ directory

### Changed
- Updated README.md with new features documentation
- Updated pyproject.toml with new module paths

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [1.0.0] - 2024-04-01

### Added
- Initial project structure
- Configuration loader with type safety
- PAD emotional model
- Hierarchical memory system
- MCP server implementation
- OpenClaw integration
- Multilingual support (Chinese/English)
- Privacy scanning tool
- Migration script from Xiaonuan
- Implemented three-tier security model (PUBLIC/PROTECTED/SEALED)
- Privacy scanning for sensitive information

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A


[Unreleased]: https://github.com/yourusername/agentsoul/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/agentsoul/releases/tag/v1.0.0
