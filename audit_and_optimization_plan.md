# AgentSoul 代码审计与功能完善计划

## 1. 代码审计结果

### 1.1 发现的问题

#### templates.py
- **问题**：`get_template()` 每次都调用 `list_templates()`，效率不高
- **建议**：添加内部缓存，避免重复加载

#### validator.py
- **问题**：验证方法有很多重复的模式
- **建议**：提取通用验证辅助函数，减少重复代码

#### cli.py
- **问题**：路径处理和错误处理有重复
- **建议**：提取通用的辅助函数，简化命令处理

### 1.2 优化优先级

| 优先级 | 优化项 | 文件 | 预期收益 |
|--------|--------|------|----------|
| P0 | 添加模板缓存 | templates.py | 性能提升 |
| P1 | 提取验证辅助函数 | validator.py | 代码可读性 |
| P1 | 简化 CLI 命令处理 | cli.py | 代码可维护性 |

---

## 2. 功能完善计划

### 2.1 P1 - 记忆系统增强

#### 2.1.1 智能检索模块 (src/memory_enhanced/retrieval.py)
**功能特性**：
- Levenshtein 距离模糊匹配
- 时间范围过滤
- 相关度排序算法
- 支持多条件组合查询

**技术设计**：
```python
@dataclass
class SearchResult:
    memory_id: str
    content: str
    relevance: float
    tags: List[str]
    last_accessed: datetime
    priority: str = "medium"

class MemoryRetriever:
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
    
    def levenshtein_distance(self, s1: str, s2: str) -> int:
        """计算编辑距离"""
        pass
    
    def fuzzy_match_score(self, query: str, text: str) -> float:
        """计算模糊匹配分数 (0.0-1.0)"""
        pass
    
    def search(
        self,
        query: str,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
        tags: Optional[List[str]] = None,
        priority: Optional[str] = None,
        limit: int = 10
    ) -> List[SearchResult]:
        """高级搜索"""
        pass
```

#### 2.1.2 记忆标签系统 (src/memory_enhanced/tags.py)
**功能特性**：
- 为记忆添加/移除标签
- 标签统计和热词分析
- 按标签检索记忆
- 自动标签建议

**技术设计**：
```python
@dataclass
class TagInfo:
    name: str
    count: int
    last_used: datetime

class TagManager:
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
        self._tags_cache: Dict[str, TagInfo] = {}
    
    def add_tags(self, memory_id: str, tags: List[str]) -> None:
        """为记忆添加标签"""
        pass
    
    def remove_tags(self, memory_id: str, tags: List[str]) -> None:
        """移除记忆标签"""
        pass
    
    def get_tags(self, memory_id: str) -> List[str]:
        """获取记忆的标签"""
        pass
    
    def list_all_tags(self, min_count: int = 1) -> List[TagInfo]:
        """列出所有标签，按使用频率排序"""
        pass
    
    def suggest_tags(self, content: str, limit: int = 5) -> List[str]:
        """基于内容自动建议标签"""
        pass
```

#### 2.1.3 记忆优先级管理 (src/memory_enhanced/priority.py)
**功能特性**：
- 三级优先级：high/medium/low
- 基于访问频率自动调整
- 支持手动设置优先级
- 高优先级记忆优先检索

**技术设计**：
```python
from enum import Enum

class PriorityLevel(Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class MemoryPriority:
    memory_id: str
    level: PriorityLevel
    access_count: int
    last_accessed: datetime
    manual_override: bool = False

class PriorityManager:
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
    
    def set_priority(self, memory_id: str, level: PriorityLevel) -> None:
        """手动设置优先级"""
        pass
    
    def get_priority(self, memory_id: str) -> PriorityLevel:
        """获取记忆优先级"""
        pass
    
    def record_access(self, memory_id: str) -> None:
        """记录访问，可能自动调整优先级"""
        pass
    
    def get_high_priority_memories(self, limit: int = 20) -> List[str]:
        """获取高优先级记忆列表"""
        pass
```

### 2.2 P2 - 智能学习与自适应

#### 2.2.1 交互数据收集 (src/adaptive_learning/data_collector.py)
**功能特性**：
- 记录对话元数据
- 收集用户反馈（👍/👎）
- 记录 PAD 状态变化
- JSONL 格式存储，便于分析

**技术设计**：
```python
@dataclass
class InteractionRecord:
    session_id: str
    timestamp: datetime
    pad_before: Dict[str, float]
    pad_after: Dict[str, float]
    feedback: Optional[str] = None
    response_length: Optional[int] = None
    topics: Optional[List[str]] = None

class DataCollector:
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.interactions_file = data_path / "interactions.jsonl"
    
    def record(self, record: InteractionRecord) -> None:
        """记录交互数据"""
        pass
    
    def get_recent(self, limit: int = 100) -> List[InteractionRecord]:
        """获取最近的交互记录"""
        pass
    
    def get_statistics(self) -> Dict[str, Any]:
        """获取交互统计数据"""
        pass
```

#### 2.2.2 用户偏好学习 (src/adaptive_learning/preference_learner.py)
**功能特性**：
- 学习用户偏好的响应长度
- 学习用户偏好的语气
- 学习用户偏好的 emoji 使用
- 偏好持久化存储

**技术设计**：
```python
@dataclass
class UserPreferences:
    preferred_tone: str = "neutral"
    preferred_response_length: int = 0  # 0 = no preference
    preferred_emoji_freq: str = "minimal"
    preferred_topics: List[str] = field(default_factory=list)
    learning_confidence: Dict[str, float] = field(default_factory=dict)

class PreferenceLearner:
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.preferences_file = data_path / "preferences.json"
        self._preferences: Optional[UserPreferences] = None
    
    def learn_from_feedback(self, interaction: InteractionRecord, feedback: str) -> None:
        """从用户反馈中学习"""
        pass
    
    def get_preferences(self) -> UserPreferences:
        """获取学习到的偏好"""
        pass
    
    def reset(self) -> None:
        """重置学习数据"""
        pass
```

#### 2.2.3 PAD 渐进式调整 (src/adaptive_learning/pad_adjuster.py)
**功能特性**：
- 基于用户反馈微调 PAD 状态
- 调整幅度限制在 ±0.1 每次
- 学习强度配置（0.0-1.0）
- 支持一键重置

**技术设计**：
```python
@dataclass
class PADState:
    pleasure: float = 0.3
    arousal: float = 0.2
    dominance: float = 0.3
    last_updated: Optional[datetime] = None

class PADAdjuster:
    def __init__(self, data_path: Path, learning_intensity: float = 0.3):
        self.data_path = data_path
        self.learning_intensity = learning_intensity
        self.state_file = data_path / "pad_state.json"
        self._state: Optional[PADState] = None
    
    def adjust_from_feedback(self, current_state: PADState, feedback: str) -> PADState:
        """根据反馈调整 PAD 状态"""
        feedback_multipliers = {
            "positive": {"pleasure": 0.1, "arousal": 0.05, "dominance": 0.0},
            "negative": {"pleasure": -0.1, "arousal": -0.05, "dominance": 0.05},
        }
        
        multiplier = feedback_multipliers.get(feedback, {})
        delta_p = multiplier.get("pleasure", 0) * self.learning_intensity
        delta_a = multiplier.get("arousal", 0) * self.learning_intensity
        delta_d = multiplier.get("dominance", 0) * self.learning_intensity
        
        return PADState(
            pleasure=max(-1.0, min(1.0, current_state.pleasure + delta_p)),
            arousal=max(-1.0, min(1.0, current_state.arousal + delta_a)),
            dominance=max(-1.0, min(1.0, current_state.dominance + delta_d)),
            last_updated=datetime.now()
        )
    
    def set_learning_intensity(self, intensity: float) -> None:
        """设置学习强度 (0.0-1.0)"""
        self.learning_intensity = max(0.0, min(1.0, intensity))
    
    def reset(self) -> None:
        """重置到默认状态"""
        self._state = PADState()
        self._save_state()
```

#### 2.2.4 MCP 工具扩展 (mcp_server/src/tools/adaptive.ts 和 memory_enhanced.ts)

**adaptive.ts 功能**：
```typescript
// 获取学习到的偏好
get_learning_preferences()

// 提交用户反馈
submit_feedback(feedback: 'positive' | 'negative')

// 重置学习数据
reset_learning()

// 设置学习强度
set_learning_intensity(intensity: number)

// 获取交互统计
get_interaction_statistics()
```

**memory_enhanced.ts 功能**：
```typescript
// 智能搜索记忆
search_memory(query: string, options?: SearchOptions)

// 为记忆添加标签
tag_memory(memoryId: string, tags: string[])

// 移除记忆标签
untag_memory(memoryId: string, tags: string[])

// 获取记忆标签
get_memory_tags(memoryId: string)

// 列出所有标签
list_tags(options?: TagListOptions)

// 设置记忆优先级
set_memory_priority(memoryId: string, priority: 'high' | 'medium' | 'low')

// 获取高优先级记忆
get_high_priority_memories(limit?: number)
```

---

## 3. 实施计划

### 阶段一：代码优化（第 1 天）
- [ ] 优化 templates.py，添加模板缓存
- [ ] 优化 validator.py，提取辅助函数
- [ ] 优化 cli.py，简化命令处理
- [ ] 运行所有测试确保通过

### 阶段二：记忆系统增强（第 2-3 天）
- [ ] 实现 retrieval.py（智能检索）
- [ ] 实现 tags.py（标签系统）
- [ ] 实现 priority.py（优先级管理）
- [ ] 实现 memory_enhanced.ts（MCP 工具）
- [ ] 编写单元测试
- [ ] 运行测试

### 阶段三：智能学习模块（第 4-5 天）
- [ ] 实现 data_collector.py（数据收集）
- [ ] 实现 preference_learner.py（偏好学习）
- [ ] 实现 pad_adjuster.py（PAD 调整）
- [ ] 实现 adaptive.ts（MCP 工具）
- [ ] 编写单元测试
- [ ] 运行测试

### 阶段四：集成与文档（第 6 天）
- [ ] 更新 API 文档
- [ ] 更新教程文档
- [ ] 完整功能测试
- [ ] 性能测试
- [ ] 最终验收

---

## 4. 验收标准

### 代码优化验收
- [ ] 所有现有测试通过
- [ ] 新代码有类型注解
- [ ] 新代码有 docstring
- [ ] 代码通过 black 和 ruff 检查

### 功能验收
- [ ] 记忆搜索功能正常
- [ ] 标签系统正常工作
- [ ] 优先级管理正常
- [ ] 数据收集功能正常
- [ ] 偏好学习功能正常
- [ ] PAD 调整功能正常
- [ ] MCP 工具可以正常调用

### 文档验收
- [ ] API 文档已更新
- [ ] 教程文档已更新
- [ ] CHANGELOG 已更新
