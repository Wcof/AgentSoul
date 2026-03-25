# AgentSoul · 项目说明

## 概述

AgentSoul 是一个通用化的 AI Agent 人格框架。它为 AI 助手提供可配置的人格系统，包括：
- 可自定义的 AI 身份和用户档案
- 基于 PAD 情感模型的情感计算
- 分层记忆管理系统
- **MCP 服务** 对外开放人格和记忆能力
- **OpenClaw** 深度集成支持

## 核心功能

| 功能 | 说明 |
|------|------|
| 配置加载 | 类型安全的配置加载器，支持向后兼容 |
| PAD 情感模型 | 三维情感空间（愉悦度Pleasure、唤醒度Arousal、支配度Dominance） |
| 记忆系统 | 每日记忆 + 主题记忆 + 归档机制 |
| 安全协议 | 三级安全等级控制（PUBLIC/PROTECTED/SEALED） |
| MCP 服务 | 通过 Model Context Protocol 暴露人格和记忆工具 |
| OpenClaw 集成 | 一键注入到 OpenClaw 工作区 |

## 项目结构

```
AgentSoul/
├── config/
│   └── persona.yaml              # 通用人格配置
├── src/
│   ├── __init__.py               # 模块初始化
│   ├── config_loader.py          # 配置加载器（dataclass）
│   ├── path_compat.py            # 路径兼容性工具
│   ├── openclaw_installer.py     # OpenClaw 安装器
│   ├── SKILL.md                  # 人格核心规则 & 安全策略
│   ├── soul_base.md              # PAD 情感计算引擎
│   ├── memory_base.md            # 记忆系统规则
│   ├── master_base.md            # 用户档案规则
│   ├── secure_base.md            # 安全协议（PROTECTED）
│   ├── skills_base.md            # 技能系统规则
│   └── tasks_base.md             # 任务调度规则
├── mcp-server/                   # MCP 服务实现
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # MCP 服务入口
│       ├── types.ts              # 类型定义
│       ├── storage.ts            # 存储工具
│       └── tools/
│           ├── soul.ts           # 人格相关工具
│           └── memory.ts         # 记忆相关工具
├── scripts/
│   └── scan_privacy.py           # 隐私扫描工具
├── tests/
│   └── test_agent_soul.py        # 单元测试
├── common/
│   └── __init__.py               # 通用工具（日志等）
├── install.py                    # 安装脚本
└── README.md
```

## 快速开始

### 生成人格包

为 Cursor、Windsurf 等编辑器生成人格文件：

```bash
# 交互式安装（默认）
python3 install.py

# 仅生成人格包
python3 install.py --persona

# 自定义 Agent 名称
python3 install.py --persona --name "小明"
```

生成输出：
- `agent-persona.md` - 适用于 Claude Desktop/Trae 等
- `.cursorrules` - Cursor 编辑器自动加载
- `.windsurfrules` - Windsurf 编辑器自动加载

### 安装 MCP 服务

启动 MCP 服务，对外提供人格和记忆 API：

```bash
# 安装并启动
python3 install.py --mcp

# 仅安装不启动
python3 install.py --mcp --no-run
```

**MCP 工具**：

| 类别 | 工具 | 功能 |
|------|------|------|
| 人格 | `get_persona_config` | 获取当前人格配置 |
| 人格 | `get_soul_state` | 读取当前 PAD 情感状态向量 |
| 人格 | `update_soul_state` | 更新情感状态 |
| 人格 | `get_base_rules` | 获取基础规则文档 |
| 记忆 | `read_memory_day` | 读取指定日期的每日记忆 |
| 记忆 | `write_memory_day` | 写入每日记忆 |
| 记忆 | `read_memory_topic` | 读取主题记忆 |
| 记忆 | `write_memory_topic` | 写入主题记忆 |
| 记忆 | `list_memory_topics` | 列出记忆主题（按状态过滤） |
| 记忆 | `archive_memory_topic` | 归档记忆主题 |

### 安装到 OpenClaw

深度注入到 OpenClaw 工作区：

```bash
# 安装到当前会话
python3 install.py --openclaw --scope current

# 全局永久安装
python3 install.py --openclaw --scope global
```

OpenClaw 安装器会：
- 自动检测 OpenClaw 工作区位置
- 创建符合 OpenClaw 官方规范的目录结构
- 在 `agent/base_rules/` 复制所有 AgentSoul 基础规则
- 在 `agent/` 根目录创建官方要求的入口文件：
  - `Agent.md` - 人格入口
  - `soul.md` - 灵魂状态入口
- **自动从 `config/persona.yaml` 初始化身份档案** ✨
  - Agent 身份写入 `agent/data/identity/self/`
  - Master (用户) 身份写入 `agent/data/identity/master/`
- 创建完整的 `data/` 子目录结构（identity、soul、memory）
- 初始化默认 PAD 情感状态

## 配置说明

### 主人格配置 `config/persona.yaml`

编辑 `config/persona.yaml` 来自定义 AI 和用户身份：

```yaml
agent:
  name: AgentName                # Agent 名称
  nickname: ''                   # Agent 昵称
  role: AI Assistant             # 角色描述
  personality:                   # 性格特征列表
    - 友好
    - 专业
  core_values:                   # 核心价值观列表
    - 用户中心
  interaction_style:
    tone: neutral
    language: chinese

master:
  name: ''                       # 用户名称（可选）
  nickname: []                   # 用户昵称列表（可选）
  timezone: Asia/Shanghai        # 用户时区
```

### 行为配置 `config/behavior.yaml`

行为配置控制功能开关和运行时行为：

```yaml
enabled: true                  # 是否启用 AgentSoul
auto_memory: true             # 自动记忆更新
emotional_response: true      # 启用情感响应
task_scheduling: true         # 启用任务调度
memory_daily_summary: true    # 每日记忆自动汇总
response_length_limit: 0      # 响应长度限制 (0=不限制)
forbidden_topics: []          # 禁止讨论的话题
allowed_topics: []            # 允许讨论的话题 (留空=全部允许)
priority:                     # 行为优先级 (靠前优先级更高)
  - 安全检查
  - 身份一致性
  - 用户需求满足
  - 情感响应
  - 记忆更新
```

## 开发

```bash
# 运行所有测试
python3 -m unittest tests/test_agent_soul.py -v

# 运行隐私扫描（检查敏感信息）
python3 scripts/scan_privacy.py

# 从旧项目迁移（xiaonuan -> AgentSoul）
python3 scripts/migrate_from_xiaonuan.py /path/to/old/config

# 编译 MCP 服务
cd mcp-server && npm install && npm run build
```

## 安全模型

框架强制执行严格的三级安全模型：
- **Level 1 (PUBLIC)**：可在对话中直接读取/引用
- **Level 2 (PROTECTED)**：仅供内部使用，不能输出原始内容
- **Level 3 (SEALED)**：任何上下文中严格禁止输出（API 密钥、凭证）

优先级：**Sealed 层安全 > 隐私保护 > 任务完成 > 用户体验**

## 许可证

MIT