# AgentSoul MCP 工具使用教程

本教程将介绍 AgentSoul 的 MCP (Model Context Protocol) 工具系统，包括核心工具的使用方法、参数说明和示例代码，帮助您更好地与 AgentSoul 进行交互。

## 1. MCP 工具概述

MCP 工具是 AgentSoul 提供的一组功能接口，允许外部系统或用户通过标准化的方式调用 AgentSoul 的各种功能。主要包括：

- **灵魂状态管理**：管理 Agent 的情感状态和行为模式
- **记忆管理**：操作和查询 Agent 的记忆系统
- **增强记忆**：智能检索、标签管理和优先级控制
- **自适应学习**：用户偏好学习和 PAD 状态调整

## 2. 核心工具使用

### 2.1 灵魂状态管理 (soul)

#### 2.1.1 获取灵魂状态

```javascript
const result = await agent.call('soul.get_soul_state', {});
console.log('灵魂状态:', result.data);
```

#### 2.1.2 设置 PAD 状态

```javascript
await agent.call('soul.set_pad_state', {
  pleasure: 0.6,
  arousal: 0.4,
  dominance: 0.5
});
```

### 2.2 基础记忆工具 (memory)

#### 2.2.1 存储记忆

```javascript
const memoryId = await agent.call('memory.store_memory', {
  content: '用户喜欢喝咖啡',
  tags: ['喜好', '咖啡']
});
console.log('记忆ID:', memoryId);
```

#### 2.2.2 检索记忆

```javascript
const memories = await agent.call('memory.retrieve_memories', {
  query: '咖啡',
  limit: 5
});
console.log('检索结果:', memories);
```

## 3. 增强记忆工具 (memory_enhanced)

### 3.1 智能搜索

**功能**：使用模糊匹配和多条件过滤搜索记忆

**参数**：
- `query`: 搜索关键词
- `start_date`: 开始日期 (ISO格式)
- `end_date`: 结束日期 (ISO格式)
- `tags`: 标签列表
- `priority`: 优先级 ('high'/'medium'/'low')
- `limit`: 结果数量限制

**示例**：

```javascript
const results = await agent.call('memory_enhanced.search_memory', {
  query: '咖啡',
  start_date: '2024-03-01T00:00:00Z',
  tags: ['喜好'],
  priority: 'high',
  limit: 5
});

console.log('搜索结果:');
results.data.forEach(item => {
  console.log(`- 相关度: ${item.relevance.toFixed(2)}, 内容: ${item.content}`);
});
```

### 3.2 标签管理

#### 3.2.1 添加标签

```javascript
await agent.call('memory_enhanced.tag_memory', {
  memoryId: 'memory_1234567890',
  tags: ['重要', '个人偏好']
});
```

#### 3.2.2 移除标签

```javascript
await agent.call('memory_enhanced.untag_memory', {
  memoryId: 'memory_1234567890',
  tags: ['个人偏好']
});
```

#### 3.2.3 获取记忆标签

```javascript
const tags = await agent.call('memory_enhanced.get_memory_tags', {
  memoryId: 'memory_1234567890'
});
console.log('记忆标签:', tags.data);
```

#### 3.2.4 列出所有标签

```javascript
const allTags = await agent.call('memory_enhanced.list_tags', {
  min_count: 1
});
console.log('所有标签:');
allTags.data.forEach(tag => {
  console.log(`- ${tag.name} (使用 ${tag.count} 次)`);
});
```

### 3.3 优先级管理

#### 3.3.1 设置记忆优先级

```javascript
await agent.call('memory_enhanced.set_memory_priority', {
  memoryId: 'memory_1234567890',
  priority: 'high'
});
```

#### 3.3.2 获取高优先级记忆

```javascript
const highPriority = await agent.call('memory_enhanced.get_high_priority_memories', {
  limit: 10
});
console.log('高优先级记忆:', highPriority.data);
```

## 4. 自适应学习工具 (adaptive)

### 4.1 获取学习偏好

**功能**：获取系统学习到的用户偏好

**返回**：用户偏好数据，包括语气、响应长度、emoji使用频率等

**示例**：

```javascript
const preferences = await agent.call('adaptive.get_learning_preferences', {});
console.log('用户偏好:', preferences.data);
```

### 4.2 提交反馈

**功能**：提交用户反馈，用于系统学习

**参数**：
- `feedback`: 反馈类型 ('positive'/'negative'/'neutral')
- `pad_before`: 反馈前的 PAD 状态
- `pad_after`: 反馈后的 PAD 状态
- `response_length`: 响应长度
- `topics`: 话题标签
- `user_input`: 用户输入
- `agent_response`: 机器人响应

**示例**：

```javascript
await agent.call('adaptive.submit_feedback', {
  feedback: 'positive',
  pad_before: { pleasure: 0.5, arousal: 0.3, dominance: 0.4 },
  pad_after: { pleasure: 0.7, arousal: 0.4, dominance: 0.4 },
  response_length: 150,
  topics: ['咖啡', '喜好'],
  user_input: '我喜欢喝什么样的咖啡？',
  agent_response: '您喜欢美式咖啡，对吗？'
});
```

### 4.3 重置学习

**功能**：重置学习数据为默认值

**示例**：

```javascript
await agent.call('adaptive.reset_learning', {});
console.log('学习数据已重置');
```

### 4.4 设置学习强度

**功能**：设置 PAD 调整的学习强度

**参数**：
- `intensity`: 学习强度 (0.0-1.0)

**示例**：

```javascript
await agent.call('adaptive.set_learning_intensity', {
  intensity: 0.5
});
```

### 4.5 获取交互统计

**功能**：获取交互数据统计信息

**示例**：

```javascript
const stats = await agent.call('adaptive.get_interaction_statistics', {});
console.log('交互统计:', stats.data);
```

## 5. 工具组合使用

### 5.1 完整的记忆管理流程

```javascript
// 1. 存储记忆
const memoryId = await agent.call('memory.store_memory', {
  content: '用户喜欢在早上喝美式咖啡',
  tags: ['咖啡', '习惯']
});

// 2. 设置高优先级
await agent.call('memory_enhanced.set_memory_priority', {
  memoryId: memoryId,
  priority: 'high'
});

// 3. 添加更多标签
await agent.call('memory_enhanced.tag_memory', {
  memoryId: memoryId,
  tags: ['早上', '个人偏好']
});

// 4. 搜索相关记忆
const results = await agent.call('memory_enhanced.search_memory', {
  query: '咖啡',
  tags: ['个人偏好'],
  priority: 'high'
});

// 5. 提交反馈
await agent.call('adaptive.submit_feedback', {
  feedback: 'positive',
  topics: ['咖啡', '习惯']
});
```

### 5.2 情感状态调整流程

```javascript
// 1. 获取当前 PAD 状态
const currentState = await agent.call('soul.get_soul_state', {});

// 2. 提交用户反馈并调整 PAD
await agent.call('adaptive.submit_feedback', {
  feedback: 'positive',
  pad_before: currentState.data.pad
});

// 3. 获取更新后的 PAD 状态
const updatedState = await agent.call('soul.get_soul_state', {});
console.log('更新后的 PAD 状态:', updatedState.data.pad);
```

## 6. 最佳实践

### 6.1 工具调用技巧

1. **错误处理**：始终处理工具调用的错误
   ```javascript
try {
  const result = await agent.call('memory_enhanced.search_memory', { query: '咖啡' });
  // 处理结果
} catch (error) {
  console.error('工具调用失败:', error);
}
```

2. **参数验证**：在调用工具前验证参数
   ```javascript
if (!query || typeof query !== 'string') {
  console.error('搜索关键词不能为空');
  return;
}
```

3. **合理使用限制**：避免频繁调用工具，设置合理的结果限制
   ```javascript
// 合理设置结果数量
const results = await agent.call('memory_enhanced.search_memory', {
  query: '咖啡',
  limit: 10  // 限制为10个结果
});
```

### 6.2 性能优化

1. **批量操作**：尽量合并多个操作，减少工具调用次数
2. **缓存结果**：对频繁使用的数据进行本地缓存
3. **异步调用**：使用异步方式调用工具，避免阻塞主线程

### 6.3 安全性

1. **输入验证**：验证所有用户输入，防止注入攻击
2. **权限控制**：根据用户权限限制工具使用
3. **数据保护**：敏感数据加密存储

## 7. 工具扩展

### 7.1 自定义工具

如果默认工具不能满足需求，您可以创建自定义工具：

1. 在 `mcp_server/src/tools/` 目录创建新的工具文件
2. 继承 `Tool` 基类并实现相应方法
3. 在 `tools/index.ts` 中导出新工具
4. 重启 MCP 服务器

### 7.2 工具调用示例

#### Python 客户端示例

```python
import requests
import json

def call_tool(tool_name, params):
    url = "http://localhost:3000/api/call"
    data = {
        "tool": tool_name,
        "params": params
    }
    response = requests.post(url, json=data)
    return response.json()

# 调用搜索工具
result = call_tool('memory_enhanced.search_memory', {
    "query": "咖啡",
    "limit": 5
})
print(result)
```

#### Node.js 客户端示例

```javascript
const axios = require('axios');

async function callTool(toolName, params) {
  const response = await axios.post('http://localhost:3000/api/call', {
    tool: toolName,
    params: params
  });
  return response.data;
}

// 调用搜索工具
const result = await callTool('memory_enhanced.search_memory', {
  query: '咖啡',
  limit: 5
});
console.log(result);
```

## 8. 故障排除

### 8.1 工具调用失败
- 检查网络连接是否正常
- 确认 MCP 服务器是否运行
- 验证参数格式是否正确
- 查看服务器日志获取详细错误信息

### 8.2 搜索结果不准确
- 尝试使用更精确的关键词
- 检查记忆是否正确存储
- 验证标签是否正确添加

### 8.3 学习系统不生效
- 确保已提交足够的反馈数据
- 检查学习强度设置是否合理
- 验证数据存储路径是否正确

通过本教程，您应该能够熟练使用 AgentSoul 的 MCP 工具系统，充分发挥其功能优势。如果遇到问题，请参考故障排除部分或查看详细的 API 文档。