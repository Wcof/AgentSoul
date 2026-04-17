# AgentSoul 项目结构说明

本文档描述重构后的标准目录布局与模块边界，作为开发与文档引用基线。

## 1. 顶层结构

```text
AgentSoul/
├── apps/
│   ├── mcp-server/          # TypeScript MCP 服务
│   └── web/                 # 静态观测 UI
├── src/
│   └── agentsoul/           # Python 核心包
├── integrations/
│   └── openclaw/            # OpenClaw 集成
├── config/                  # 配置文件
├── docs/                    # 文档
├── examples/                # 示例
├── scripts/                 # 辅助脚本
├── tests/                   # 测试（当前主目录）
├── var/                     # 运行时数据/日志/快照
├── pyproject.toml
├── install.py
└── README.md
```

## 2. Python 包内分层

`src/agentsoul/` 按职责划分：

- `config/`：配置加载、模板、校验
- `memory/`：记忆增强能力
- `learning/`：自适应学习
- `health/`：健康与陪伴连续性检查
- `storage/`：本地与 MCP 存储实现
- `adapters/`：模型侧注入适配器
- `runtime/`：运行时探测、路径与通用工具
- `cli/`：命令入口（安装器等）
- `templates/`：内置规则模板

兼容导入（例如 `agentsoul.config_manager.*`）目前保留为转发层，目标是最终收敛到分层命名空间。

## 3. 数据与源码边界

统一约定：

- 源码不写运行产物
- 运行数据统一进入 `var/`

关键路径：

- `var/data/`：记忆、身份、状态等
- `var/logs/`：运行日志
- `var/snapshots/`：快照类输出

## 4. 对外命令入口

- 安装入口：`python3 install.py ...`
- 环境探测：`python3 -m agentsoul.runtime.entry_detect ...`
- 健康检查：`python3 -m agentsoul.health.check ...`
- 陪伴检查：`python3 -m agentsoul.health.companionship_checker ...`

## 5. 维护约束

- 新功能优先落在 `src/agentsoul/` 分层目录，不新增根级业务实现。
- 新文档与示例禁止再使用旧 `data/` 根目录语义。
- `apps/mcp-server` 与 Python 核心通过数据协议协作，不共享实现代码。
