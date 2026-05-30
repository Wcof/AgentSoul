# AgentSoul — Domain Glossary

## 核心概念 / Core Concepts

- **Companion** — 用户的 AI 伙伴实体，拥有外观、人格、情感状态、记忆和成长系统。
- **Soul** — Companion 的人格内核，包含 PAD 情感模型、基线性格、记忆层。
- **PAD** — Pleasure-Arousal-Dominance 三维情感模型，驱动 Companion 的情绪表达。
- **Pet Appearance** — Companion 的视觉外形（kind + skin + outfit），独立于人格。
- **Pet Kind** — 外形类别：`slime`（粘液怪）、`cat`（猫咪）、`custom`（自定义）。
- **Pet Skin** — 外形皮肤，属于特定 kind（如 `default` 属于 `slime`，`tabby` 属于 `cat`）。

## Gateway 与渠道 / Gateway & Channels

- **Gateway** — 本地代理服务器，负责将请求路由到最优 Provider。
- **Channel** — Gateway 中的一个 Provider 连接通道，有 API 类型、baseUrl、密钥、优先级。
- **Channel First** — Control Center 中 Gateway 的唯一一等配置对象是 `Channel`；`Provider` 仅表示 Channel 指向的上游服务属性（协议、厂商、baseUrl、鉴权方式），不是并列的独立管理系统。
- **Failover Sequence** — 按优先级排序的渠道列表，故障时自动切换到下一渠道。
- **Circuit Breaker** — 渠道的断路器状态（`closed` / `open` / `half_open`），防止故障扩散。
- **Channel Store** — 持久化渠道配置的存储层（SQLite）。
- **Cost Tracker** — 跟踪每个渠道的请求量、Token 用量、估算成本。
- **Authoritative Store** — Control Center 业务实体的唯一真实来源；在桌面端默认是本地 SQLite。`localStorage` 仅用于界面偏好，不能作为业务实体的持久化来源。
- **Local Control Plane** — Control Center 优先实现本地闭环能力：本地存储、本地状态恢复、本地 Gateway 检查、本地 MCP 生命周期、本地审批与信任授权持久化。外部依赖（如远程同步、WebDAV、外链导入）不是一阶段必需能力。
- **Gateway Control Surface** — Gateway 继续作为本地运行服务存在；Control Center 是它的本地管理前端，通过本地 API / Tauri 命令读写同一套真实状态，而不是在前端重写一套并行业务逻辑。

## 成本与审计 / Costs & Audit

- **Estimated Cost** — 本地根据审计记录计算的成本（非服务商报告）。
- **Provider Usage** — 服务商独立报告的用量（如果可用）。
- **Provider Mix / Model Mix** — 请求在不同服务商/模型间的分布比例。

## 安全与审批 / Safety & Approval

- **Approval Request** — 高风险操作需要用户确认的审批请求。
- **Risk Notice** — 安全策略外的异常行为通知。
- **Scoped Trust Grant** — 对特定操作类型的临时信任授权，有过期时间。
- **Action Risk Class** — 操作风险等级：`safe` / `sensitive` / `high-risk` / `critical`。

## 技能管理 / Skills

- **Skill Pack** — 可安装的功能扩展包，包含规则文件。
- **Project Activation** — 在特定项目中启用/禁用技能包。
- **Workspace Rule Deployment** — 将技能包的规则文件部署到工作区（符号链接或复制）。

## 会话管理 / Sessions

- **Work Session** — 可搜索/可恢复的工作会话记录。
- **Session Launcher** — 安全门控的会话启动器。

## 设置 / Settings

- **Growth Profile** — Companion 成长参数配置（XP倍数、能量消耗、疲劳阈值等）。
- **Persona Template** — 预设的人格模板（如 Friendly、Professional），包含角色、性格标签、描述。
- **Companion Customization** — Companion 外观自定义（kind + skin + outfit + displayName）。
- **Local-first** — 数据默认存储在本地，不需要云端登录。

## Control Center

- **Shell** — 桌面端主界面外壳，包含侧边栏 + 主内容区。
- **Dock Position** — 侧边栏停靠位置（left / right / top / bottom）。
- **Area** — Control Center 中的功能区域（Companion、Gateway、Skills、Sessions、Costs、Safety、Settings）。
