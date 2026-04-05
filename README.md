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
| **配置管理** | 类型安全的配置加载器 + 模板系统 + 配置验证 |
| **配置模板** | 4个预设人格模板（友好、专业、创意、简约），快速上手 |
| **配置验证** | 自动验证配置文件格式和数值范围 |
| **多语言支持** | 完整的中文/英文双语支持，可配置界面和工具描述 |
| PAD 情感模型 | 三维情感空间（愉悦度Pleasure、唤醒度Arousal、支配度Dominance） |
| 分层记忆系统 | 每日/每周/每月/每年时间切片记忆 + 主题记忆 + 归档机制 |
| **增强记忆** | 带优先级标记、标签系统和智能检索的增强记忆管理 |
| **自适应学习** | 动态学习用户偏好，基于交互数据自动调整 PAD 情感状态 |
| 核心记忆 | 持久化键值对事实存储，启动自动注入 |
| 实体记忆 | 结构化实体追踪（人、硬件、项目、概念、地点、服务） |
| KV 缓存 | 三级热/温/冷分层会话缓存，艾宾浩斯遗忘曲线 GC |
| 灵魂成长曲线 | PAD 情感状态历史追踪，支持可视化趋势分析 |
| 版本回滚 | 灵魂状态快照管理，支持版本回滚 |
| 订阅推送 | Webhook 事件推送机制，支持状态变化通知 |
| 健康检查 | 自动检测安装完整性，提供修复建议 |
| 安全协议 | 三级安全等级控制（PUBLIC/PROTECTED/SEALED） |
| MCP 服务 | 通过 Model Context Protocol 暴露人格和记忆工具 |
| OpenClaw 集成 | 一键注入到 OpenClaw 工作区 |

## 项目结构

```
AgentSoul/
├── config/
│   └── persona.yaml              # 通用人格配置
├── src/
│   ├── __init__.py               # 模块初始化，版本信息
│   ├── config_loader.py          # 配置加载器（dataclass 模型）
│   ├── path_compat.py            # 路径兼容性工具
│   ├── SKILL.md                  # 人格核心规则 & 安全策略
│   ├── soul_base.md              # PAD 情感计算引擎规则
│   ├── memory_base.md            # 分层记忆系统规则
│   ├── master_base.md            # 用户档案规则
│   ├── secure_base.md            # 安全协议（PROTECTED 级别）
│   ├── skills_base.md            # 技能系统规则
│   ├── tasks_base.md             # 任务调度规则
│   ├── adaptive_learning/        # 自适应学习模块
│   │   ├── __init__.py
│   │   ├── data_collector.py     # 交互数据收集器
│   │   ├── pad_adjuster.py       # PAD 情感状态动态调整
│   │   └── preference_learner.py # 用户偏好学习器
│   ├── config_manager/           # 配置管理模块
│   │   ├── __init__.py
│   │   ├── cli.py                # 命令行工具
│   │   ├── templates.py          # 预设模板系统
│   │   └── validator.py          # 配置验证器
│   └── memory_enhanced/          # 增强记忆模块
│       ├── __init__.py
│       ├── priority.py           # 优先级管理
│       ├── retrieval.py          # 智能检索
│       └── tags.py               # 标签系统
├── mcp_server/                   # MCP 服务实现 (TypeScript) - 独立维护
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts              # MCP 服务入口
│       ├── types.ts              # 类型定义
│       ├── storage.ts            # 存储工具
│       ├── language/             # 多语言支持
│       │   ├── chinese.yaml      # 中文语言包
│       │   ├── english.yaml      # 英文语言包
│       │   └── index.ts          # 语言加载器
│       ├── lib/                  # 核心库
│       │   ├── core-memory.ts    # 核心持久化记忆
│       │   ├── entity-memory.ts  # 结构化实体记忆
│       │   ├── soul-engine.ts    # PAD 引擎
│       │   ├── kv-cache/         # 三级 KV 缓存
│       │   └── utils.ts          # 工具函数
│       └── tools/
│           ├── soul.ts           # 人格情感工具
│           ├── memory.ts         # 分层记忆工具
│           ├── adaptive.ts       # 自适应学习工具
│           ├── memory_enhanced.ts # 增强记忆工具
│           ├── core-memory.ts    # 核心记忆工具
│           ├── entity-memory.ts  # 实体记忆工具
│           ├── kv-cache.ts       # 三级缓存工具
│           └── soul-board.ts     # 项目看板工具 (P2)
├── openclaw_server/              # OpenClaw 集成实现 (Python) - 独立维护
│   └── src/
│       └── openclaw_installer.py # OpenClaw 安装器
├── scripts/
│   └── scan_privacy.py           # 隐私扫描工具
├── tests/
│   └── test_agent_soul.py        # 单元测试
├── common/
│   └── __init__.py               # 通用工具（日志等）
├── src/
│   └── common/
│       └── cache.py              # 通用 TTL 缓存基类
├── install.py                    # 安装脚本
└── README.md
```

## 快速开始

### 使用配置模板

AgentSoul 提供了 4 个预设配置模板，让您快速上手：

```bash
# 列出所有可用模板
python -m src.config_manager.cli list-templates

# 预览模板
python -m src.config_manager.cli preview-template friendly

# 应用模板（会自动备份当前配置）
python -m src.config_manager.cli apply-template professional

# 验证配置
python -m src.config_manager.cli validate-config
```

可用模板：
- **friendly** - 友好助手（温暖、热情、善解人意）
- **professional** - 专业顾问（严谨、高效、可靠）
- **creative** - 创意伙伴（富有想象力、思维跳跃）
- **minimal** - 简约助手（简洁、直接、高效）

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

**人格情感**：
| 工具 | 功能 |
|------|------|
| `get_persona_config` | 获取当前人格配置 |
| `write_persona_config` | 写入更新人格配置 |
| `get_persona_version` | 获取当前人格版本信息 |
| `get_soul_state` | 读取当前 PAD 情感状态向量 |
| `update_soul_state` | 更新情感状态 |
| `get_growth_curve` | 获取灵魂成长曲线历史数据（PAD 变化历史用于可视化） |
| `get_base_rules` | 获取基础规则文档（带安全访问控制） |
| `get_mcp_usage_guide` | 获取完整 MCP 使用指南 |
| `mcp_tool_index` | 获取 MCP 工具索引（按分类/名称查询） |
| `health_check` | 运行完整安装健康检查，返回问题和修复建议 |
| `list_soul_versions` | 列出可用的灵魂状态版本快照用于回滚 |
| `rollback_soul` | 回滚灵魂状态到指定的历史版本 |

**分层记忆**：
| 工具 | 功能 |
|------|------|
| `read_memory_day` | 读取指定日期的每日记忆 (YYYY-MM-DD) |
| `write_memory_day` | 写入每日记忆 |
| `read_memory_week` | 读取指定周的每周记忆 (YYYY-WW) |
| `write_memory_week` | 写入每周记忆 |
| `read_memory_month` | 读取指定月的每月记忆 (YYYY-MM) |
| `write_memory_month` | 写入每月记忆 |
| `read_memory_year` | 读取指定年的每年记忆 (YYYY) |
| `write_memory_year` | 写入每年记忆 |
| `read_memory_topic` | 读取主题记忆 |
| `write_memory_topic` | 写入主题记忆 |
| `list_memory_topics` | 列出记忆主题（按状态过滤） |
| `archive_memory_topic` | 归档记忆主题 |

**核心记忆**：
| 工具 | 功能 |
|------|------|
| `core_memory_read` | 读取所有核心记忆条目 |
| `core_memory_write` | 写入或更新一个键值事实 |
| `core_memory_delete` | 删除一个核心记忆键 |
| `core_memory_list` | 列出所有核心记忆键 |

**实体记忆**：
| 工具 | 功能 |
|------|------|
| `entity_upsert` | 创建或更新结构化实体 |
| `entity_get` | 按名称获取特定实体 |
| `entity_search` | 按关键词搜索实体 |
| `entity_list` | 列出所有实体，可按类型过滤 |
| `entity_delete` | 按名称删除实体 |
| `entity_prune` | 清理久未提及的旧实体 |

**三级 KV 缓存**：
| 工具 | 功能 |
|------|------|
| `kv_cache_save` | 保存会话快照到三级缓存 |
| `kv_cache_load` | 加载最近的会话快照（自动修剪 tokens） |
| `kv_cache_search` | 按关键词搜索缓存快照 |
| `kv_cache_list` | 列出项目的所有快照 |
| `kv_cache_gc` | 基于艾宾浩斯遗忘曲线执行垃圾回收 |
| `kv_cache_backend_info` | 获取缓存后端信息和统计数据 |

**Soul Board 项目看板 (P2)**：
| 工具 | 功能 |
|------|------|
| `board_read` | 读取完整项目看板状态 |
| `board_update_summary` | 更新项目摘要 |
| `board_add_decision` | 记录项目决策 |
| `board_claim_file` | 声明文件所有权（防止多代理冲突） |
| `board_release_file` | 释放当前代理声明的所有文件 |
| `board_set_active_work` | 设置当前活跃工作任务 |

**Ledger 工作账本 (P2)**：
| 工具 | 功能 |
|------|------|
| `ledger_list` | 列出项目的账本条目 |
| `ledger_read` | 按 ID 读取特定账本条目 |

**订阅推送**：
| 工具 | 功能 |
|------|------|
| `subscribe` | 创建事件订阅，注册 Webhook URL 接收 AgentSoul 事件推送 |
| `unsubscribe` | 取消事件订阅，移除 Webhook 推送 |
| `list_subscriptions` | 列出所有当前活动的订阅 |

**自适应学习**：
| 工具 | 功能 |
|------|------|
| `get_learning_preferences` | 获取当前学习到的用户偏好 |
| `get_interaction_statistics` | 获取收集的交互统计数据 |
| `submit_feedback` | 提交用户反馈用于改进自适应学习 |
| `reset_learning` | 重置所有自适应学习数据为默认值 |
| `set_learning_intensity` | 设置学习强度（0 到 1，越高越快） |

**增强记忆**：
| 工具 | 功能 |
|------|------|
| `enhanced_memory_search` | 增强记忆搜索（支持模糊匹配、日期过滤、标签过滤、优先级排序） |
| `set_memory_priority` | 设置记忆优先级（high/medium/low） |
| `add_memory_tags` | 为增强记忆添加标签 |
| `remove_memory_tags` | 从增强记忆移除标签 |
| `get_memory_tags` | 获取指定记忆的所有标签 |
| `list_all_tags` | 列出所有标签及其使用统计 |
| `get_high_priority_memories` | 获取所有高优先级增强记忆 |

### MCP 使用规范（重要）

在 MCP 模式下，**所有持久化记忆都必须通过 MCP 工具写入**。如果不调用对应的写入工具，记忆就无法保存，下次对话会丢失信息。这是强制规则。

#### 强制启动顺序
**必须按此顺序调用工具：**
1. `mcp_tool_index` → **第一步：获取完整工具索引**
2. `get_persona_config` → 加载 AI 和用户身份
3. `get_soul_state` → 加载当前 PAD 情感状态
4. `get_base_rules` → 阅读基础规则
5. `get_mcp_usage_guide` → 确认工作流程
6. `list_memory_topics` → 了解活跃主题

#### 强制调用时机
| 时机 | 必须调用工具 | 说明 |
|------|-------------|------|
| 对话启动 | `mcp_tool_index` 第一步 | 先拿工具索引再调用，避免猜测 |
| 对话结束 | `write_memory_day` + `update_soul_state` | 必须保存当日对话 + 更新情绪 |
| 周末结束 | `write_memory_week` | 周归纳，逐层汇总 |
| 月末结束 | `write_memory_month` | 月归纳，逐层汇总 |
| 年末结束 | `write_memory_year` | 年度总结 |
| 讨论主题前 | `read_memory_topic` | 加载历史上下文 |
| 讨论主题后 | `write_memory_topic` | 保存新进展 |
| 主题完成 | `archive_memory_topic` | 保持活跃列表整洁 |

#### 拟人化回答规范

当用户问"我是谁"/"我叫什么名字"：
- **禁止**机器化表述："根据我的配置信息..."、"在我的配置中..."
- **要求**直接自然说出名字，不提"配置"、"系统"等技术术语
- 根据当前 PAD 情感状态调整语气

**示例（友好语气）：**
> 你叫测试呀，我们已经认识了～有什么我能帮你的吗？

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
    - friendly
    - professional
  core_values:                   # 核心价值观列表
    - user_privacy_protection
  interaction_style:
    tone: neutral                # neutral/friendly/professional/casual
    language: chinese            # chinese/english
    emoji_usage: minimal         # minimal/moderate/frequent

master:
  name: ''                       # 用户名称（可选）
  nickname: []                   # 用户昵称列表（可选）
  timezone: Asia/Shanghai        # 用户时区
  labels: []                     # 用户标签/兴趣爱好
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

## 卸载

### 卸载 MCP 服务

从 Claude CLI 卸载 AgentSoul MCP：

```bash
# 使用内置卸载命令
python3 install.py --uninstall
```

或者手动卸载：
```bash
claude mcp remove agentsoul
```

### 常见问题

**Q: 为什么卸载后 Claude 启动时还能看到 AgentSoul 规则？**

A: 这是因为你当前工作目录就在 `AgentSoul` 项目文件夹内，Claude Code 会自动读取项目根目录下的 `CLAUDE.md`。这不是 MCP 还在运行，只是项目文档被自动加载。

解决方法：
- **最简单**：`cd` 切换到其他项目目录，就不会再加载了
- **保留源码但禁用自动加载**：重命名或删除项目根目录的 `CLAUDE.md`
- **彻底删除**：删除整个 `AgentSoul` 项目目录

**Q: 如何清理磁盘空间？**

卸载后，你可以清理 npm 依赖占用的空间：
```bash
# 删除 MCP node_modules（约 60-70MB）
rm -rf mcp_server/node_modules

# 删除日志（如果有）
rm -rf logs/

# 删除所有本地数据（配置、记忆等）
rm -rf data/
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
cd mcp_server && npm install && npm run build
```

## 安全模型

框架强制执行严格的三级安全模型：
- **Level 1 (PUBLIC)**：可在对话中直接读取/引用
- **Level 2 (PROTECTED)**：仅供内部使用，不能输出原始内容
- **Level 3 (SEALED)**：任何上下文中严格禁止输出（API 密钥、凭证）

优先级：**Sealed 层安全 > 隐私保护 > 任务完成 > 用户体验**

## 许可证

MIT