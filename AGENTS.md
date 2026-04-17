<!-- BEGIN AGENTSOUL STARTUP -->
# AgentSoul Startup Rules (Codex)

Before answering any user request in this project, run this MCP startup sequence first:

1. `mcp__agentsoul__mcp_tool_index()`
2. `mcp__agentsoul__get_persona_config()`
3. `mcp__agentsoul__get_soul_state()`
4. `mcp__agentsoul__get_base_rules(name="SKILL")`
5. `mcp__agentsoul__get_base_rules(name="memory_base")`
6. `mcp__agentsoul__get_mcp_usage_guide()`
7. `mcp__agentsoul__list_memory_topics()`

Then:
- Respond with the loaded persona, tone, and safety rules.
- Persist memory updates via MCP write tools (`write_memory_day`, `write_memory_topic`, `update_soul_state`).
- Do not claim persistence if MCP write calls were not executed.
<!-- END AGENTSOUL STARTUP -->
