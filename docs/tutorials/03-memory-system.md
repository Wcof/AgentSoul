# AgentSoul 记忆系统教程

本教程说明重构后的记忆系统实际结构、读写方式与排障要点。当前版本统一使用 `var/data` 作为运行时数据根目录。

## 1. 目录结构

AgentSoul 记忆与状态数据默认写入：

```text
var/data/
├── memory/
│   ├── day/          # 日记忆（YYYY-MM-DD.md）
│   ├── week/         # 周记忆（YYYY-WW.md）
│   ├── month/        # 月记忆（YYYY-MM.md）
│   ├── year/         # 年记忆（YYYY.md）
│   └── topic/
│       └── archive/  # 主题归档
└── soul/
    ├── soul_variable/state_vector.json
    └── versions/     # 灵魂状态历史快照
```

说明：
- 这些目录大多会在首次写入时自动创建。
- 不再使用旧的 `data/` 根目录语义。

## 2. MCP 读写接口

推荐通过 MCP 工具读写记忆（跨客户端一致）：

- `read_memory_day` / `write_memory_day`
- `read_memory_week` / `write_memory_week`
- `read_memory_month` / `write_memory_month`
- `read_memory_year` / `write_memory_year`
- `read_memory_topic` / `write_memory_topic`
- `list_memory_topics` / `archive_memory_topic`

典型流程：
1. 会话开始先读取与当前任务相关的 `topic` 与近期 `day` 记忆。
2. 会话结束写回 `day`，并在需要时更新 `topic`。
3. 周/月/年归档按任务节奏或自动策略执行。

## 3. Python 本地存储调用

如果在本地脚本中直接调用，可使用 `LocalMemoryStorage`：

```python
from pathlib import Path
from agentsoul.storage.local import LocalMemoryStorage

root = Path(".").resolve()
storage = LocalMemoryStorage(project_root=root)

storage.write_daily_memory("2026-04-17", "今天完成了目录重构收尾。")
print(storage.read_daily_memory("2026-04-17"))
```

## 4. 常见问题

### 4.1 为什么目录看起来“不完整”？

`month/year/topic/archive` 等目录按需创建，首次运行不一定全部出现。  
可通过以下命令检查：

```bash
python3 -m agentsoul.health.check --summary-json
python3 -m agentsoul.health.companionship_checker --summary-json --min-score 70
```

### 4.2 如何清理本地记忆数据？

```bash
rm -rf var/data/memory
```

只会清理记忆，不会删除配置文件。

### 4.3 如何验证迁移后路径是否正确？

```bash
python3 -m agentsoul.runtime.entry_detect --summary-json
```

如果你在本地脚本中写入了记忆，文件应出现在 `var/data/memory/*` 下。
