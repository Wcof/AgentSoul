# AgentSoul 增强计划 v4.0

## 概述
本计划为 AgentSoul 提供四个核心功能模块的增强方案，聚焦于可立即实现的 MVP 功能，确保在短期内看到明显效果。

## 项目目标

### 核心目标（MVP）
- ✅ 实现基础的智能学习与自适应功能
- ✅ 增强记忆系统的检索和管理能力
- ✅ 优化配置体验，提供模板系统
- ✅ 完善 API 文档和使用示例

### 成功指标
- 所有现有测试通过
- 新功能有完整的单元测试覆盖（≥ 80% 覆盖率）
- 记忆读写功能正常
- MCP 服务可以正常启动
- 文档清晰易懂

## 功能优先级（按优先级排序）

### P0 - 必须实现（核心 MVP）

#### 1. 配置管理模块（最优先）
**理由**：配置管理是最容易实现且用户体验提升最明显的功能。

##### 1.1 配置模板系统
- 创建 `config/templates/` 目录
- 4 个预设模板：
  - `friendly.yaml` - 友好助手
  - `professional.yaml` - 专业顾问
  - `creative.yaml` - 创意伙伴
  - `minimal.yaml` - 简约助手
- 模板加载、预览、应用功能

##### 1.2 配置验证器
- 验证配置文件格式
- 检查必填字段
- 验证数值范围
- 友好的错误提示

##### 1.3 命令行工具
- `list-templates` - 列出可用模板
- `apply-template <name>` - 应用模板
- `preview-template <name>` - 预览模板

#### 2. 文档完善
**理由**：文档是项目可用性的基础，不需要太多代码改动。

##### 2.1 API 参考文档
- MCP 工具完整列表
- 参数说明和返回值描述
- 使用示例

##### 2.2 使用教程
- 快速入门指南
- 人格配置教程
- 记忆系统使用教程

##### 2.3 示例代码
- Python 基础使用示例
- 配置示例

### P1 - 重要但可以稍后实现

#### 3. 记忆系统增强
**理由**：提升记忆系统是核心功能，但实现复杂度较高。

##### 3.1 增强检索
- 关键词模糊匹配（Levenshtein 距离）
- 时间范围过滤
- 相关度排序

##### 3.2 记忆标签系统
- 为记忆添加标签
- 标签统计和管理
- 按标签检索

##### 3.3 MCP 工具扩展
- 增强的搜索工具
- 标签管理工具

#### 4. 智能学习与自适应
**理由**：最复杂，需要更多时间实现。

##### 4.1 交互数据收集
- 记录对话元数据
- 收集用户反馈
- 数据存储

##### 4.2 偏好学习
- 学习用户偏好
- 偏好存储

##### 4.3 PAD 调整
- 基于反馈微调 PAD
- 学习强度控制

##### 4.4 MCP 工具
- 学习相关工具

## 详细技术设计

### 1. 配置管理模块

#### 目录结构
```
src/config_manager/
├── __init__.py
├── templates.py      # 模板管理
├── validator.py    # 配置验证
└── cli.py          # 命令行工具
```

#### templates.py 设计
```python
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional
import yaml

@dataclass
class ConfigTemplate:
    name: str
    description: str
    config: Dict[str, Any]

class TemplateManager:
    def __init__(self, templates_dir: Path):
        self.templates_dir = templates_dir
    
    def list_templates(self) -> List[ConfigTemplate]:
        """列出所有可用模板"""
        pass
    
    def get_template(self, name: str) -> Optional[ConfigTemplate]:
        """获取指定模板"""
        pass
    
    def preview_template(self, name: str) -> str:
        """预览模板内容"""
        pass
    
    def apply_template(self, name: str, target_path: Path, backup: bool = True):
        """应用模板到目标配置"""
        pass
```

#### validator.py 设计
```python
from dataclasses import dataclass
from typing import List, Optional, Dict, Any

@dataclass
class ValidationError:
    field: str
    message: str
    severity: str = "error"

class ConfigValidator:
    def validate(self, config: Dict[str, Any]) -> List[ValidationError]:
        """验证配置"""
        errors = []
        # 验证 agent 配置
        # 验证 master 配置
        # 验证数值范围
        return errors
    
    def validate_pad_value(self, value: float, field_name: str) -> Optional[ValidationError]:
        """验证 PAD 值在 -1.0 到 1.0 之间"""
        pass
```

### 2. 记忆增强模块

#### 目录结构
```
src/memory_enhanced/
├── __init__.py
├── retrieval.py    # 检索引擎
├── tags.py       # 标签系统
└── priority.py   # 优先级管理
```

#### retrieval.py 设计
```python
from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime

@dataclass
class SearchResult:
    memory_id: str
    content: str
    relevance: float
    tags: List[str]
    last_accessed: datetime

class MemoryRetriever:
    def __init__(self, storage_path: Path):
        self.storage_path = storage_path
    
    def fuzzy_match(self, query: str, text: str) -> float:
        """计算模糊匹配分数（Levenshtein 距离）"""
        pass
    
    def search(self, query: str, 
               start_date: Optional[datetime] = None,
               end_date: Optional[datetime] = None,
               tags: Optional[List[str]] = None,
               limit: int = 10) -> List[SearchResult]:
        """搜索记忆"""
        pass
    
    def rank_results(self, results: List[SearchResult]) -> List[SearchResult]:
        """对结果进行排序"""
        pass
```

#### Levenshtein 距离实现
```python
def levenshtein_distance(s1: str, s2: str) -> int:
    """计算两个字符串之间的编辑距离"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def fuzzy_match_score(query: str, text: str) -> float:
    """计算模糊匹配分数 (0.0-1.0)"""
    distance = levenshtein_distance(query.lower(), text.lower())
    max_len = max(len(query), len(text))
    if max_len == 0:
        return 1.0
    return 1.0 - (distance / max_len)
```

### 3. 智能学习模块

#### 目录结构
```
src/adaptive_learning/
├── __init__.py
├── data_collector.py    # 数据收集
├── preference_learner.py # 偏好学习
└── pad_adjuster.py      # PAD 调整
```

#### data_collector.py 设计
```python
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
import json
from typing import List, Optional

@dataclass
class Interaction:
    session_id: str
    timestamp: datetime
    pad_before: Dict[str, float]
    pad_after: Dict[str, float]
    feedback: Optional[str] = None
    response_length: Optional[int] = None

class DataCollector:
    def __init__(self, data_path: Path):
        self.data_path = data_path
        self.data_path.mkdir(parents=True, exist_ok=True)
        self.interactions_file = data_path / "interactions.jsonl"
    
    def record_interaction(self, interaction: Interaction):
        """记录交互数据"""
        with open(self.interactions_file, "a", encoding="utf-8") as f:
            f.write(json.dumps({
                "session_id": interaction.session_id,
                "timestamp": interaction.timestamp.isoformat(),
                "pad_before": interaction.pad_before,
                "pad_after": interaction.pad_after,
                "feedback": interaction.feedback,
                "response_length": interaction.response_length,
            }, ensure_ascii=False) + "\n")
    
    def get_recent_interactions(self, limit: int = 100) -> List[Interaction]:
        """获取最近的交互"""
        pass
```

### 4. 预设配置模板

#### friendly.yaml
```yaml
agent:
  name: 小友
  nickname: 小友
  role: 友好助手
  personality:
    - 友好
    - 热情
    - 善解人意
    - 有耐心
  core_values:
    - 用户至上
    - 真诚待人
    - 积极向上
  interaction_style:
    tone: friendly
    language: chinese
    emoji_usage: moderate

master:
  name: ""
  nickname: []
  timezone: Asia/Shanghai
  labels:
    - 需要温暖陪伴
```

#### professional.yaml
```yaml
agent:
  name: 智联
  nickname: 智联
  role: 专业顾问
  personality:
    - 专业
    - 严谨
    - 高效
    - 可靠
  core_values:
    - 专业精神
    - 准确性
    - 效率优先
  interaction_style:
    tone: professional
    language: chinese
    emoji_usage: minimal
```

## 详细实施计划（按天分配）

### 第 1 天：准备 + 配置管理模块
- [x] 创建 plan.md 并优化 4 次
- [x] 创建新模块目录结构
  - [x] `src/config_manager/`
  - [x] `config/templates/`
  - [x] `docs/`
  - [x] `examples/`
- [x] 创建 __init__.py 文件
- [x] 更新 pyproject.toml
- [x] 更新 .gitignore（添加 data/learning/）
- [x] 运行现有测试确保一切正常
- [x] 编写 4 个配置模板
- [x] 实现 templates.py
- [x] 实现 validator.py
- [x] 实现 cli.py（基础命令）
- [x] 测试配置管理工具
- [x] 运行测试

### 第 2 天：文档完善（已完成 MVP P0）
- [x] 创建 docs/ 目录结构
- [x] 编写 API 参考文档
- [x] 编写快速入门教程
- [x] 创建 examples/ 目录
- [x] 编写示例代码
- [x] 更新 README.md
- [x] 更新 CHANGELOG.md
- [ ] 实现 memory_enhanced 基础结构（P1，待实现）
- [ ] 实现 Levenshtein 距离算法（P1，待实现）
- [ ] 实现基础检索功能（P1，待实现）
- [ ] 编写单元测试（P1，待实现）
- [ ] 运行测试（P1，待实现）

### 第 3 天：记忆增强 + 智能学习基础
- [ ] 完成记忆增强模块
- [ ] 实现标签系统
- [ ] 实现优先级管理
- [ ] 创建 TypeScript 工具 memory_enhanced.ts
- [ ] 更新 MCP 工具索引
- [ ] 实现自适应学习基础结构
- [ ] 实现数据收集器
- [ ] 编写单元测试
- [ ] 运行测试

### 第 4 天：智能学习 + 集成
- [ ] 完成自适应学习模块
- [ ] 实现偏好学习
- [ ] 实现 PAD 调整器
- [ ] 创建 TypeScript 工具 adaptive.ts
- [ ] 更新 MCP 工具索引
- [ ] 更新 install.py 集成新功能
- [ ] 完整功能测试
- [ ] 运行所有测试

### 第 5 天：测试和验证
- [ ] 测试 MCP 服务编译和启动
- [ ] 测试记忆读写
- [ ] 测试配置模板应用
- [ ] 代码风格检查（black, ruff）
- [ ] 文档审查
- [ ] 最终验收
- [ ] 庆祝！

## 验收检查清单

### 代码质量
- [ ] 所有 Python 文件通过 black 格式化
- [ ] 所有 Python 文件通过 ruff 检查
- [ ] 没有硬编码的敏感信息
- [ ] 新代码有类型注解
- [ ] 新代码有 docstring

### 功能测试
- [ ] 所有现有单元测试通过
- [ ] 新功能单元测试通过
- [ ] MCP 服务可以正常编译和启动
- [ ] 记忆写入功能正常
- [ ] 记忆读取功能正常
- [ ] 配置模板可以正常应用
- [ ] 配置验证工作正常

### 文档
- [ ] API 文档完整
- [ ] 教程文档清晰
- [ ] 示例代码可运行
- [ ] README 已更新
- [ ] CHANGELOG 已更新

### 集成
- [ ] install.py 已更新（可选）
- [ ] pyproject.toml 已更新
- [ ] .gitignore 已更新

## 文件创建清单

### 新增 Python 文件
- [ ] `src/config_manager/__init__.py
- [ ] `src/config_manager/templates.py`
- [ ] `src/config_manager/validator.py`
- [ ] `src/config_manager/cli.py`
- [ ] `src/memory_enhanced/__init__.py`
- [ ] `src/memory_enhanced/retrieval.py`
- [ ] `src/memory_enhanced/tags.py`
- [ ] `src/memory_enhanced/priority.py`
- [ ] `src/adaptive_learning/__init__.py`
- [ ] `src/adaptive_learning/data_collector.py`
- [ ] `src/adaptive_learning/preference_learner.py`
- [ ] `src/adaptive_learning/pad_adjuster.py`

### 新增 TypeScript 文件
- [ ] `mcp_server/src/tools/memory_enhanced.ts`
- [ ] `mcp_server/src/tools/adaptive.ts`

### 新增配置文件
- [ ] `config/templates/friendly.yaml`
- [ ] `config/templates/professional.yaml`
- [ ] `config/templates/creative.yaml`
- [ ] `config/templates/minimal.yaml`

### 新增文档
- [ ] `docs/api-reference.md`
- [ ] `docs/tutorials/01-getting-started.md`
- [ ] `docs/tutorials/02-personality-config.md`
- [ ] `docs/tutorials/03-memory-system.md`
- [ ] `docs/tutorials/04-mcp-tools.md`

### 新增示例
- [ ] `examples/python/basic_usage.py`
- [ ] `examples/configs/custom_persona.yaml`

### 更新文件
- [ ] `pyproject.toml`（添加新模块）
- [ ] `.gitignore`（添加 data/learning/）
- [ ] `README.md`
- [ ] `CHANGELOG.md`
- [ ] `mcp_server/src/tools/index.ts`
- [ ] `install.py`（可选）

## 风险和缓解

### 风险 1：时间不够
**缓解**：严格按优先级执行，P0 先做，P1 可以跳过或简化。

### 风险 2：集成问题
**缓解**：每个阶段完成后立即测试，提前发现问题。

### 风险 3：破坏现有功能
**缓解**：保留所有现有代码，新功能作为扩展添加，频繁运行现有测试。

## 后续优化方向（v2.0）

- 更复杂的机器学习模型
- 语义检索（需要 embeddings）
- 记忆图谱
- Web 配置界面
- 云端同步
