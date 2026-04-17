# AgentSoul MCP Client Install Guide (Claude + Codex + Trae)

## 中文

### Claude CLI 安装
```bash
claude mcp add-json agentsoul '{"command":"node","args":["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]}'
claude mcp add-json --scope user agentsoul '{"command":"node","args":["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]}'
```

### Claude CLI 卸载
```bash
claude mcp remove agentsoul
claude mcp remove --scope user agentsoul
```

### Codex CLI 安装（config.toml）
将以下片段写入 `~/.codex/config.toml`（全局）或 `<project>/.codex/config.toml`（本地）：
```toml
# BEGIN AGENTSOUL MCP
[mcp_servers.agentsoul]
command = "node"
args = ["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]
# END AGENTSOUL MCP
```

### Codex CLI 卸载
删除 `config.toml` 中 `# BEGIN AGENTSOUL MCP` 到 `# END AGENTSOUL MCP` 的整段。

### Trae 安装（mcp.json）
将以下 JSON 写入 `~/.trae/mcp.json`（全局）或 `<project>/.trae/mcp.json`（本地）：
```json
{
  "mcpServers": {
    "agentsoul": {"command":"node","args":["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]}
  }
}
```

### 启动后记忆流程（必须）
1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

最小读写闭环：`read_memory_topic` -> 对话 -> `write_memory_day` + `write_memory_topic`；事实变化使用 `entity_fact_invalidate` + `entity_fact_add`。

## English

### Claude CLI install
```bash
claude mcp add-json agentsoul '{"command":"node","args":["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]}'
claude mcp add-json --scope user agentsoul '{"command":"node","args":["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]}'
```

### Claude CLI uninstall
```bash
claude mcp remove agentsoul
claude mcp remove --scope user agentsoul
```

### Codex CLI install (config.toml)
Write this block to `~/.codex/config.toml` (global) or `<project>/.codex/config.toml` (local):
```toml
# BEGIN AGENTSOUL MCP
[mcp_servers.agentsoul]
command = "node"
args = ["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]
# END AGENTSOUL MCP
```

### Codex CLI uninstall
Remove the full managed block between `# BEGIN AGENTSOUL MCP` and `# END AGENTSOUL MCP`.

### Trae install (mcp.json)
Write this JSON to `~/.trae/mcp.json` (global) or `<project>/.trae/mcp.json` (local):
```json
{
  "mcpServers": {
    "agentsoul": {"command":"node","args":["/Users/ldh/Downloads/project/AgentSoul/apps/mcp-server/dist/index.js"]}
  }
}
```

### Required startup memory workflow
1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

Minimal read/write loop: `read_memory_topic` -> conversation -> `write_memory_day` + `write_memory_topic`; on fact change use `entity_fact_invalidate` then `entity_fact_add`.
