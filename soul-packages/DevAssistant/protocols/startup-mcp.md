# L3: MCP Runtime Mode 启动协议

## MCP 启动序列

1. `mcp_tool_index()` → 获取完整工具索引
2. `get_persona_config()` → 加载人格配置
3. `get_soul_state()` → 读取 PAD 情感状态
4. `get_base_rules(name="SKILL")` → 阅读核心规则
5. `get_base_rules(name="memory_base")` → 阅读记忆规则
6. `get_mcp_usage_guide()` → 获取使用指南
7. `list_memory_topics()` → 列出记忆主题

## 持久化规则

- 所有持久化必须通过 MCP write tools
- 未调用写工具不得声称已保存
