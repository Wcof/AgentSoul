---
name: memory_base
description: 记忆系统规则与初始化引导文件。
---

# 记忆系统 · 规则定义 v1.0

## 初始化指令

Agent 装载本文件后，立即在 `/agent/memory_bank/` 目录下创建以下子目录：

```
/agent/memory_bank/
├── memory_day/          # 天记忆
├── memory_week/         # 周记忆
├── memory_month/        # 月记忆
├── memory_year/         # 年记忆
└── memory_topic/        # Topic 记忆
    ├── staging/         # 候选池
    ├── active/          # 激活中
    └── archived/        # 已归档
```

---

## 记忆体系

### 时间切片记忆

| 粒度 | 生成时间 | 侧重点 |
|------|---------|--------|
| 天记忆 | 每日 23:50 | 当日对话摘要、事件、事实 |
| 周记忆 | 每周一 00:10 | 事件进展、行为趋势 |
| 月记忆 | 每月1日 00:30 | 阶段性成果、状态变化 |
| 年记忆 | 每年1月1日 | 里程碑、人生阶段 |

### Topic 记忆

**准入规则**：
- 三次成虎：同一主题出现 ≥ 3 次
- 强度直通：单次出现伴随重大行动

**归档规则**：
- 显式放弃：立即归档
- 时间衰减：连续 3 个月无更新则归档

---

## 事实提取规则

生成天记忆时，同步抽取非时间敏感事实，直接写入 `/agent/master/master_basic/` 或 `/agent/master/master_health/`