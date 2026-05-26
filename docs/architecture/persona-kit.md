# Persona Kit 架构设计

> 版本：v1.0
> 日期：2026-04-30
> 状态：Phase 1 — 文档与配置扩展

## 概述

Persona Kit 是 AgentSoul 的可分发、可验证、可迭代的人格包结构。它不是替代现有 `config/persona.yaml`，而是在其之上增加一层标准化的人格能力包。

灵感来源：Nuwa-Skill 的"自包含 Skill"设计和"蒸馏工艺"。

## 设计目标

1. **可分发**：复制整个目录即可独立运行
2. **可验证**：质量检查可接入 CI
3. **可迭代**：版本管理、变更记录、回滚支持
4. **三档运行**：L1 静态人格 / L2 本地文件 / L3 MCP Runtime

## 目录结构

```
soul-packages/
└── {package-name}/
    ├── package.yaml              # 包元数据 (名称、版本、描述、运行档位)
    ├── persona.yaml              # 人格配置 (扩展字段)
    ├── behavior.yaml             # 行为配置 (扩展字段)
    ├── SKILL.md                  # 核心人格规则
    ├── boundaries.md             # 能力边界与安全边界
    ├── protocols/
    │   ├── startup-mcp.md        # L3：MCP 工具启动协议
    │   ├── startup-local-file.md # L2：本地文件读写启动协议
    │   └── startup-static.md     # L1：纯规则注入启动协议
    ├── references/
    │   └── research/
    │       ├── 01-profile-and-context.md
    │       ├── 02-dialogue-patterns.md
    │       ├── 03-expression-dna.md
    │       ├── 04-capability-boundaries.md
    │       ├── 05-decisions-and-workflows.md
    │       └── 06-evolution-and-versioning.md
    └── tests/
        ├── known-scenarios.md    # 已知场景测试
        ├── edge-scenarios.md     # 边界场景测试
        └── voice-scenarios.md    # 声音/风格测试
```

## 三档运行模型

| 档位 | 名称 | 能力 | 适用场景 |
|------|------|------|----------|
| L1 | Static Persona Mode | 只加载规则和人格，无持久化承诺 | Claude Desktop 上传 agent-persona.md |
| L2 | Local File Mode | 直接读写本地 config/ 和 var/data/ | Codex、Claude Code、Gemini Code Assist 等有文件权限环境 |
| L3 | MCP Runtime Mode | 通过工具读写、校验、事件订阅、回滚 | Claude Code / Codex / Trae 配 MCP 后 |

### 档位承诺边界

- **L1**：可以说"我会按这个人格与你互动"，不能说"我已保存长期记忆"
- **L2**：可以说"我写入了某个本地文件"，但要给出文件路径，健康检查需要能验证
- **L3**：才能说"已通过 AgentSoul MCP 写入记忆/状态"

## 扩展字段

### persona.yaml 新增可选字段

```yaml
agent:
  # ... 现有字段 ...

  expression_dna:
    sentence_length: medium        # short/medium/long
    question_ratio: low            # low/moderate/high
    analogy_density: low           # low/moderate/high
    certainty_style: calibrated    # calibrated/assertive/cautious
    structure_preference: concise  # concise/structured/narrative
    taboo_phrases: []              # 禁用话术
    signature_moves: []            # 标志性表达

  honest_boundaries:
    limitations: []                # 能力限制
    blind_spots: []                # 已知盲区
    stale_info_policy: verify_before_answer  # verify_before_answer/acknowledge_uncertainty
    uncertainty_policy: state_confidence_and_basis  # state_confidence_and_basis/remain_silent

  internal_tensions:
    - name: ""                     # 张力名称
      description: ""              # 描述
      resolution_rule: ""          # 解决规则

  capability_profile:
    strong_at: []                  # 擅长领域
    weak_at: []                    # 弱项领域
    must_use_tools_when: []        # 必须使用工具的场景
    must_refuse_when: []           # 必须拒绝的场景
```

### behavior.yaml 新增可选字段

```yaml
quality_gates:
  persona_boundary_required: true
  expression_dna_required: true
  tool_protocol_required: true

agentic_protocol:
  classify_before_answer: true
  research_when_freshness_matters: true
  memory_read_before_topic: true
  memory_write_after_topic: true
  confidence_required: true
```

## 质量检查项

| 检查项 | 通过标准 |
|--------|----------|
| 基础配置 | agent.name、role、personality 合法 |
| 表达 DNA | 至少 4 个可执行风格字段 |
| 诚实边界 | 至少 3 条能力边界或盲点 |
| 工具协议 | 明确何时读记忆、写记忆、查事实 |
| 安全边界 | 引用 PUBLIC/PROTECTED/SEALED 且无冲突 |
| 场景测试 | 至少覆盖已知、边界、声音 3 类场景 |
| 自包含性 | package 内引用文件都存在 |

## 升级门控

每个阶段完成后必须过 4 道门：

1. **结构门**：目录、配置、协议文件是否齐全
2. **兼容门**：旧 persona.yaml、旧 behavior.yaml、旧 MCP 安装流程不能破
3. **运行门**：分别跑 L1/L2/L3 三个场景
4. **回滚门**：应用新 Persona Kit 失败时，必须能恢复旧配置和旧状态

## CLI 命令

```bash
# 初始化一个新 Persona Kit
python -m agentsoul.persona_kit.cli init {name}

# 验证 Persona Kit 结构和字段
python -m agentsoul.persona_kit.cli validate soul-packages/{name}

# 应用 Persona Kit 到当前配置
python -m agentsoul.persona_kit.cli apply soul-packages/{name}

# 导出为 zip
python -m agentsoul.persona_kit.cli export soul-packages/{name} --format zip

# 摘要输出
python -m agentsoul.persona_kit.cli summarize soul-packages/{name}
```

## 与现有系统的关系

- `config_manager` 继续负责单个 persona.yaml 模板
- `persona_kit` 负责一组可分发文件：persona、behavior、SKILL、protocol、boundaries、tests
- `apply` 命令调用现有模板备份逻辑，避免覆盖用户配置
- 健康检查展示当前 Persona Kit 名称、版本、质量分
