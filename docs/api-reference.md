# AgentSoul API 参考文档

## 概述

本文档提供 AgentSoul 的完整 API 参考，包括 Python 模块、MCP 工具和配置管理工具。

## Python 模块

### 配置管理模块 (config_manager)

#### TemplateManager

模板管理器，用于加载、预览和应用配置模板。

```python
from src.config_manager.templates import TemplateManager

manager = TemplateManager()

# 列出所有模板
templates = manager.list_templates()

# 获取指定模板
template = manager.get_template("friendly")

# 预览模板
preview = manager.preview_template("friendly")
print(preview)

# 应用模板
success = manager.apply_template("professional")
```

#### ConfigValidator

配置验证器，用于验证配置文件格式。

```python
from src.config_manager.validator import ConfigValidator

validator = ConfigValidator()

# 验证配置
errors = validator.validate(config)

# 检查是否有效
is_valid = validator.is_valid(config)

# 打印错误
validator.print_errors(errors)
```

#### 命令行工具

```bash
# 列出所有模板
python -m src.config_manager.cli list-templates

# 预览模板
python -m src.config_manager.cli preview-template friendly

# 应用模板
python -m src.config_manager.cli apply-template professional

# 验证配置
python -m src.config_manager.cli validate-config

# 导出配置
python -m src.config_manager.cli export-config --output my_config.yaml
```

## MCP 工具

### 人格情感工具

#### get_persona_config

获取当前人格配置。

```typescript
const config = await get_persona_config();
console.log(config.agent.name);
console.log(config.master.name);
```

#### get_soul_state

读取当前 PAD 情感状态向量。

```typescript
const state = await get_soul_state();
console.log(state.pleasure);  // 愉悦度
console.log(state.arousal);   // 唤醒度
console.log(state.dominance); // 支配度
```

#### update_soul_state

更新情感状态。

```typescript
await update_soul_state({
  pleasure: 0.5,
  arousal: 0.3,
  dominance: 0.4
});
```

#### get_base_rules

获取基础规则文档。

```typescript
const rules = await get_base_rules({ name: "SKILL" });
console.log(rules);
```

#### get_mcp_usage_guide

获取完整 MCP 使用指南。

```typescript
const guide = await get_mcp_usage_guide();
console.log(guide);
```

#### mcp_tool_index

获取 MCP 工具索引。

```typescript
const index = await mcp_tool_index();
console.log(index.tools);
```

### 分层记忆工具

#### read_memory_day

读取指定日期的每日记忆。

```typescript
const memory = await read_memory_day({ date: "2024-04-01" });
console.log(memory);
```

#### write_memory_day

写入每日记忆。

```typescript
await write_memory_day({
  date: "2024-04-01",
  content: "今天的对话内容摘要..."
});
```

#### read_memory_week

读取指定周的每周记忆。

```typescript
const memory = await read_memory_week({ week: "2024-W14" });
console.log(memory);
```

#### write_memory_week

写入每周记忆。

```typescript
await write_memory_week({
  week: "2024-W14",
  content: "本周对话摘要..."
});
```

#### read_memory_month

读取指定月的每月记忆。

```typescript
const memory = await read_memory_month({ month: "2024-04" });
console.log(memory);
```

#### write_memory_month

写入每月记忆。

```typescript
await write_memory_month({
  month: "2024-04",
  content: "本月对话摘要..."
});
```

#### read_memory_year

读取指定年的每年记忆。

```typescript
const memory = await read_memory_year({ year: "2024" });
console.log(memory);
```

#### write_memory_year

写入每年记忆。

```typescript
await write_memory_year({
  year: "2024",
  content: "本年度对话摘要..."
});
```

#### read_memory_topic

读取主题记忆。

```typescript
const memory = await read_memory_topic({ topic: "项目开发" });
console.log(memory);
```

#### write_memory_topic

写入主题记忆。

```typescript
await write_memory_topic({
  topic: "项目开发",
  content: "项目开发相关的对话内容..."
});
```

#### list_memory_topics

列出记忆主题。

```typescript
const topics = await list_memory_topics({ status: "active" });
console.log(topics);
```

#### archive_memory_topic

归档记忆主题。

```typescript
await archive_memory_topic({ topic: "项目开发" });
```

### 核心记忆工具

#### core_memory_read

读取所有核心记忆条目。

```typescript
const memories = await core_memory_read();
console.log(memories);
```

#### core_memory_write

写入或更新一个键值事实。

```typescript
await core_memory_write({
  key: "user_preference",
  value: "喜欢简洁的回复"
});
```

#### core_memory_delete

删除一个核心记忆键。

```typescript
await core_memory_delete({ key: "user_preference" });
```

#### core_memory_list

列出所有核心记忆键。

```typescript
const keys = await core_memory_list();
console.log(keys);
```

### 实体记忆工具

#### entity_upsert

创建或更新结构化实体。

```typescript
await entity_upsert({
  name: "张三",
  type: "person",
  properties: {
    role: "同事",
    department: "技术部"
  }
});
```

#### entity_get

按名称获取特定实体。

```typescript
const entity = await entity_get({ name: "张三" });
console.log(entity);
```

#### entity_search

按关键词搜索实体。

```typescript
const entities = await entity_search({ query: "技术" });
console.log(entities);
```

#### entity_list

列出所有实体，可按类型过滤。

```typescript
const entities = await entity_list({ type: "person" });
console.log(entities);
```

#### entity_delete

按名称删除实体。

```typescript
await entity_delete({ name: "张三" });
```

#### entity_prune

清理久未提及的旧实体。

```typescript
await entity_prune({ days: 90 });
```

### 三级 KV 缓存工具

#### kv_cache_save

保存会话快照到三级缓存。

```typescript
await kv_cache_save({
  key: "session_123",
  content: "会话内容...",
  level: "hot"
});
```

#### kv_cache_load

加载最近的会话快照。

```typescript
const snapshot = await kv_cache_load({ key: "session_123" });
console.log(snapshot);
```

#### kv_cache_search

按关键词搜索缓存快照。

```typescript
const results = await kv_cache_search({ query: "项目" });
console.log(results);
```

#### kv_cache_list

列出项目的所有快照。

```typescript
const snapshots = await kv_cache_list();
console.log(snapshots);
```

#### kv_cache_gc

基于艾宾浩斯遗忘曲线执行垃圾回收。

```typescript
await kv_cache_gc();
```

#### kv_cache_backend_info

获取缓存后端信息和统计数据。

```typescript
const info = await kv_cache_backend_info();
console.log(info);
```

### Soul Board 项目看板工具

#### board_read

读取完整项目看板状态。

```typescript
const board = await board_read();
console.log(board);
```

#### board_update_summary

更新项目摘要。

```typescript
await board_update_summary({ summary: "项目当前进展..." });
```

#### board_add_decision

记录项目决策。

```typescript
await board_add_decision({
  decision: "采用 React 框架",
  context: "前端技术选型"
});
```

#### board_claim_file

声明文件所有权。

```typescript
await board_claim_file({ file: "src/index.ts" });
```

#### board_release_file

释放当前代理声明的所有文件。

```typescript
await board_release_file();
```

#### board_set_active_work

设置当前活跃工作任务。

```typescript
await board_set_active_work({ task: "实现登录功能" });
```

## 配置模板

### 内置模板

AgentSoul 提供 4 个预设配置模板：

1. **friendly** - 友好助手
   - 温暖、热情、善解人意
   - 适合日常陪伴和闲聊

2. **professional** - 专业顾问
   - 严谨、高效、可靠
   - 适合工作和专业场景

3. **creative** - 创意伙伴
   - 富有想象力、思维跳跃
   - 适合创意和头脑风暴

4. **minimal** - 简约助手
   - 简洁、直接、高效
   - 适合喜欢简洁风格的用户

### 使用模板

```bash
# 列出所有模板
python -m src.config_manager.cli list-templates

# 预览模板
python -m src.config_manager.cli preview-template friendly

# 应用模板
python -m src.config_manager.cli apply-template professional

# 验证配置
python -m src.config_manager.cli validate-config
```

## 配置验证

验证规则包括：

- Agent 名称不能为空
- 语气必须是：neutral, friendly, professional, casual
- 语言必须是：chinese, english
- Emoji 使用频率必须是：minimal, moderate, frequent
- 时区格式建议使用 Region/City 格式

## 数据目录结构

```
data/
├── identity/           # 身份档案
│   ├── self/          # Agent 身份
│   └── master/        # 用户身份
├── soul/              # 灵魂状态
│   └── soul_variable/ # 情感状态
├── memory/            # 记忆数据
│   ├── day/          # 每日记忆
│   ├── week/         # 每周记忆
│   ├── month/        # 每月记忆
│   ├── year/         # 每年记忆
│   └── topic/        # 主题记忆
└── learning/          # 学习数据（新增）
    ├── interactions.jsonl # 交互记录
    └── preferences.json   # 用户偏好
```

## 错误处理

所有 MCP 工具都可能返回错误，建议使用 try-catch：

```typescript
try {
  const result = await some_tool();
  console.log(result);
} catch (error) {
  console.error("工具调用失败:", error);
}
```
