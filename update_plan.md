# 给下次迭代的战略信

## 当前阶段评估与最薄弱环节

- 当前健康度保持 **100**，全量测试 **638/638** 通过。
- 本轮熵注入探索完成：定义了跨检查器统一健康摘要 schema，companionship_checker 已迁移到新标准，输出格式向后兼容。
- 最薄弱环节：统一 schema 已定义但尚未推广到 health_check 和 entry_detect；可以在下次迭代继续深化，让所有 CLI 检查器都能输出统一格式。

## 圆内任务模板（本轮落地记录）

- Master Agent 能力：技能沉淀 / 状态延续
- 工具入口：通用底座（CLI 自动化）
- 闭环结果：定义统一摘要 schema 供 companionship_checker、health_check、entry_detect 使用，所有检查器输出一致机器可读格式
- 陪伴增益：自动化工具链可以统一解析任何检查器的输出，提升跨入口自动化质量闸门可靠性
- 最小验证：定义 base dataclass、更新 companionship_checker 使用统一 schema、全量回归通过

## 必做项（本次遗留 + 卡死项追踪）

- 继续将统一健康摘要 schema 应用到 `health_check.py`，添加 `--summary-json` 支持。
- 将统一健康摘要 schema 应用到 `entry_detect.py`（可选，如果适合）。
- 评估 Python 3.9.6 与项目要求 `>=3.10` 的差异风险，给出迁移窗口建议。

## 二选一战略方向（下次按健康度择一）

### A 偏稳定

- 完成统一 schema 推广：为 `health_check` 添加 `--summary-json` 输出统一格式。
- 补充 CLI 参数异常路径测试保证输出语义一致性。

### B 偏破局

- 为 `health_check` 添加 `--min-score` 门控支持，复用统一 schema 和门控逻辑，让健康检查也能在 CI 中作为质量闸门。

## 功能候选 3 项（2 深化 + 1 探索）

1. 历史功能深化：为 `health_check.py` 增补 `--summary-json` 统一摘要输出。
2. 历史功能深化：研究 `health_check.py` 是否适合添加 `--min-score` 门控，如果适合则实现。
3. 新功能探索（自动升级探索候选）：为统一健康摘要添加 JSON schema 验证文件，便于外部工具消费。

## 本次踩坑与陷阱警告

- Python 模块导入路径需要正确对应项目结构，`src.common` 才能被正确找到。
- 新增公共模块需要添加 `__init__.py` 才能被包导入。
- 导出公共符号需要更新顶层 `src/__init__.py` 的 `__all__` 列表。

## 本次是否熵注入

- 本次迭代 105 是 3 的倍数，已触发熵注入。
- 结论：统一摘要 schema 探索成功，价值明确，可以继续功能深化推广到其他检查器。
