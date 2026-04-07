# 给下次迭代的战略信

## 当前阶段评估

- 当前健康度 **100**，处于极佳稳定状态
- 迭代 83，连续 80 轮迭代健康度保持 100
- 所有 566 个测试 100% 通过，MCP 编译成功
- ruff 检查完全通过无警告，mypy --strict 零错误通过
- **完成本轮：**
  - 完善 MCP 订阅推送机制，补齐缺失的导出和工具注册
  - MCP 订阅推送机制现在完整可用：subscribe/unsubscribe/list_subscriptions 三个工具都可以正常访问
  - 支持 Webhook 事件推送：memory_written / memory_archived / soul_state_updated / persona_updated
  - 自动失败计数，达到 max_failures 自动取消订阅，支持可配置超时和密钥

## 必做项

- 无遗留卡死项
- 保持项目健康度 100
- 现在几乎所有核心模块覆盖率都超过 85%，只剩下极少数低覆盖率模块：
  - `src/abstract.py` 74%（抽象基类，抽象方法无实现，覆盖率低正常）
  - `src/path_compat.py` 75% 覆盖率（主要是 Windows 兼容性代码，在 macOS 上无法测试）
  - `src/adapters/openai.py` 89% 还剩 16 行，`src/adapters/gemini.py` 96% 还剩 7 行，都是极少数边界

## 下次战略选择

### A 偏稳定
- 等待 GitHub CI 运行验证完整配置（pre-commit + mypy strict + subscription tools）
- 如果 CI 报告任何错误，修复相应问题
- 持续监控依赖更新，及时补丁
- 保持健康度 100

### B 偏破局
- 跨平台灵魂迁移：完善 OpenAI / Claude 两端数据映射、冲突处理、迁移校验和失败回滚闭环
- Web UI 历史功能深化：围绕记忆查看继续补齐真实使用链路
- 验证订阅推送机制完整功能，补充如果有缺失的可观测性

## 功能候选池

1. **跨平台灵魂迁移端到端闭环完善**
2. **Web UI 功能持续深化（导出/导入优化）**
3. **验证 MCP 订阅推送机制完整功能**
4. **检查并清理任何新发现的代码质量问题**
5. **等待 GitHub CI 验证所有新配置**

## 本次踩坑警告

- 在嵌套目录 (`mcp_server`) 执行命令时要注意当前工作目录，cd 后忘记返回会导致找不到测试文件
- 生成覆盖率时必须从项目根目录运行 pytest
- pre-commit 配置需要添加 `.pre-commit-cache/` 到 `.gitignore`
- mypy `--strict` 模式已经包含了所有严格选项，不需要重复列出，直接启用 `strict = true` 即可
- MCP 工具实现后必须同时：1) 在 `tools/index.ts` 导出，2) 在 `index.ts` 的 `ALL_TOOLS` 数组注册，否则工具不会被 MCP 发现

## 阶段结论

本次迭代（正常功能深化）：
- 健康度保持 100 连续 80 轮
- 完成 MCP 订阅推送机制完善，补齐了缺失的导出和工具注册
- 现在订阅推送机制完整可用，可以推送给外部 Webhook 各种 AgentSoul 事件
- 所有 566 个单元测试全部通过
- MCP 服务器编译成功
- 无 TODO/FIXME/HACK 遗留
- 项目持续保持完全稳定可发布状态
