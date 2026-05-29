# 中英双语策略 / Bilingual Strategy

## 状态

已接受 / Accepted

## 背景 / Context

AgentSoul v2 需要同时服务中文和英文用户。项目代码主要由中文母语开发者维护，但生态工具（TypeScript、React、Tauri）以英文为主。需要在开发效率和用户覆盖之间找到平衡。

## 决策 / Decision

| 层 / Layer | 语言 / Language |
|---|---|
| 变量名、类型名、函数名 / Variable, type, function names | 英文 / English |
| 代码注释 / Code comments | 仅中文 / Chinese only |
| UI 文案（按钮、标签、提示语） / UI copy (buttons, labels, prompts) | 中英 i18n 切换 / i18n switch |
| 文档（CONTEXT.md, ADR, README） / Documentation | 中英双语 / Bilingual |
| 人格配置（persona config） / Persona config | 中英双语字段 / Bilingual fields |

UI 国际化使用 `i18next`，系统 UI 文案和人格对话分开管理：
- 系统 UI：`i18next` 语言包（`zh.json` / `en.json`）
- 人格对话：persona config 中英双语字段驱动，切换人格时对话风格跟着变

## 理由 / Rationale

- 代码英文是行业标准，便于社区协作和工具链兼容
- 注释中文降低维护者理解成本
- UI 双语覆盖最大用户群
- 人格对话和系统 UI 分离，避免换人格时覆盖系统文案

## 后果 / Consequences

- 所有新增代码注释使用中文
- UI 组件通过 `useTranslation()` hook 获取文案
- Persona config schema 增加 `descriptionZh` / `descriptionEn` 等双语字段
