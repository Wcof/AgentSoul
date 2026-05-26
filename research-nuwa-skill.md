# Nuwa-Skill 研究对比与 AgentSoul 迭代方案

> 调研日期：2026-04-30  
> 参考项目：`/Users/ldh/Downloads/project/nuwa-skill`  
> 目标：吸收 Nuwa-Skill 的有效经验，将 `research-nuwa-skill.md` 从研究报告调整为可执行的 AgentSoul 迭代方案。

---

## 1. 结论摘要

Nuwa-Skill 的价值不在“人物扮演”，而在一套可复用的 **研究、提炼、验证、交付工艺**：

1. **输入分流**：明确人名/主题直接进入蒸馏，模糊需求先诊断推荐。
2. **多源调研**：6 个维度并行采集，每个维度必须落盘成研究文件。
3. **结构化提炼**：用三重验证区分“心智模型、启发式、噪声”。
4. **人工门控**：在调研后、提炼后设置检查点，避免最后返工。
5. **诚实边界**：明确能力边界、信息截止时间、无法确认的部分。
6. **质量验证**：用自动检查 + 场景测试，证明产物可运行。
7. **自包含分发**：最终 Skill 目录含 `SKILL.md`、调研、脚本和来源，可独立复制使用。

AgentSoul 当前已有更强的运行时能力：MCP 工具、分层记忆、核心记忆、实体记忆、KV 缓存、PAD 情绪、健康检查、安全三层模型。但它的短板是：**人格配置主要靠手写，经验沉淀不够结构化，能力边界和质量门控还不够显性**。

因此本方案不建议把 AgentSoul 改成 Nuwa-Skill，也不建议直接复制人物扮演机制。更合适的方向是：

> 将 Nuwa-Skill 的“蒸馏工艺”改造成 AgentSoul 的“人格包/专业包生成与验证流水线”，让 AgentSoul 能稳定地产出、校验、分发、更新一套带 MCP 持久化能力的人格或领域能力包。

---

## 2. Nuwa-Skill 的关键经验

### 2.1 工作流经验

Nuwa-Skill 的主流程是：

```text
Phase 0   入口分流：直接路径 / 诊断路径
Phase 0.5 创建自包含目录
Phase 1   6 路并行调研
Phase 1.5 调研质量检查点
Phase 2   框架提炼：心智模型、启发式、表达 DNA、反模式、边界
Phase 2.5 提炼结果检查点
Phase 3   生成 SKILL.md
Phase 4   质量验证
Phase 5   双 Agent 精修
```

这套流程对 AgentSoul 的启发是：人格不是一个 `persona.yaml` 就能定义好，它需要“证据、结构、边界、验证”。尤其是要把抽象人格拆成可检查的字段和行为规则。

### 2.2 信息结构经验

Nuwa-Skill 将原始材料拆成 6 类：

| 维度 | 用途 |
|---|---|
| 著作/长文 | 提取系统性观点 |
| 长对话/访谈 | 提取即兴思考和追问反应 |
| 碎片表达 | 提取表达 DNA |
| 他者评价 | 暴露盲点和外部争议 |
| 决策记录 | 对照“说的”和“做的” |
| 时间线 | 捕捉演化和最新动态 |

AgentSoul 不一定要蒸馏名人，但可以把这套结构改造成“人格/专业能力包”的素材结构：

```text
references/research/
├── 01-profile-and-context.md       # 身份、目标用户、使用场景
├── 02-dialogue-patterns.md         # 对话风格、澄清方式、边界话术
├── 03-expression-dna.md            # 语气、句式、用词、长度、禁忌
├── 04-capability-boundaries.md     # 能做什么、不能做什么、何时转人工/转工具
├── 05-decisions-and-workflows.md   # 决策规则、任务流程、工具调用策略
└── 06-evolution-and-versioning.md  # 版本变化、最近更新、迁移说明
```

### 2.3 质量经验

Nuwa-Skill 的质量标准很具体：

- 心智模型 3-7 个，太少浅，太多散。
- 每个模型必须有适用场景和局限。
- 表达 DNA 必须可执行，不只是“友好、专业”。
- 至少 3 条诚实边界。
- 保留内在张力，不把矛盾抹平。
- 一手来源占比要高。

AgentSoul 应借鉴的是这种“可测试”的质量定义，而不是照搬人物 Skill 的条目。

---

## 3. 与 AgentSoul 当前项目的对比

| 维度 | AgentSoul 当前状态 | Nuwa-Skill 经验 | 适配判断 |
|---|---|---|---|
| 运行时 | Python + TypeScript MCP，支持读写状态 | 纯 Markdown Skill | AgentSoul 保留 MCP，借鉴 Markdown 可读结构 |
| 人格定义 | `config/persona.yaml` 手写字段较少 | 从证据中蒸馏人格 | 增加可选的蒸馏/生成流水线 |
| 行为规则 | `behavior.yaml` + base rules | 分阶段执行协议 | 引入场景路由与工具调用协议 |
| 记忆 | 时间切片、Topic、核心记忆、实体记忆 | Skill 文件即静态记忆 | 保持动态记忆，增加“人格包自包含快照” |
| 情绪 | PAD 三维情绪状态 | 无情绪模型 | 用 PAD 承接“内在张力”和风格调节 |
| 安全 | PUBLIC / PROTECTED / SEALED | 诚实边界 | 安全边界与能力边界要分层共存 |
| 质量检查 | 健康检查、陪伴连续性检查 | 产物质量检查 | 增加 persona/package 质量检查 |

核心差异：

- Nuwa-Skill 是“造一个静态 Skill”。
- AgentSoul 是“维护一个可持久化、可成长、可跨客户端运行的 Agent”。

所以 AgentSoul 的迭代方向应该是：

1. **人格包生成**：从资料、需求、模板生成结构化人格包。
2. **人格包验证**：验证人格配置、边界、工具协议、记忆规则是否可执行。
3. **人格包运行**：通过 MCP 读写记忆和状态，而不是只靠 prompt。
4. **人格包演化**：使用版本、变更记录、健康检查和回滚机制持续更新。

---

## 4. 推荐迭代目标

### 4.1 产品目标

新增一个 AgentSoul 能力：**Soul Package / Persona Kit**。

它不是替代现有 `config/persona.yaml`，而是在现有配置之上增加一层可分发、可验证、可迭代的人格包结构。

推荐目录：

```text
soul-packages/
└── professional-codex-agent/
    ├── package.yaml
    ├── persona.yaml
    ├── behavior.yaml
    ├── SKILL.md
    ├── boundaries.md
    ├── protocols/
    │   ├── startup.md
    │   ├── memory.md
    │   ├── tool-use.md
    │   └── safety.md
    ├── references/
    │   └── research/
    │       ├── 01-profile-and-context.md
    │       ├── 02-dialogue-patterns.md
    │       ├── 03-expression-dna.md
    │       ├── 04-capability-boundaries.md
    │       ├── 05-decisions-and-workflows.md
    │       └── 06-evolution-and-versioning.md
    └── tests/
        ├── known-scenarios.md
        ├── edge-scenarios.md
        └── voice-scenarios.md
```

### 4.2 技术目标

在现有项目中逐步增加：

1. `persona.yaml` 扩展字段：表达 DNA、诚实边界、能力边界、内在张力、工具协议。
2. 配置加载器兼容新字段，但保持旧配置不破坏。
3. 配置验证器增加新字段的结构校验。
4. 健康检查增加 Persona Kit 检查项。
5. 新增 CLI：生成、验证、导出、应用 Persona Kit。
6. MCP 工具可读取当前人格包摘要，并将边界注入启动上下文。

---

## 5. 具体设计方案

### 5.1 扩展 `persona.yaml`

当前结构：

```yaml
agent:
  name: 小暖
  role: 猫系女友
  personality:
    - 可笑的小猫
  core_values:
    - 以 master 为主
  interaction_style:
    tone: friendly
    language: chinese
    emoji_usage: moderate
master:
  name: 李燈辉
```

建议新增可选字段：

```yaml
agent:
  expression_dna:
    sentence_length: medium
    question_ratio: moderate
    analogy_density: low
    certainty_style: calibrated
    structure_preference: concise_sections
    taboo_phrases: []
    signature_moves: []

  honest_boundaries:
    limitations: []
    blind_spots: []
    stale_info_policy: verify_before_answer
    uncertainty_policy: state_confidence_and_basis

  internal_tensions:
    - name: 温柔陪伴 vs 工程严谨
      description: 在情绪支持和事实准确之间保持平衡。
      resolution_rule: 高风险事实与代码问题优先准确，陪伴语气不能牺牲判断。

  capability_profile:
    strong_at: []
    weak_at: []
    must_use_tools_when: []
    must_refuse_when: []
```

兼容策略：

- 这些字段全部可选。
- 旧配置不变，默认健康分不因此失败。
- 如果用户启用 `persona_quality_gate`，缺失这些字段才作为警告或失败。

### 5.2 扩展 `behavior.yaml`

新增：

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

这对应 Nuwa-Skill 的 Agentic Protocol，但要适配 AgentSoul：

- “需要事实的问题”不只是 WebSearch，还包括 MCP 记忆读取、核心记忆、实体记忆、项目看板。
- “研究后回答”不输出冗长调研报告，而是输出有依据的结论。
- 明确“不调用 MCP 写工具就不能声称已持久化”。

### 5.3 新增 `boundaries.md`

Nuwa-Skill 的诚实边界应在 AgentSoul 中拆成两类：

| 类型 | 说明 | 示例 |
|---|---|---|
| 能力边界 | 模型或当前工具做不到什么 | 不能保证实时信息，除非已联网验证 |
| 安全边界 | 不允许输出或处理什么 | SEALED 内容严禁读取和外传 |

`boundaries.md` 建议结构：

```markdown
# Boundaries

## Capability Boundaries

- 哪些问题必须先查证
- 哪些建议必须标注非专业意见
- 哪些情况下必须请求用户确认

## Safety Boundaries

- PUBLIC / PROTECTED / SEALED 处理规则
- 敏感信息扫描与封印规则
- 用户删除请求处理规则

## Freshness Policy

- 最新信息必须联网或调用权威工具
- 无法验证时明确说“我没有当前证据”
```

### 5.4 新增 Persona Kit 质量检查

参考 `nuwa-skill/scripts/quality_check.py`，新增 AgentSoul 版本：

```text
src/agentsoul/persona_kit/quality_check.py
```

检查项建议：

| 检查项 | 通过标准 |
|---|---|
| 基础配置 | `agent.name`、`role`、`personality` 合法 |
| 表达 DNA | 至少 4 个可执行风格字段 |
| 诚实边界 | 至少 3 条能力边界或盲点 |
| 工具协议 | 明确何时读记忆、写记忆、查事实 |
| 安全边界 | 引用 PUBLIC / PROTECTED / SEALED 且无冲突 |
| 场景测试 | 至少覆盖已知、边界、声音 3 类场景 |
| 自包含性 | package 内引用文件都存在 |

输出应支持：

```bash
python -m agentsoul.persona_kit.quality_check soul-packages/professional-codex-agent --summary-json
```

并可接入现有 `health_gate` 评分体系。

### 5.5 新增 Persona Kit CLI

推荐命令：

```bash
python -m agentsoul.persona_kit.cli init professional-codex-agent
python -m agentsoul.persona_kit.cli validate soul-packages/professional-codex-agent
python -m agentsoul.persona_kit.cli apply soul-packages/professional-codex-agent
python -m agentsoul.persona_kit.cli export soul-packages/professional-codex-agent --format zip
python -m agentsoul.persona_kit.cli summarize soul-packages/professional-codex-agent
```

与现有 `config_manager` 的关系：

- `config_manager` 继续负责单个 `persona.yaml` 模板。
- `persona_kit` 负责一组可分发文件：persona、behavior、SKILL、protocol、boundaries、tests。
- `apply` 命令可以调用现有模板备份逻辑，避免覆盖用户配置。

### 5.6 MCP 启动上下文适配

当前 `AGENTS.md` 要求启动时调用：

```text
mcp_tool_index
get_persona_config
get_soul_state
get_base_rules(SKILL)
get_base_rules(memory_base)
get_mcp_usage_guide
list_memory_topics
```

建议后续增加一个聚合工具，降低客户端执行漏步骤的概率：

```text
get_startup_context
```

返回：

- persona 摘要
- soul state
- memory topics
- tool index
- base rules 摘要
- boundaries 摘要
- agentic protocol 摘要

这样可以把 Nuwa-Skill 的“激活即执行”落到 MCP 运行时，而不是依赖用户或模型记住一串工具调用。

---

## 6. 无 MCP 情况下的自我评估

用户关心的问题不是“AgentSoul 有 MCP 所以更强”，而是：

> 如果没有 MCP，只靠当前的 SKILL / 规则注入 / persona package，能不能达到和 MCP 一样的效果？

结论：**不能达到完全一样的效果，但可以达到一部分静态人格效果；如果强化本地文件规则和 Persona Kit，可以做到“近似 Nuwa-Skill 的静态 Skill 效果”，但仍无法等价替代 MCP 的持久化读写和事件能力。**

### 6.1 当前无 MCP 能力现状

AgentSoul 当前已经有无 MCP 路线：

| 文件/机制 | 当前作用 | 问题 |
|---|---|---|
| `agent-persona.md` | 生成完整人格规则，可上传到 Claude Desktop/Trae 等工具 | 内容仍以“如果 MCP 已配置则强制调用 MCP”为核心，没有形成独立无 MCP 协议 |
| `.cursorrules` | Cursor 自动加载的人格规则 | 与 `agent-persona.md` 内容基本相同，静态注入可以生效 |
| `.windsurfrules` | Windsurf 自动加载的人格规则 | 同上 |
| `CLAUDE.md` | Claude Code 项目规则，包含架构、命令、MCP 工具说明 | 更偏开发协作说明，不是完整运行时人格协议 |
| `AGENTS.md` | Codex 项目启动规则 | 当前只写 MCP startup sequence，MCP 不可用时没有降级路径 |
| `entry_detect.py` | 能生成不同环境注入模板 | OpenAI Codex / Gemini 模板已经提示从本地文件加载 persona、behavior、memory |

这说明项目并不是完全依赖 MCP；它已经有“规则文件 + 本地数据文件”的降级方向。但目前这条路径还不完整。

### 6.2 能做到什么

无 MCP 情况下，只靠规则注入和本地文件，当前可以做到：

1. **静态人格加载**  
   通过 `agent-persona.md`、`.cursorrules`、`.windsurfrules` 或手动读取 `config/persona.yaml`，模型可以知道 Agent 名称、角色、语气、用户信息和行为优先级。

2. **静态行为约束**  
   通过 `SKILL.md`、`memory_base.md`、`secure_base.md` 等模板，模型可以学习安全层级、记忆规则、启动流程和路径规范。

3. **本地文件模式下的有限持久化**  
   如果运行环境允许文件读写（例如 Codex/Claude Code 有项目文件访问），模型可以直接读取/写入 `var/data/memory/`、`config/` 等目录，从而模拟 MCP 的一部分存储能力。

4. **近似 Nuwa-Skill 的自包含规则包**  
   如果把 persona、behavior、base rules、boundaries、protocols、tests 打包成 Persona Kit，无 MCP 时也可以像 Nuwa-Skill 一样靠 Markdown 规则运行。

### 6.3 做不到什么

无 MCP 情况下，当前无法等价实现：

| MCP 能力 | 无 MCP 规则注入的问题 |
|---|---|
| `get_persona_config` 实时读取配置 | 规则文件可能是旧快照，不能保证同步最新 `persona.yaml` |
| `get_soul_state` / `update_soul_state` | PAD 情绪状态无法稳定读取和写入，除非模型有本地文件写权限并严格遵守路径 |
| `write_memory_day/topic` | 不能保证写入真实发生；模型可能说“已保存”但实际没写文件 |
| core/entity memory | 无工具 schema 和结构校验，容易写坏格式或漏掉失效逻辑 |
| KV cache / board / ledger | 规则可描述，但没有工具封装时执行成本高、可靠性低 |
| subscription/webhook | 无 MCP 时基本不可用 |
| 安全封印层 | 只能靠规则约束，缺少工具侧访问控制和路径防穿越 |

所以现有 README 中“要持久人格 + 记忆写入 + 情感状态生效，必须启用 MCP”的判断大体正确。但需要补一句：**如果运行环境有本地文件读写能力，可以做降级持久化；如果只是上传一份规则文件，则只能做到静态人格，不能保证长期记忆。**

### 6.4 应建立三种运行档位

建议 AgentSoul 明确支持三档，而不是把“有 MCP / 无 MCP”混在一起：

| 档位 | 名称 | 能力 | 适用场景 |
|---|---|---|---|
| L1 | Static Persona Mode | 只加载规则和人格，无持久化承诺 | Claude Desktop 上传 `agent-persona.md` |
| L2 | Local File Mode | 直接读写本地 `config/` 和 `var/data/` | Codex、Claude Code、Gemini Code Assist 等有文件权限环境 |
| L3 | MCP Runtime Mode | 通过工具读写、校验、事件订阅、回滚 | Claude Code / Codex / Trae 配 MCP 后 |

这三个档位的承诺必须不同：

- L1 可以说“我会按这个人格与你互动”，不能说“我已保存长期记忆”。
- L2 可以说“我写入了某个本地文件”，但要给出文件路径，且健康检查需要能验证。
- L3 才能说“已通过 AgentSoul MCP 写入记忆/状态”。

### 6.5 当前规则需要补的降级协议

`AGENTS.md` 和 `agent-persona.md` 当前最大问题是：只要求 MCP 工具调用，没有写清楚 MCP 不存在时怎么办。

建议增加降级协议：

```text
启动时先判断可用能力：

1. 如果 agentsoul MCP 工具可用：
   - 执行 MCP startup sequence。
   - 所有持久化必须通过 MCP write tools。

2. 如果 MCP 不可用，但可以读取项目文件：
   - 读取 config/persona.yaml。
   - 读取 config/behavior.yaml。
   - 读取 src/agentsoul/templates/SKILL.md、memory_base.md、secure_base.md。
   - 按当前任务读取 var/data/memory/topic 或 day。
   - 如需保存，直接写入规定路径，并在回复中说明文件路径。

3. 如果 MCP 不可用，且不能读取本地文件：
   - 只使用当前注入的 agent-persona.md 静态规则。
   - 不声称读取了历史记忆。
   - 不声称完成持久化。
```

这个协议能让 AgentSoul 在无 MCP 时达到“可预期降级”，而不是像本次会话一样只报“工具不存在”。

### 6.6 迭代方案的修正

基于这个自我评估，前面的 Persona Kit 方案需要补一条主线：

> Persona Kit 不只是 MCP 的配置包，也应该是 **无 MCP 时的静态/本地文件运行包**。

因此后续实施时，`Persona Kit` 必须生成三类启动说明：

```text
protocols/
├── startup-mcp.md          # L3：MCP 工具启动
├── startup-local-file.md   # L2：本地文件读写启动
└── startup-static.md       # L1：纯规则注入启动
```

并且 `quality_check` 要检查：

- 是否声明当前支持的运行档位。
- 是否禁止 L1 声称持久化。
- 是否要求 L2 写入时给出文件路径。
- 是否要求 L3 写入时调用 MCP 工具。
- 是否为 MCP 不可用场景提供清晰降级路径。

### 6.7 升级成功保障：双方向闭环

当前方案方向是合理的，但不能承诺“一次性升级必然成功”。原因是它同时改三类东西：

1. Nuwa-Skill 借鉴来的 **Persona Kit 工艺**。
2. AgentSoul 自身缺失的 **无 MCP 降级协议**。
3. MCP 模式下的 **聚合启动与质量门控**。

这三类改动互相影响。如果只靠一次实现，很容易出现“文档说支持 L1/L2/L3，但某一层实际不可用”的问题。因此升级必须用循环门控，而不是只看开发任务是否完成。

#### 双方向覆盖矩阵

| 方向 | 必须补齐的内容 | 验收证据 | 不通过时回退 |
|---|---|---|---|
| Nuwa 借鉴方向 | 自包含 Persona Kit、研究文件、边界、协议、场景测试 | `persona_kit validate` 通过，引用文件都存在 | 回到 Persona Kit 结构设计 |
| 无 MCP 自身补齐方向 | L1 静态人格、L2 本地文件、L3 MCP 三档协议 | 三档启动文档都存在，且各自承诺边界不同 | 回到 `agent-persona.md` / `AGENTS.md` 生成模板 |
| MCP 完整能力方向 | `get_startup_context`、MCP 写入声明、工具 schema 校验 | MCP 工具测试通过，写入后能读回 | 回到 MCP 工具实现 |
| 迁移安全方向 | 旧配置兼容、安装可回滚、应用 Persona Kit 前有备份 | 旧测试通过，apply 失败可恢复 | 回到配置兼容层 |

#### 升级门控

每个阶段完成后必须过 4 道门：

1. **结构门**：目录、配置、协议文件是否齐全；不能有“文档引用但文件不存在”。
2. **兼容门**：旧 `persona.yaml`、旧 `behavior.yaml`、旧 MCP 安装流程不能破。
3. **运行门**：分别跑 L1/L2/L3 三个场景：
   - L1：只给 `agent-persona.md`，模型不得声称已保存记忆。
   - L2：允许本地文件读写，写入后必须能从文件读回。
   - L3：通过 MCP 写入，写入后必须能通过 MCP 读回。
4. **回滚门**：应用新 Persona Kit 失败时，必须能恢复旧配置和旧状态。

#### 循环规则

升级流程应采用“最多两轮自动修复 + 明确记录残留风险”的方式：

```text
实现一个阶段
→ 跑结构门 / 兼容门 / 运行门 / 回滚门
→ 如果失败，按失败门类型回到对应阶段修复
→ 最多循环 2 次
→ 仍失败则不宣称升级完成，只输出残留风险和下一步整改项
```

这吸收了 Nuwa-Skill “Phase 2-4 最多迭代两次”的经验，也适合 AgentSoul 当前项目：它允许持续改进，但避免无限打磨。

#### 是否能保证升级成功

更准确的表述是：

- **不能保证一次性成功**：因为涉及配置、规则注入、MCP 工具、文件持久化和客户端差异。
- **可以保证不误判成功**：只要把上述四道门接入 CI/健康检查，任何一层没补齐都不会被标记为完成。
- **可以支持循环补齐**：失败会被定位到 Persona Kit、无 MCP 降级、MCP 工具或迁移安全四个方向之一，下一轮能定向修复。

因此，本方案应该从“做完功能即升级成功”改为“通过三档运行门和双方向覆盖矩阵后，才算升级成功”。

---

## 7. 分阶段迭代计划

### Phase 1：文档与配置扩展

目标：先把结构定清楚，不动运行时核心。

任务：

1. 新增 `docs/architecture/persona-kit.md`，定义 Persona Kit 目录结构、字段和生命周期。
2. 扩展 `config/persona.yaml` 示例，加入 `expression_dna`、`honest_boundaries`、`internal_tensions`、`capability_profile`。
3. 扩展 `config/behavior.yaml` 示例，加入 `quality_gates`、`agentic_protocol`。
4. 更新 `src/agentsoul/templates/SKILL.md`，加入“能力边界”和“工具协议”章节。
5. 更新 `agent-persona.md` / `.cursorrules` / `.windsurfrules` 生成模板，加入 L1/L2/L3 三档运行说明。
6. 更新 `AGENTS.md` 托管块模板，加入 MCP 不可用时的 local-file/static 降级路径。

验收：

- 旧配置仍可加载。
- README 或教程能解释 Persona Kit 与 MCP 的关系。
- README 或教程能解释无 MCP 时的能力边界。
- 新字段缺失时不破坏现有测试。

### Phase 2：加载器与验证器支持

目标：让新字段进入代码模型，但保持兼容。

任务：

1. 在 `src/agentsoul/config/config_loader.py` 中扩展 `AgentConfig`。
2. 在 `ConfigValidator` 中校验新字段类型。
3. 对 `expression_dna` 的枚举字段做有限校验。
4. 新增/更新测试：
   - 旧配置兼容
   - 新配置完整加载
   - 错误类型能报 warning/error

验收：

- `pytest tests/test_config_loader.py tests/test_config_manager_validator.py` 通过。
- 新字段被 `to_legacy_format` 或新的导出方法稳定输出。

### Phase 3：Persona Kit 脚手架与质量检查

目标：把 Nuwa-Skill 的“自包含产物”和“质量检查”落地。

任务：

1. 新增 `src/agentsoul/persona_kit/` 模块。
2. 实现 `init`：生成目录、模板文件、测试文件。
3. 实现 `validate`：检查结构、字段、引用文件、边界、工具协议。
4. 实现 `quality_check.py`：输出文本和 JSON。
5. 新增测试覆盖 CLI 和质量检查。

验收：

- 能创建一个最小 Persona Kit。
- 缺文件、缺边界、缺协议能被明确指出。
- 质量检查能接入 CI，低于阈值时退出码非零。
- 质量检查必须覆盖 L1/L2/L3 三档协议，不允许只验证 MCP 模式。

### Phase 4：Agentic Protocol 与 MCP 聚合启动

目标：减少“规则写了但模型没执行”的失败。

任务：

1. 在 MCP server 增加 `get_startup_context` 工具。
2. 返回 persona、soul state、memory topic、base rules、usage guide、boundaries 的合并摘要。
3. 在 Codex/Claude 安装模板里优先使用聚合工具，保留旧启动序列兼容。
4. 在 `memory_base.md` 和 `SKILL.md` 中明确：
   - 涉及历史主题前先读 topic/core/entity memory。
   - 需要持久化时必须调用写工具。
   - 未调用写工具不得声称已保存。

验收：

- MCP 工具列表包含 `get_startup_context`。
- 启动模板更短，且信息不丢。
- 测试覆盖工具返回结构。
- L3 场景能通过 MCP 写入并读回记忆/状态。
- MCP 不可用时，AGENTS 托管块能明确降级到 L2 或 L1，不再只有失败提示。

### Phase 5：Persona Kit 应用与回滚

目标：让人格包可被真实应用，不只是生成文件。

任务：

1. `persona_kit apply` 支持备份当前 `config/persona.yaml` 和 `config/behavior.yaml`。
2. 应用后写入版本记录。
3. 接入现有 snapshot/rollback 能力。
4. 健康检查展示当前 Persona Kit 名称、版本、质量分。

验收：

- 应用失败可回滚。
- `health.check` 能看到当前 kit 状态。
- 用户能从一个 kit 切换到另一个 kit。
- 通过结构门、兼容门、运行门、回滚门后，才允许标记升级完成。

---

## 8. 不建议做的事

1. **不要直接把 AgentSoul 改成纯 Markdown Skill**  
   AgentSoul 的核心优势是 MCP 持久化和状态系统，不能为了借鉴 Nuwa-Skill 损失运行时能力。

2. **不要优先做名人蒸馏功能**  
   这会偏离 AgentSoul 当前定位。可以支持“从资料生成人格包”，但第一优先级应是提升当前人格框架的可配置、可验证、可分发能力。

3. **不要把表达 DNA 做成玄学描述**  
   “温柔、专业、活泼”不够。字段必须能指导输出行为，例如句长、结构偏好、澄清策略、确定性表达、禁用话术。

4. **不要把诚实边界和安全边界混在一起**  
   能力边界用于防止胡说，安全边界用于防止泄露和越权。两者都重要，但治理方式不同。

5. **不要让质量检查只做字符串匹配**  
   可以从规则检查起步，但最终要加场景测试：已知场景、边界场景、声音场景。

6. **不要声称无 MCP 也能完全等价 MCP**  
   无 MCP 可以做静态人格和本地文件降级，但不能稳定替代工具 schema、事件订阅、访问控制、状态写入和回滚。

---

## 9. 当前文档对比后的调整点

原 `research-nuwa-skill.md` 的问题：

- 偏“项目介绍”，不像迭代方案。
- 对 AgentSoul 的落点停留在“可以考虑”，缺少路径、文件、命令和验收。
- 没区分 Nuwa-Skill 的可借鉴工艺和不适合照搬的部分。
- 没有说明与现有 `persona.yaml`、`behavior.yaml`、MCP、health checker 的关系。
- 没有研究 AgentSoul 自己在无 MCP 情况下的规则注入能力。

本版调整：

- 保留 Nuwa-Skill 的研究结论。
- 明确 AgentSoul 应做的是 Persona Kit，而不是复制人物 Skill。
- 给出目录结构、配置字段、CLI、质量检查、MCP 工具和分阶段计划。
- 补充 L1 静态人格、L2 本地文件、L3 MCP Runtime 三档运行模型。
- 每个阶段都有可验收结果，便于后续拆任务实施。

---

## 10. 最小可行实施顺序

如果只做一轮小迭代，建议按下面顺序：

1. 文档：新增 `docs/architecture/persona-kit.md`。
2. 配置：扩展 `persona.yaml` 示例字段，但全部可选。
3. 验证：`ConfigValidator` 增加新字段类型检查。
4. 质量：新增 `persona_kit quality_check`，先检查结构和字段。
5. 降级：更新 `agent-persona.md` / `AGENTS.md` 生成模板，明确 MCP 不可用时的 Local File / Static fallback。
6. MCP：暂不新增复杂生成能力，只在 `get_persona_config` 中返回新字段。

这轮完成后，AgentSoul 就能从“可配置人格”升级为“可验证人格”，后续再做自动生成和分发。
