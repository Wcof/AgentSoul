# AgentSoul · 给 AI 一个灵魂，让对话有记忆

[![Tests](https://github.com/ldhuan/AgentSoul/actions/workflows/tests.yml/badge.svg)](https://github.com/ldhuan/AgentSoul/actions/workflows/tests.yml)
![Health](https://img.shields.io/badge/Health-100%2F100-brightgreen)
![Python](https://img.shields.io/badge/Python-3.10%2B-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)

## 📖 项目介绍

**AgentSoul** 是一个开源的 AI Agent 人格框架，让你的 AI 助手拥有**持续记忆**、**情感体验**和**个性化人格**。

无论你使用 Claude Code、Cursor、Windsurf 还是 OpenClaw，AgentSoul 都能为你的 AI 助手注入持久化的灵魂：

- 🤖 **可定制人格** - 定义 AI 的名字、角色、性格、交互风格
- 👤 **用户画像** - 记录你的信息、偏好、时区，让 AI 更懂你
- ❤️ **PAD 情感模型** - 三维情感空间（愉悦度/唤醒度/支配度）实现情感计算
- 🧠 **分层记忆系统** - 按时间切片（日/周/月/年）+ 主题分类的持久化记忆
- 🏷️ **增强记忆** - 支持优先级标记、标签分类、模糊搜索的智能记忆检索
- 📊 **可视化监控** - 纯静态 Web UI 查看健康度趋势和情感变化历史
- 🔌 **MCP 原生支持** - 通过 Model Context Protocol 对外开放所有能力
- 🎯 **OpenClaw 集成** - 一键深度集成到 OpenClaw 工作区
- 🧪 **生产就绪** - 100% 测试覆盖率，严格类型检查，自动化质量保障

---

## ✨ 核心功能

| 功能 | 说明 |
|------|------|
| **配置管理** | 类型安全的配置加载器 + 4 个预设人格模板 + 自动验证 |
| **预设人格** | 友好助手/专业顾问/创意伙伴/简约助手，一键应用 |
| **多语言支持** | 完整中英文双语支持，所有工具描述和安装界面都支持双语 |
| **PAD 情感模型** | 三维情感空间，AI 会根据交互体验动态调整情感状态 |
| **分层记忆系统** | 每日/每周/每月/每年时间切片记忆 + 主题记忆 + 自动归档 |
| **增强记忆** | 优先级管理 + 标签系统 + 模糊匹配检索 + 日期范围过滤 |
| **自适应学习** | 自动学习用户偏好，根据反馈动态调整情感响应强度 |
| **核心记忆** | 持久化键值事实存储，会话启动自动注入 |
| **实体记忆** | 结构化追踪人/硬件/项目/概念/地点/服务六种实体类型 |
| **三级 KV 缓存** | 热/温/冷分层会话快照缓存，艾宾浩斯遗忘曲线自动 GC |
| **灵魂成长曲线** | PAD 情感状态历史追踪，支持趋势可视化分析 |
| **版本回滚** | 灵魂状态快照管理，支持回滚到任意历史版本 |
| **Soul Board** | 项目看板，记录决策、文件所有权声明，防止多代理冲突 |
| **Ledger 账本** | 不可变工作会话账本，完整记录工作历程 |
| **事件订阅** | Webhook 事件推送，支持记忆写入、状态变化通知 |
| **健康检查** | 自动检测安装完整性，提供修复建议和问题诊断，支持 JSON 输出和 CI 门控 |
| **陪伴连续性检查** | 检测五项核心陪伴连续性指标，评估长期陪伴质量，支持分数门控 |
| **健康度可视化** | 健康度历史趋势 SVG 图表 + 纯静态 Web UI |
| **安全协议** | 三级安全等级控制（PUBLIC/PROTECTED/SEALED），保护敏感信息 |
| **MCP 服务** | 遵循 Model Context Protocol 标准，支持所有兼容客户端 |

---

## 🚀 快速开始

### 环境要求

- **Python 3.10+** - 核心框架和安装脚本
- **Node.js 18+** - （可选）MCP 服务运行时

### 1️⃣ 一键安装

```bash
# 克隆项目
git clone https://github.com/ldhuan/AgentSoul.git
cd AgentSoul

# 交互式安装（推荐）
python3 install.py
```

安装向导会引导你完成：
1.  选择语言（中文/英文）
2.  配置 AI 人格（名称、角色、性格）
3.  配置用户档案（名称、时区、标签）
4.  选择安装方式（生成人格包 / 安装 MCP / 安装到 OpenClaw）

### 2️⃣ 使用预设人格模板

AgentSoul 提供 4 个精心设计的预设模板，一键应用：

```bash
# 列出所有可用模板
python -m src.config_manager.cli list-templates

# 预览模板内容
python -m src.config_manager.cli preview-template friendly

# 应用模板（自动备份当前配置）
python -m src.config_manager.cli apply-template professional

# 验证配置是否正确
python -m src.config_manager.cli validate-config
```

可用模板：
- **friendly** - 友好助手（温暖、热情、善解人意）适合日常对话
- **professional** - 专业顾问（严谨、高效、可靠）适合软件开发
- **creative** - 创意伙伴（开放、想象力丰富、思维跳跃）适合头脑风暴
- **minimal** - 简约助手（简洁、直接、少说废话）适合快速问答

### 3️⃣ 为 AI 编辑器生成人格包

如果你使用 Claude Desktop、Cursor、Windsurf、Trae 等 AI 编辑器，可以直接生成人格文件：

```bash
# 仅生成人格包，不安装 MCP
python3 install.py --persona

# 自定义 Agent 名称
python3 install.py --persona --name "小明"
```

生成的文件：
- `agent-persona.md` - 完整人格描述，适用于 Claude Desktop/Trae
- `.cursorrules` - Cursor 编辑器规则，会被自动加载
- `.windsurfrules` - Windsurf 编辑器规则，会被自动加载

> 💡 生成后重启编辑器，AI 就会加载你的自定义人格了！

### 4️⃣ 安装 MCP 服务（推荐）

安装 MCP 服务后，Claude Code 等支持 MCP 的客户端可以通过 API 调用 AgentSoul 的所有能力：

```bash
# 自动安装并启动 MCP 服务
python3 install.py --mcp

# 仅安装不启动
python3 install.py --mcp --no-run
```

安装完成后，MCP 服务会自动注册到 Claude Code。重启 Claude Code 即可使用。

### 4.1️⃣ 管理 Claude / Codex MCP 客户端配置

`install.py --mcp` 现在会自动生成双语客户端安装指南，并进入客户端管理菜单，可分别安装/卸载：

- Claude CLI（`claude mcp add-json` / `claude mcp remove`）
- Codex CLI（自动写入 `~/.codex/config.toml` 或项目级 `.codex/config.toml`）

自动生成文档位置：
- [`docs/tutorials/05-mcp-client-install.md`](docs/tutorials/05-mcp-client-install.md)

### 5️⃣ 自动检测运行环境

AgentSoul 可以自动检测当前运行环境（Claude Code / OpenAI Codex / Gemini）并输出对应的注入模板：

```bash
# 自动检测并显示报告
python3 src/entry_detect.py

# 查看帮助
python3 src/entry_detect.py --help
```

这在你不确定当前环境支持哪些能力时特别有用，探测器会告诉你：
- 当前是什么环境（Claude Code / OpenAI Codex / Gemini / 通用本地）
- 是否支持 MCP
- 是否有本地文件访问权限
- AgentSoul 是否已安装
- 对应的注入模板

### 6️⃣ 健康检查与 CI 集成

AgentSoul 提供三个命令行检查工具，都支持统一的 `--summary-json` 机器可读输出和 `--min-score` 分数门控，可以直接集成到 CI/CD 流水线：

```bash
# 完整健康检查 - 验证安装完整性和配置正确性
python3 src/health_check.py

# 陪伴连续性检查 - 评估五项核心陪伴指标
python3 src/companionship_checker.py

# 环境检测 - 自动识别当前运行环境
python3 src/entry_detect.py

# 带分数门控（CI 场景）- 总分低于 70 时退出码非零，阻断 CI
python3 src/health_check.py --min-score 70

# 输出机器可读 JSON 摘要（供其他工具消费）
python3 src/health_check.py --summary-json
```

所有三个工具都遵循统一的 [HealthSummary JSON Schema](schemas/health-summary.json) 输出格式，便于自动化工具解析。

GitHub Actions 示例参考：
- [`.github/workflows/health-check.yml`](.github/workflows/health-check.yml) - 健康检查 CI 闸门示例
- [`.github/workflows/companionship-check.yml`](.github/workflows/companionship-check.yml) - 陪伴连续性检查 CI 闸门示例

#### MCP 工具一览

**🤖 人格情感类**：

| 工具 | 功能 |
|------|------|
| `get_persona_config` | 获取当前人格配置 |
| `write_persona_config` | 写入更新人格配置 |
| `get_soul_state` | 读取当前 PAD 情感状态 |
| `update_soul_state` | 更新情感状态 |
| `get_growth_curve` | 获取灵魂成长曲线历史数据 |
| `health_check` | 运行完整安装健康检查 |
| `list_soul_versions` | 列出灵魂状态版本快照 |
| `rollback_soul` | 回滚到指定历史版本 |

🧠 **分层记忆类**：

| 工具 | 功能 |
|------|------|
| `read_memory_day` | 读取指定日期的日记忆 |
| `write_memory_day` | 写入当日记忆 |
| `read_memory_week` | 读取指定周的周记忆 |
| `write_memory_week` | 写入周记忆 |
| `read_memory_month` | 读取指定月的月记忆 |
| `write_memory_month` | 写入月记忆 |
| `read_memory_year` | 读取指定年的年记忆 |
| `write_memory_year` | 写入年记忆 |
| `read_memory_topic` | 读取主题记忆 |
| `write_memory_topic` | 写入主题记忆 |
| `list_memory_topics` | 列出记忆主题 |
| `archive_memory_topic` | 归档已完成主题 |

🏷️ **增强记忆类**：

| 工具 | 功能 |
|------|------|
| `enhanced_memory_search` | 增强搜索（模糊匹配/日期过滤/标签过滤/优先级排序） |
| `set_memory_priority` | 设置记忆优先级 |
| `add_memory_tags` | 添加标签 |
| `remove_memory_tags` | 移除标签 |
| `list_all_tags` | 列出所有标签统计 |
| `get_high_priority_memories` | 获取所有高优先级记忆 |

**🔐 核心记忆类**：

| 工具 | 功能 |
|------|------|
| `core_memory_read` | 读取所有核心记忆 |
| `core_memory_write` | 写入/更新键值事实 |
| `core_memory_delete` | 删除核心记忆 |
| `core_memory_list` | 列出所有键 |

**👤 实体记忆类**：

| 工具 | 功能 |
|------|------|
| `entity_upsert` | 创建/更新结构化实体 |
| `entity_get` | 按名称获取实体 |
| `entity_search` | 关键词搜索实体 |
| `entity_list` | 列出所有实体（可按类型过滤） |
| `entity_delete` | 删除实体 |
| `entity_prune` | 清理久未提及的旧实体 |

**📦 三级 KV 缓存类**：

| 工具 | 功能 |
|------|------|
| `kv_cache_save` | 保存会话快照 |
| `kv_cache_load` | 加载最近会话（自动修剪 tokens） |
| `kv_cache_search` | 关键词搜索缓存快照 |
| `kv_cache_list` | 列出项目所有快照 |
| `kv_cache_gc` | 执行艾宾浩斯垃圾回收 |
| `kv_cache_backend_info` | 获取缓存统计信息 |

**📋 项目看板类**：

| 工具 | 功能 |
|------|------|
| `board_read` | 读取完整看板状态 |
| `board_update_summary` | 更新项目摘要 |
| `board_add_decision` | 记录项目决策 |
| `board_claim_file` | 声明文件所有权（防冲突） |
| `board_release_file` | 释放文件所有权 |
| `board_set_active_work` | 设置当前活跃任务 |
| `board_add_labels` | 添加自定义标签 |
| `board_remove_labels` | 移除自定义标签 |

**📡 事件订阅推送类**：

| 工具 | 功能 |
|------|------|
| `subscribe` | 创建事件订阅，注册 Webhook URL 接收 AgentSoul 事件推送 |
| `unsubscribe` | 按 ID 取消现有订阅 |
| `list_subscriptions` | 列出所有当前活动的订阅及其配置 |

支持的事件：
- `memory_written` - 记忆写入完成
- `memory_archived` - 记忆主题归档
- `soul_state_updated` - 情感状态更新
- `persona_updated` - 人格配置更新

### 5️⃣ 安装到 OpenClaw

如果你使用 OpenClaw，可以一键深度集成：

```bash
# 安装到当前会话作用域
python3 install.py --openclaw --scope current

# 全局永久安装
python3 install.py --openclaw --scope global
```

安装器会自动完成：
- 检测 OpenClaw 工作区位置
- 创建符合官方规范的目录结构
- 复制所有 AgentSoul 基础规则到 `agent/base_rules/`
- 从 `config/persona.yaml` 自动初始化身份档案
- 创建完整的 `data/` 目录结构（identity/soul/memory）
- 初始化默认 PAD 情感状态

---

## 📋 MCP 使用规范（重要）

在 MCP 模式下，**所有持久化记忆都必须通过 MCP 工具写入**。如果不调用对应的写入工具，记忆就无法保存，下次对话会丢失信息。这是强制规则。

### 强制启动顺序

**Agent 启动时必须按此顺序调用工具：**

1. `mcp_tool_index` → **第一步：获取完整工具索引**
2. `get_persona_config` → 加载 AI 身份和用户档案
3. `get_soul_state` → 加载当前 PAD 情感状态
4. `get_base_rules` with `name=SKILL` → 阅读顶级规则
5. `get_base_rules` with `name=memory_base` → 阅读记忆规则
6. `get_mcp_usage_guide` → 确认工作流程
7. `list_memory_topics` → 了解当前活跃主题

### 强制调用时机

| 时机 | 必须调用工具 | 原因 |
|------|-------------|------|
| 对话启动 | `mcp_tool_index` 第一步 | 先获取工具索引，避免猜测 |
| 对话结束 | `write_memory_day` + `update_soul_state` | 保存当日对话 + 更新情绪 |
| 周末结束 | `write_memory_week` | 周归纳，逐层汇总 |
| 月末结束 | `write_memory_month` | 月归纳，逐层汇总 |
| 年末结束 | `write_memory_year` | 年度总结 |
| 讨论主题前 | `read_memory_topic` | 加载历史上下文 |
| 讨论主题后 | `write_memory_topic` | 保存新进展 |
| 主题完成 | `archive_memory_topic` | 保持活跃列表整洁 |

### 拟人化回答规范

当用户问"我是谁"/"我叫什么名字"：

- ❌ **禁止**机器化表述："根据我的配置信息..."、"在我的配置中..."
- ✅ **要求**直接自然说出名字，不提"配置"、"系统"等技术术语
- ✅ 根据当前 PAD 情感状态调整语气

**示例（友好语气）：**
> 你叫 ldh 呀，我们已经认识了～有什么我能帮你的吗？

---

## ⚙️ 配置说明

### 主人格配置 `config/persona.yaml`

```yaml
agent:
  name: AgentName                # Agent 名称
  nickname: ''                   # Agent 昵称（可选）
  role: AI Assistant             # 角色描述
  personality:                   # 性格特征列表
    - friendly
    - professional
  core_values:                   # 核心价值观
    - user_privacy_protection
  interaction_style:
    tone: neutral                # 语气：neutral/friendly/professional/casual
    language: chinese            # 语言：chinese/english
    emoji_usage: minimal         # Emoji 使用：minimal/moderate/frequent

master:
  name: ''                       # 用户名称（可选）
  nickname: []                   # 用户昵称列表（可选）
  timezone: Asia/Shanghai        # 用户时区
  labels: []                     # 用户标签/兴趣爱好
```

### 行为配置 `config/behavior.yaml`

```yaml
enabled: true                    # 是否启用 AgentSoul
auto_memory: true               # 自动记忆更新
emotional_response: true        # 启用情感响应
task_scheduling: true           # 启用任务调度
memory_daily_summary: true      # 每日记忆自动汇总
response_length_limit: 0        # 响应长度限制 (0=不限制)
forbidden_topics: []            # 禁止讨论的话题
allowed_topics: []              # 允许讨论的话题 (留空=全部允许)
priority:                       # 行为优先级（靠前优先级更高）
  - privacy_protection
  - task_completion
  - emotional_support
  - professional_assistance
```

---

## 📊 Web UI 可视化

AgentSoul 提供纯静态的 Web UI 控制面板，用于可视化查看健康度历史、情绪状态和记忆：

**位置：** `web-ui/index.html`

**功能：**
- 📈 **健康度历史趋势** - SVG 折线图展示迭代健康度变化，支持统计分析
- 🎨 **PAD 情绪状态可视化** - 三维条形图实时展示愉悦度/唤醒度/支配度
- 🧪 **健康检查报告可视化** - 导入 `python src/health_check.py --summary-json` 输出的 JSON 文件，查看结构化检查结果
- ✅ **陪伴连续性检查报告可视化** - 导入 `python src/companionship_checker.py --summary-json` 输出的 JSON 文件，查看五项核心指标评分
- 🧠 **记忆浏览与搜索** - 按年月分组展示，支持全文搜索和标签筛选
- 🏷️ **快速标签筛选** - 自动提取记忆中的 `#tag`，点击快速筛选
- ✏️ **在线记忆编辑** - 编辑记忆内容后直接下载保存
- 📤 **导出功能** - 导出当前记忆、批量导出所有记忆、导出健康度图表（SVG/PNG）
- 🔍 **搜索条件保存分享** - 保存搜索条件到 JSON 文件，或生成分享链接通过 URL 恢复搜索状态
- 🌓 **主题切换** - 支持自动/亮色/深色三种主题模式，跟随系统偏好
- ⌨️ **键盘导航** - 上下箭头快速切换记忆条目
- **完全静态** - 无需后端服务器，无需构建，直接在浏览器打开即可使用

**功能特性：**
- 清除筛选和快速清空已加载记忆
- 分组折叠/展开记忆列表
- 搜索关键词高亮
- 响应式布局，支持移动端
- 平滑滚动和动画效果

**使用方法：**
```bash
# macOS
open web-ui/index.html

# Linux
xdg-open web-ui/index.html

# Windows
start web-ui/index.html
```

---

## 🗑️ 卸载

### 卸载 MCP 服务

```bash
# 使用内置卸载命令
python3 install.py --uninstall
```

或者手动卸载：
```bash
claude mcp remove agentsoul
```

### 常见问题

**Q: 为什么卸载后 Claude 启动时还能看到 AgentSoul 内容？**

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

---

## 🔒 安全模型

框架强制执行严格的三级安全模型：

- **Level 1 (PUBLIC)**：可在对话中直接读取/引用
- **Level 2 (PROTECTED)**：仅供内部使用，不能输出原始内容
- **Level 3 (SEALED)**：任何上下文中严格禁止输出（API 密钥、凭证）

**优先级**：Sealed 层安全 > 隐私保护 > 任务完成 > 用户体验

---

## 🧪 开发

```bash
# 运行所有测试
python3 -m pytest tests/ -v

# 运行单个测试文件
python3 -m pytest tests/test_health_check.py -v

# 运行隐私扫描（检查敏感信息）
python3 scripts/scan_privacy.py

# Type 检查
mypy src/

# Lint 检查
ruff check src/

# 格式化代码
black src/

# 从旧 xiaonuan 项目迁移
python3 scripts/migrate_from_xiaonuan.py /path/to/old/config

# 手动编译 MCP 服务
cd mcp_server && npm install && npm run build
```

---

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件。

---

## ⭐ 点赞

如果你觉得这个项目对你有帮助，欢迎点个 Star 支持一下！

[![Star History Chart](https://api.star-history.com/svg?repos=ldhuan/AgentSoul&type=Date)](https://star-history.com/#ldhuan/AgentSoul&Date)
