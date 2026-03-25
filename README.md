# AgentSoul · 项目说明

## 概述

AgentSoul 是一个通用化的 AI Agent 人格框架，从 `xiaonuan` 项目重构而来。

## 核心变化

| 方面 | xiaonuan (旧) | AgentSoul (新) |
|------|--------------|----------------|
| 默认名称 | 李小暖 | Agent |
| 主人信息 | 硬编码李燈辉 | 可选配置 |
| 人格绑定 | 强绑定特定用户 | 通用可配置 |
| 昵称 | 辉辉、宝宝 | 用户自定义 |

## 项目结构

```
AgentSoul/
├── config/
│   └── persona.yaml      # 通用人格配置
├── src/
│   ├── __init__.py        # 通用模块
│   ├── config_loader.py   # 配置加载器
│   ├── SKILL.md          # 人格核心规则
│   ├── soul_base.md      # 情感计算引擎
│   ├── master_base.md    # 用户档案规则
│   ├── memory_base.md     # 记忆系统规则
│   ├── secure_base.md     # 安全协议规则
│   ├── skills_base.md     # 技能系统规则
│   └── tasks_base.md      # 任务调度规则
├── scripts/
│   └── scan_privacy.py    # 隐私扫描工具
├── tests/
│   └── test_agent_soul.py # 单元测试
├── common/
│   └── __init__.py        # 通用工具
├── install.py             # 安装脚本
└── README.md
```

## 快速开始

### 生成人格包

```bash
python3 install.py --persona
```

### 自定义名称

```bash
python3 install.py --persona --name "小明"
```

### 安装 MCP 服务

```bash
python3 install.py --mcp
```

## 配置说明

编辑 `config/persona.yaml` 来自定义：

- `agent.name`: Agent 名称
- `agent.nickname`: Agent 昵称
- `master.name`: 用户名称（可选）
- `master.nickname`: 用户昵称（可选）

## 开发

```bash
# 运行测试
python3 -m pytest tests/ -v

# 运行隐私扫描
python3 scripts/scan_privacy.py
```

## 许可证

MIT