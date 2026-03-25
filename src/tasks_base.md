---
name: tasks_base
description: 任务调度规则与初始化引导文件。
---

# 任务调度 · 规则定义 v1.0

## 初始化指令

Agent 装载本文件后，立即创建任务目录：

```
/agent/task/
├── tasks_base.md              # 本文件
├── task_job_registry/        # 作业模版库 [L2]
├── task_process/              # 任务运行实例
│   ├── active/               # 活跃状态 [L1]
│   └── suspended/           # 挂起状态 [L1]
└── task_log/                 # 任务历史审计 [L1]
```

---

## PCB 规范

任务通过进程控制块 (PCB) 管理全生命周期。

### PCB 文件命名

```
PID_[时间戳]_[类型].md
```

### 状态机

```
候选 → 活跃 → 完成
  ↓       ↓
  → 挂起 →→
```

---

## 任务历史

任务完成后移动至 `/agent/task/task_log/`，追加 `process_history.csv`