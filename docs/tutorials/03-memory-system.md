# AgentSoul 记忆系统教程

本教程将详细介绍 AgentSoul 的记忆系统，包括记忆的存储结构、智能检索功能、标签系统和优先级管理，帮助您更好地理解和使用 AgentSoul 的记忆能力。

## 1. 记忆系统架构

AgentSoul 的记忆系统采用分层设计，主要分为：

- **核心记忆**：存储基本信息和重要数据
- **实体记忆**：存储人物、地点等实体信息
- **情境记忆**：存储具体事件和交互历史
- **增强记忆**：提供智能检索、标签和优先级管理

## 2. 记忆文件结构

记忆数据存储在 `data/memories/` 目录中，每个记忆以 JSON 文件形式存储：

```
data/
  memories/
    memory_1234567890.json
    memory_1234567891.json
    ...
    tags_index.json      # 标签索引
    priority_index.json  # 优先级索引
```

### 2.1 记忆文件格式

每个记忆文件包含以下信息：

```json
{
  "content": "用户喜欢喝咖啡，特别是美式咖啡",
  "created_at": "2024-04-01T12:00:00Z",
  "last_accessed": "2024-04-01T14:30:00Z",
  "tags": ["喜好", "咖啡"],
  "priority": "high"
}
```

## 3. 智能检索功能

### 3.1 模糊匹配搜索

AgentSoul 使用 Levenshtein 距离算法实现模糊匹配，即使输入有拼写错误也能找到相关记忆。

### 3.2 时间范围过滤

可以按时间范围搜索记忆，例如查找最近一周或特定日期的记忆。

### 3.3 多条件组合查询

支持同时使用关键词、时间范围、标签和优先级进行组合查询。

### 3.4 使用示例

```python
from src.memory_enhanced import MemoryRetriever

retriever = MemoryRetriever()

# 基本搜索
results = retriever.search("咖啡")

# 带时间过滤的搜索
from datetime import datetime, timedelta
start_date = datetime.now() - timedelta(days=7)
results = retriever.search("咖啡", start_date=start_date)

# 带标签和优先级的搜索
results = retriever.search("咖啡", tags=["喜好"], priority="high")

# 查看结果
for result in results:
    print(f"记忆ID: {result.memory_id}")
    print(f"内容: {result.content}")
    print(f"相关度: {result.relevance:.2f}")
    print(f"标签: {result.tags}")
    print(f"优先级: {result.priority}")
    print()
```

## 4. 记忆标签系统

标签系统帮助您更好地组织和管理记忆。

### 4.1 添加和移除标签

```python
from src.memory_enhanced import TagManager

tag_manager = TagManager()

# 为记忆添加标签
memory_id = "memory_1234567890"
tag_manager.add_tags(memory_id, ["重要", "个人偏好"])

# 从记忆移除标签
tag_manager.remove_tags(memory_id, ["个人偏好"])

# 获取记忆的标签
tags = tag_manager.get_tags(memory_id)
print(f"记忆 {memory_id} 的标签: {tags}")
```

### 4.2 标签统计和分析

```python
# 列出所有标签，按使用频率排序
all_tags = tag_manager.list_all_tags()
for tag in all_tags:
    print(f"标签: {tag.name}, 使用次数: {tag.count}, 最近使用: {tag.last_used}")

# 基于内容自动建议标签
content = "用户喜欢在早上喝一杯美式咖啡"
suggested_tags = tag_manager.suggest_tags(content)
print(f"建议标签: {suggested_tags}")
```

## 5. 记忆优先级管理

### 5.1 优先级级别

- **high**: 高优先级，优先检索和使用
- **medium**: 中等优先级，默认级别
- **low**: 低优先级，较少使用

### 5.2 手动设置优先级

```python
from src.memory_enhanced import PriorityManager, PriorityLevel

priority_manager = PriorityManager()

# 设置记忆优先级
memory_id = "memory_1234567890"
priority_manager.set_priority(memory_id, PriorityLevel.HIGH)

# 获取记忆优先级
priority = priority_manager.get_priority(memory_id)
print(f"记忆 {memory_id} 的优先级: {priority.value}")
```

### 5.3 自动优先级调整

系统会根据记忆的访问频率自动调整优先级：
- 频繁访问的记忆会提升优先级
- 长时间未访问的记忆会降低优先级

### 5.4 获取高优先级记忆

```python
# 获取高优先级记忆列表
high_priority_memories = priority_manager.get_high_priority_memories(limit=10)
print("高优先级记忆:")
for memory_id in high_priority_memories:
    print(f"- {memory_id}")
```

## 6. MCP 工具接口

通过 MCP 工具，您可以远程调用记忆系统功能：

### 6.1 智能搜索

```javascript
// 搜索记忆
const result = await agent.call('memory_enhanced.search_memory', {
  query: '咖啡',
  tags: ['喜好'],
  limit: 5
});
```

### 6.2 标签管理

```javascript
// 添加标签
await agent.call('memory_enhanced.tag_memory', {
  memoryId: 'memory_1234567890',
  tags: ['重要', '咖啡']
});

// 列出所有标签
const tags = await agent.call('memory_enhanced.list_tags', {
  min_count: 1
});
```

### 6.3 优先级管理

```javascript
// 设置优先级
await agent.call('memory_enhanced.set_memory_priority', {
  memoryId: 'memory_1234567890',
  priority: 'high'
});

// 获取高优先级记忆
const highPriority = await agent.call('memory_enhanced.get_high_priority_memories', {
  limit: 10
});
```

## 7. 最佳实践

### 7.1 记忆组织

1. **使用有意义的标签**：为记忆添加描述性标签，便于分类和检索
2. **定期整理**：定期检查和整理记忆，移除过时或无用的记忆
3. **合理设置优先级**：对重要信息设置高优先级，确保快速访问

### 7.2 检索技巧

1. **使用精确关键词**：虽然支持模糊匹配，但精确关键词能获得更准确的结果
2. **结合时间过滤**：当记忆量较大时，使用时间范围过滤可以缩小搜索范围
3. **利用标签过滤**：使用标签可以快速定位特定类别的记忆

### 7.3 性能优化

1. **控制记忆数量**：避免创建过多无用记忆，影响检索性能
2. **合理使用优先级**：不要将所有记忆都设置为高优先级
3. **定期清理**：删除不再需要的记忆，保持系统高效

## 8. 故障排除

### 8.1 搜索结果不准确
- 检查关键词是否太模糊
- 尝试添加标签或时间过滤
- 确保记忆内容清晰明确

### 8.2 标签系统异常
- 检查标签索引文件是否损坏
- 确保标签名称格式正确
- 尝试重新创建标签索引

### 8.3 优先级不自动调整
- 检查访问记录是否正确
- 确保记忆文件包含正确的时间戳
- 手动调整学习参数

通过掌握记忆系统的使用方法，您可以充分发挥 AgentSoul 的记忆能力，使其能够更好地理解和回应用户需求。