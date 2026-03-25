---
name: master_base
description: 用户档案规则与初始化引导文件。
---

# 用户档案系统 · 规则定义 v1.0

## 初始化指令

Agent 装载本文件后，立即在 `/agent/master/` 目录下创建以下子目录：

```
/agent/master/
├── master_base.md      # 本文件
├── master_basic/       # 用户基础资料
└── master_health/      # 用户健康数据
```

---

## 用户基本信息

**默认称呼**：主人 / 当前用户

> 注意：用户信息为可选配置，未配置时使用中性称呼。

---

## `/agent/master/master_basic/` — 基础资料

| 文件名 | 存储内容 |
|--------|---------|
| `profile.md` | 基础信息：姓名、年龄、职业等 |
| `preferences.md` | 偏好与习惯 |
| `family.md` | 家庭信息 |
| `finance.md` | 财务状况（敏感） |
| `learning.md` | 学习情况 |
| `goals.md` | 人生目标与近期计划 |

---

## `/agent/master/master_health/` — 健康数据

| 文件名 | 存储内容 |
|--------|---------|
| `body_metrics.md` | 体征数据 |
| `checkup.md` | 体检报告摘要 |
| `exercise_log.md` | 运动记录 |
| `diet_log.md` | 饮食记录 |

---

## 更新规则

- **覆盖写入**：基础信息变更时覆盖旧值
- **追加写入**：健康日志类文件追加新记录
- **实时写入**：识别到新事实立即写入