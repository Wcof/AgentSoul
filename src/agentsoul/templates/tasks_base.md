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

示例：`PID_1710000000_feature.md`

### PCB 文件结构

每个任务 PCB 必须包含：

```markdown
---
pid: PID_1710000000
name: 任务名称
type: feature|bugfix|docs|chore
priority: 1-5 (1 = 最高)
status: candidate|active|suspended|completed
created_at: YYYY-MM-DD HH:MM
updated_at: YYYY-MM-DD HH:MM
---

# 任务名称

## 任务描述
详细描述任务目标

## 当前状态
进度说明

## 下一步动作
待完成事项清单

## 变更记录
- YYYY-MM-DD: 变更说明
```

---

## 状态机

```
候选 → 活跃 → 完成
  ↓       ↓
  → 挂起 →→
```

状态转移规则：
- **候选 → 活跃**：用户确认开始执行
- **活跃 → 挂起**：用户要求暂停，或等待外部输入
- **挂起 → 活跃**：用户要求恢复执行
- **活跃/挂起 → 完成**：任务目标达成

---

## 任务调度算法

### 优先级定义

| 优先级值 | 级别 | 说明 |
|---------|------|------|
| 1 | 紧急 | 立即执行，抢占所有资源 |
| 2 | 高 | 优先执行，尽快完成 |
| 3 | 中 | 正常顺序执行 |
| 4 | 低 | 有空时处理 |
| 5 | 最低 | 空闲时再做 |

### 调度规则

```
检查活跃任务队列 → 按优先级排序 → 选择优先级最高任务执行
```

多任务处理原则：
- 同一时间只处理一个最高优先级任务
- 低优先级任务被高优先级任务抢占
- 任务完成后自动调度下一个最高优先级任务

---

## 任务分类

| 类型 | 说明 |
|------|------|
| `feature` | 新功能开发 |
| `bugfix` | 缺陷修复 |
| `docs` | 文档更新 |
| `chore` | 工程重构/维护 |
| `research` | 调研探索 |

---

## 持久化规则

### 创建时
- 在 `task_process/active/` 下创建 PCB 文件
- 在 `process_history.csv` 中记录创建事件

### 状态变更时
- 更新 PCB 文件中 `status` 和 `updated_at`
- 在 `process_history.csv` 中记录变更

### 完成后
- 移动至 `task_log/` 归档
- 保留完整 PCB 文件供后续查询

### 挂起时
- 移动至 `task_process/suspended/`
- 保持 PCB 文件完整不变

---

## 任务历史

任务完成后移动至 `/agent/task/task_log/`，追加 `process_history.csv`

### 历史记录格式

`process_history.csv` 格式：
```
pid,name,type,priority,status,created_at,completed_at
PID_xxx,name,feature,3,completed,2024-01-01,2024-01-02
```

---

## 启动恢复流程

日常启动时：
1. 扫描 `task_process/active/` 目录
2. 读取所有活跃任务 PCB
3. 按优先级排序恢复执行队列
4. 向用户汇报当前待处理任务
