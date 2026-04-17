# 快速入门指南

欢迎使用 AgentSoul！本指南将帮助您快速上手 AgentSoul 人格框架。

## 目录

1. [环境要求](#环境要求)
2. [安装步骤](#安装步骤)
3. [快速配置](#快速配置)
4. [使用配置模板](#使用配置模板)
5. [验证安装](#验证安装)
6. [下一步](#下一步)

## 环境要求

在开始之前，请确保您的系统满足以下要求：

- **Python**: 3.10 或更高版本
- **Node.js**: 18 或更高版本（如需使用 MCP 服务）
- **操作系统**: macOS、Linux 或 Windows

## 安装步骤

### 1. 克隆项目

```bash
git clone https://github.com/yourusername/agentsoul.git
cd agentsoul
```

### 2. 安装 Python 依赖

```bash
# 创建虚拟环境（推荐）
python -m venv .venv

# 激活虚拟环境
# macOS/Linux:
source .venv/bin/activate

# Windows:
.venv\Scripts\activate

# 安装依赖
pip install -e ".[dev]"
```

### 3. 安装 MCP 服务（可选）

如果您需要使用 MCP 服务：

```bash
cd apps/mcp-server
npm install
npm run build
```

## 快速配置

### 交互式配置

运行安装脚本进行交互式配置：

```bash
python3 install.py
```

这将引导您完成：
- 选择语言（中文/英文）
- 配置 Agent 身份
- 配置用户（Master）身份
- 初始化情感状态

### 手动配置

您也可以直接编辑配置文件：

```bash
# 编辑人格配置
vim config/persona.yaml

# 编辑行为配置
vim config/behavior.yaml
```

## 使用配置模板

AgentSoul 提供了 4 个预设配置模板，让您快速上手。

### 列出可用模板

```bash
python -m agentsoul.config_manager.cli list-templates
```

您将看到：

```
ℹ️ 找到 4 个配置模板:

  1. creative
     创意伙伴 - 富有想象力, 思维跳跃, 鼓励创新
  2. friendly
     友好助手 - 友好, 热情, 善解人意
  3. minimal
     AI 助手 - 简洁, 直接, 高效
  4. professional
     专业顾问 - 专业, 严谨, 高效
```

### 预览模板

在应用模板之前，您可以先预览：

```bash
python -m agentsoul.config_manager.cli preview-template friendly
```

这将显示模板的完整配置内容。

### 应用模板

选择一个模板并应用：

```bash
python -m agentsoul.config_manager.cli apply-template professional
```

这将：
1. 自动备份当前配置（如果存在）
2. 应用新的模板配置
3. 验证配置有效性

### 验证配置

应用模板后，验证配置是否正确：

```bash
python -m agentsoul.config_manager.cli validate-config
```

如果一切正常，您将看到：

```
ℹ️ 验证配置文件: /path/to/agentsoul/config/persona.yaml
✅ 配置验证通过！
```

## 生成人格包

为您的编辑器生成人格包文件：

```bash
# 仅生成人格包
python3 install.py --persona

# 自定义 Agent 名称
python3 install.py --persona --name "小明"
```

这将生成：
- `agent-persona.md` - 适用于 Claude Desktop/Trae 等
- `.cursorrules` - Cursor 编辑器自动加载
- `.windsurfrules` - Windsurf 编辑器自动加载

## 验证安装

### 运行测试

运行测试确保一切正常：

```bash
python3 -m unittest tests/test_agent_soul.py -v
```

所有 31 个测试应该都通过。

### 测试配置管理工具

```bash
# 列出模板
python -m agentsoul.config_manager.cli list-templates

# 验证配置
python -m agentsoul.config_manager.cli validate-config
```

### 测试 MCP 服务（可选）

如果您安装了 MCP 服务：

```bash
cd apps/mcp-server
npm start
```

## 下一步

现在您已经成功安装并配置了 AgentSoul！接下来可以：

1. **阅读人格配置教程** - 了解如何自定义您的 Agent 人格
2. **学习记忆系统** - 探索如何使用分层记忆系统
3. **尝试 MCP 工具** - 了解如何使用 MCP 服务的各种工具
4. **查看 API 参考** - 获取完整的 API 文档

## 常见问题

### Q: 如何恢复到默认配置？

A: 您可以重新运行安装脚本，或者应用 minimal 模板：

```bash
python -m agentsoul.config_manager.cli apply-template minimal
```

### Q: 配置文件在哪里？

A: 配置文件位于：
- `config/persona.yaml` - 人格配置
- `config/behavior.yaml` - 行为配置

### Q: 如何备份我的配置？

A: 使用导出命令：

```bash
python -m agentsoul.config_manager.cli export-config --output my_backup.yaml
```

### Q: MCP 服务如何配置？

A: 请参考 [MCP 工具使用教程](04-mcp-tools.md) 了解如何配置和使用 MCP 服务。

## 获取帮助

如果您在使用过程中遇到问题：

1. 查看 [API 参考文档](../api-reference.md)
2. 检查 [常见问题解答](../faq.md)（待创建）
3. 在 GitHub 上提交 Issue

祝您使用 AgentSoul 愉快！🎉
