# AgentSoul 功能深化实施计划

## 审计发现

### 测试覆盖缺口
| 模块 | 代码行数 | 测试文件数 | 状态 |
|------|---------|-----------|------|
| fact_extractor.py | 606 | 0 | ❌ 无测试 |
| semantic.py | 709 | 0 (仅有1个间接测试) | ❌ 无独立测试 |
| pad_adjuster.py | 158 | 间接覆盖 | ⚠️ 缺少深度测试 |
| preference_learner.py | 152 | 间接覆盖 | ⚠️ 缺少深度测试 |
| data_collector.py | 134 | 间接覆盖 | ⚠️ 缺少深度测试 |

### PAD 情感引擎不足
- ✅ 基础 PAD 状态 (P/A/D)
- ✅ 反馈调整 (positive/negative/neutral)
- ✅ 交互长度调整
- ❌ **能量指标** (对话轮次疲劳、时间衰减)
- ❌ **人格漂移检测** (长期 PAD 趋势偏离基线)
- ❌ **事件扰动** (重大事件对情绪的冲击模型)
- ❌ **情绪命名** (PAD→情绪标签映射)

### 语义搜索链路未贯通
- ✅ Python EmbeddingService + VectorStore + SemanticRetriever
- ✅ TypeScript 嵌入服务 + VectorStore + SemanticRetriever
- ✅ MCP 工具: semantic_search, check_deduplication, index_memory, rebuild_index, merge_memories
- ❌ **记忆写入时自动索引** (write_memory_* 后应自动调用 index_memory)
- ❌ **Python↔TS 数据格式统一** (两者独立的向量存储不互通)

### Web UI 缺失可视化
- ✅ 健康度趋势图
- ✅ PAD 情绪条
- ✅ 记忆列表/搜索
- ✅ 陪伴连续性报告
- ❌ **实体记忆查看器**
- ❌ **PAD 3D 空间可视化** (情绪点云/轨迹)
- ❌ **记忆合并操作**

---

## 实施优先级

### P1: 核心引擎深化 (最高价值)
1. **PAD 情感引擎 v2** — 能量指标、漂移检测、事件扰动、情绪命名
2. **记忆自动索引管道** — 写入→自动嵌入→索引

### P2: 测试覆盖补全 (质量保障)
3. **fact_extractor 测试套件**
4. **semantic 测试套件**
5. **PAD 引擎深度测试**

### P3: Web UI 增强 (用户体验)
6. **实体记忆查看器**
7. **PAD 3D 情绪空间**

---

## 详细设计

### 1. PAD 情感引擎 v2
**文件**: `src/adaptive_learning/pad_engine.py` (新文件)

```python
@dataclass
class EnergyMetrics:
    """能量指标 - 追踪 Agent 的认知资源消耗"""
    cognitive_load: float = 0.0     # 认知负荷 (0-1)
    fatigue_level: float = 0.0      # 疲劳度 (0-1) 
    attention_span: float = 1.0     # 注意力持续 (0-1)
    turn_count: int = 0             # 当前会话轮次
    last_rest_time: datetime | None # 上次休息时间

@dataclass  
class PADStateV2(PADState):
    """扩展 PAD 状态"""
    energy: EnergyMetrics
    baseline: PADState               # 人格基线 (从配置加载)
    drift_score: float = 0.0        # 漂移分 (0-1, 越高越偏离)
    emotion_label: str = "neutral"  # 情绪命名

class PADEngine:
    """完整 PAD 引擎 - 整合所有情绪计算"""
    
    def apply_event_perturbation(event_type, intensity) -> PADStateV2
    def compute_drift() -> float
    def name_emotion(p, a, d) -> str  # PAD→情绪标签
    def decay_over_time(hours) -> PADStateV2
    def adjust_for_fatigue(turn_count) -> PADStateV2
```

**情绪命名映射表** (基于 Mehrabian 1996):
| P | A | D | 情绪 |
|---|---|---|------|
| + | + | + | 兴奋/自信 |
| + | + | - | 依赖/崇拜 |
| + | - | + | 放松/从容 |
| + | - | - | 温顺/安心 |
| - | + | + | 愤怒/敌对 |
| - | + | - | 焦虑/恐惧 |
| - | - | + | 无聊/轻蔑 |
| - | - | - | 忧郁/悲伤 |

### 2. 记忆自动索引管道
**修改**: `mcp_server/src/storage.ts` + `mcp_server/src/index.ts`

在每次 `write_memory_*` 后，自动触发语义索引：
- 写入成功 → 调用 `indexMemory(memoryId, content, metadata)`
- 如果嵌入服务不可用 → 静默降级（不影响记忆写入）
- 批量写入 → 延迟索引 (debounce)

### 3-5. 测试套件
为新模块和已有未测模块创建完整测试。

### 6-7. Web UI
在现有 `web-ui/index.html` 中添加 Tab 页。
