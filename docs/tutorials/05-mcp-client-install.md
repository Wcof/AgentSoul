# AgentSoul MCP Client Install Guide (Claude + Codex)

This file is generated/updated by `install.py` during MCP installation.

## 中文

### 官方文档

- Claude Code MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- Codex MCP: https://developers.openai.com/codex/mcp

### Claude CLI 安装

```bash
claude mcp add-json agentsoul '{"command":"node","args":["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]}'
claude mcp add-json --scope user agentsoul '{"command":"node","args":["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]}'
```

### Claude CLI 卸载

```bash
claude mcp remove agentsoul
claude mcp remove --scope user agentsoul
```

### Codex CLI 安装（config.toml）

写入 `~/.codex/config.toml`（全局）或 `<project>/.codex/config.toml`（本地）：

```toml
# BEGIN AGENTSOUL MCP
[mcp_servers.agentsoul]
command = "node"
args = ["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]
# END AGENTSOUL MCP
```

### Codex CLI 卸载

删除 `config.toml` 中 `# BEGIN AGENTSOUL MCP` 到 `# END AGENTSOUL MCP` 的整段。

### 启动后记忆流程（必须）

1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

最小读写闭环：

- 读取：`read_memory_topic`
- 写入：`write_memory_day` + `write_memory_topic`
- 事实变更：`entity_fact_invalidate` -> `entity_fact_add`

## English

### Official docs

- Claude Code MCP: https://docs.anthropic.com/en/docs/claude-code/mcp
- Codex MCP: https://developers.openai.com/codex/mcp

### Claude CLI install

```bash
claude mcp add-json agentsoul '{"command":"node","args":["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]}'
claude mcp add-json --scope user agentsoul '{"command":"node","args":["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]}'
```

### Claude CLI uninstall

```bash
claude mcp remove agentsoul
claude mcp remove --scope user agentsoul
```

### Codex CLI install (config.toml)

Write into `~/.codex/config.toml` (global) or `<project>/.codex/config.toml` (local):

```toml
# BEGIN AGENTSOUL MCP
[mcp_servers.agentsoul]
command = "node"
args = ["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]
# END AGENTSOUL MCP
```

### Codex CLI uninstall

Remove the block between `# BEGIN AGENTSOUL MCP` and `# END AGENTSOUL MCP`.

### Required startup memory workflow

1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

Minimal read/write loop:

- Read: `read_memory_topic`
- Write: `write_memory_day` + `write_memory_topic`
- Fact change: `entity_fact_invalidate` -> `entity_fact_add`
