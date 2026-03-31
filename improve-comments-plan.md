# 代码注释改进计划 - 为英文代码添加中文注释

## 目标
提高代码可读性，让中文开发者更容易理解 AgentSoul MCP 服务代码逻辑。
为所有 TypeScript 代码中的英文代码结构、函数、类型添加中文注释说明。

---

## 需要处理的文件清单

### 入口文件
- [ ] `mcp_server/src/index.ts` - MCP 服务器主入口，工具注册和请求处理

### 工具模块 (`mcp_server/src/tools/`)
- [ ] `mcp_server/src/tools/soul.ts` - 人格和灵魂状态相关工具
- [ ] `mcp_server/src/tools/memory.ts` - 分层记忆读写工具
- [x] `mcp_server/src/tools/core-memory.ts` - 核心记忆工具
- [ ] `mcp_server/src/tools/entity-memory.ts` - 实体记忆工具
- [ ] `mcp_server/src/tools/kv-cache.ts` - 三级缓存工具
- [ ] `mcp_server/src/tools/soul-board.ts` - 项目看板工具

### 核心库 (`mcp_server/src/lib/`)
- [ ] `mcp_server/src/lib/paths.ts` - 路径管理器
- [ ] `mcp_server/src/lib/config.ts` - 配置加载
- [ ] `mcp_server/src/lib/config.default.ts` - 默认配置
- [ ] `mcp_server/src/lib/utils.ts` - 工具函数
- [ ] `mcp_server/src/lib/storage.ts` - 存储工具（被 soul.ts 使用）
- [ ] `mcp_server/src/lib/core-memory.ts` - 核心记忆引擎
- [ ] `mcp_server/src/lib/entity-memory.ts` - 实体记忆引擎
- [ ] `mcp_server/src/lib/soul-engine.ts` - 灵魂引擎
- [ ] `mcp_server/src/lib/agent-registry.ts` - Agent 注册表
- [ ] `mcp_server/src/lib/context.ts` - 上下文管理
- [ ] `mcp_server/src/lib/intercom-log.ts` - 日志模块

### KV-Cache 子模块 (`mcp_server/src/lib/kv-cache/`)
- [ ] `mcp_server/src/lib/kv-cache/index.ts` - KV-Cache 入口
- [ ] `mcp_server/src/lib/kv-cache/schema.ts` - 数据结构定义
- [ ] `mcp_server/src/lib/kv-cache/tier-manager.ts` - 层级管理器
- [ ] `mcp_server/src/lib/kv-cache/sqlite-store.ts` - SQLite 存储
- [ ] `mcp_server/src/lib/kv-cache/compressor.ts` - 压缩器
- [ ] `mcp_server/src/lib/kv-cache/embedding.ts` - 向量嵌入引擎
- [ ] `mcp_server/src/lib/kv-cache/token-saver.ts` - Token 修剪器
- [ ] `mcp_server/src/lib/kv-cache/snapshot.ts` - 快照管理
- [ ] `mcp_server/src/lib/kv-cache/backup.ts` - 备份功能

### 类型定义
- [ ] `mcp_server/src/types.ts` - 全局类型定义

### Python 安装脚本
- [ ] `install.py` - 安装向导（已经是中文注释，检查一致性）

### Python 源文件 (`src/`)
- [ ] `src/config_loader.py` - 配置加载器
- [ ] `src/path_compat.py` - 路径兼容性工具
- [ ] `src/openclaw_installer.py` - OpenClaw 安装器

---

## 注释规范

### 1. 文件头部
每个文件开头添加：
```typescript
/**
 * @fileoverview 简要说明这个文件的作用
 * @description 更详细的描述（如果需要）
 */
```

### 2. 函数/方法
每个函数上方添加：
```typescript
/**
 * 函数功能的中文描述
 * @param 参数名 - 参数说明
 * @returns 返回值说明
 */
```

### 3. 类型/接口
每个类型定义添加：
```typescript
/** 类型说明 */
interface TypeName {
  /** 字段说明 */
  field: Type;
}
```

### 4. 常量/配置
重要常量添加行注释说明用途。

### 5. 复杂逻辑
复杂算法、条件判断添加中文注释说明思路。

---

## 不修改内容
- **不修改** 功能代码逻辑，只添加注释
- **不修改** 字符串文本内容（错误消息等保持原样）
- **不修改** 变量/函数名称，只增加说明
- **规则 Markdown 文件** (`src/*.md`) 已经是中文，不需要修改

---

## 检查清单完成后
- [ ] 运行 `npm run build` 确认编译通过
- [ ] 运行 MCP 测试启动确认功能正常
- [ ] 运行 Python 安装脚本确认功能正常
