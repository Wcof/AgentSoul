# AgentSoul Startup (Codex)

Codex currently has no stable SessionStart prompt hook equivalent. Use this startup checklist at the beginning of each session:

1. Call `mcp__agentsoul__mcp_tool_index()`
2. Call `mcp__agentsoul__get_persona_config()`
3. Call `mcp__agentsoul__get_soul_state()`
4. Call `mcp__agentsoul__get_base_rules` with `name="SKILL"`
5. Call `mcp__agentsoul__get_base_rules` with `name="memory_base"`
6. Call `mcp__agentsoul__get_mcp_usage_guide()`
7. Call `mcp__agentsoul__list_memory_topics()`

Memory write minimum:
- end of session: `write_memory_day`
- topic updates: `write_memory_topic`
- fact changes: `entity_fact_invalidate` then `entity_fact_add`
