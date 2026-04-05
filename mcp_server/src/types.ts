/**
 * @fileoverview AgentSoul MCP 全局类型定义
 * @description 定义了 AgentSoul 系统中使用的所有数据类型、接口和配置结构
 */

/** 实体类型：人、硬件、项目、概念、地点、服务 */
export type EntityType = 'person' | 'hardware' | 'project' | 'concept' | 'place' | 'service';

/** 快照层级：热数据、温数据、冷数据 */
export type SnapshotTier = 'hot' | 'warm' | 'cold';

/** 灵魂看板：项目的核心协作看板 */
export interface SoulBoard {
  /** 项目名称 */
  project: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 最后更新者 */
  updatedBy: string | null;
  /** 看板状态 */
  state: BoardState;
  /** 活跃工作项 */
  activeWork: Record<string, ActiveWork | null>;
  /** 文件所有权记录 */
  fileOwnership: Record<string, FileOwnership>;
  /** 决策记录 */
  decisions: BoardDecision[];
  /** 交接信息 */
  handoff: Handoff;
  /** 最后一个任务账本 ID */
  lastLedger: string | null;
}

/** 看板状态 */
export interface BoardState {
  /** 项目摘要 */
  summary: string;
  /** 版本号 */
  version: string;
  /** 健康状态 */
  health: 'unknown' | 'healthy' | 'degraded' | 'critical';
}

/** 活跃工作项 */
export interface ActiveWork {
  /** 任务描述 */
  task: string;
  /** 开始时间 */
  since: string;
  /** 涉及的文件列表 */
  files: string[];
}

/** 文件所有权 */
export interface FileOwnership {
  /** 所有者 */
  owner: string | null;
  /** 获得所有权的时间 */
  since?: string;
  /** 处理意图 */
  intent?: string;
}

/** 交接信息 */
export interface Handoff {
  /** 交接来源 */
  from: string | null;
  /** 交接摘要 */
  summary: string;
  /** 待办事项 */
  todo: string[];
  /** 阻塞项 */
  blockers: string[];
}

/** 看板决策记录 */
export interface BoardDecision {
  /** 决策日期 */
  date: string;
  /** 决策者 */
  by: string;
  /** 决策内容 */
  what: string;
  /** 决策原因 */
  why: string;
}

/** 账本条目：记录一个 Agent 的工作会话 */
export interface LedgerEntry {
  /** 唯一 ID */
  id: string;
  /** Agent 名称 */
  agent: string;
  /** 开始时间 */
  startedAt: string;
  /** 完成时间 */
  completedAt: string;
  /** 标题 */
  title: string;
  /** 创建的文件 */
  filesCreated: FileChange[];
  /** 修改的文件 */
  filesModified: FileChange[];
  /** 删除的文件 */
  filesDeleted: FileChange[];
  /** 做出的决策 */
  decisions: string[];
  /** 工作总结 */
  summary: string;
}

/** 文件变更记录 */
export interface FileChange {
  /** 文件路径 */
  path: string;
  /** 变更描述 */
  desc: string;
}

/** 文件索引 */
export interface FileIndex {
  /** 最后更新时间 */
  updatedAt: string;
  /** 文件树 */
  tree: Record<string, FileEntry | DirectoryEntry>;
  /** 目录映射 */
  directories?: Record<string, string>;
}

/** 文件条目 */
export interface FileEntry {
  /** 文件描述 */
  desc: string;
  /** 创建时间 */
  created: string;
  /** 修改时间 */
  modified: string;
  /** 状态 */
  status: 'active' | 'archived' | 'deleted';
}

/** 目录条目 */
export interface DirectoryEntry {
  /** 目录描述 */
  desc: string;
  /** 子项 */
  children: Record<string, FileEntry | DirectoryEntry>;
}

/** 申领结果 */
export interface ClaimResult {
  /** 是否成功 */
  ok: boolean;
  /** 当前所有者 */
  owner?: string;
  /** 处理意图 */
  intent?: string;
}

/** 项目信息 */
export interface ProjectInfo {
  /** 项目名称 */
  name: string;
  /** 最后更新时间 */
  updatedAt: string;
  /** 灵魂看板 */
  board: SoulBoard;
}

/** Token 预算配置 */
export interface TokenBudgetConfig {
  /** 启动上下文 Token 数 */
  bootContext: number;
  /** 搜索结果 Token 数 */
  searchResult: number;
  /** 是否启用渐进式加载 */
  progressiveLoad: boolean;
}

/** 层级配置 */
export interface TierConfig {
  /** 热数据保留天数 */
  hotDays: number;
  /** 温数据保留天数 */
  warmDays: number;
}

/** 向量嵌入配置 */
export interface EmbeddingConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 模型名称 */
  model: string;
  /** 端点 URL */
  endpoint?: string | null;
}

/** 备份配置 */
export interface BackupConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 备份目录 */
  dir?: string | null;
  /** 备份计划 */
  schedule: 'manual' | 'daily' | 'weekly';
  /** 保留备份数量 */
  keepCount: number;
  /** 是否增量备份 */
  incremental: boolean;
}

/** KV 缓存配置 */
export interface KVCacheConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 工作结束时自动保存 */
  autoSaveOnWorkEnd: boolean;
  /** 启动时自动加载 */
  autoLoadOnBoot: boolean;
  /** 存储后端 */
  backend: 'json' | 'sqlite';
  /** 每个项目最大快照数 */
  maxSnapshotsPerProject: number;
  /** 快照最大保留天数 */
  maxSnapshotAgeDays: number;
  /** 压缩目标 */
  compressionTarget: number;
  /** 快照目录 */
  snapshotDir: string | null;
  /** SQLite 目录 */
  sqliteDir: string | null;
  /** Token 预算配置 */
  tokenBudget: TokenBudgetConfig;
  /** 层级配置 */
  tier: TierConfig;
  /** 向量嵌入配置 */
  embedding: EmbeddingConfig;
  /** 备份配置 */
  backup: BackupConfig;
  /** 性能警告阈值（毫秒） */
  perfSlowMs?: number;
  /** 性能严重警告阈值（毫秒） */
  perfCriticalMs?: number;
}

/** 灵魂配置 */
export interface SoulConfig {
  /** 灵魂根目录 */
  SOUL_ROOT: string;
  /** 数据目录 */
  DATA_DIR: string;
  /** 时区 */
  TIMEZONE: string;
  /** Agent 目录 */
  AGENTS_DIR: string | null;
  /** 语言 */
  LANG: string;
  /** 搜索配置 */
  SEARCH: SearchConfig;
  /** 文件树配置 */
  FILE_TREE: FileTreeConfig;
  /** 工作配置 */
  WORK: WorkConfig;
  /** KV 缓存配置 */
  KV_CACHE: KVCacheConfig;
}

/** 搜索配置 */
export interface SearchConfig {
  /** 最大搜索深度 */
  maxDepth: number;
  /** 最小关键词长度 */
  minKeywordLength: number;
  /** 预览长度 */
  previewLength: number;
  /** 近期权重 */
  recencyBonus: number;
  /** 默认最大结果数 */
  defaultMaxResults: number;
  /** 是否启用语义搜索 */
  semanticEnabled: boolean;
  /** 语义搜索权重 */
  semanticWeight: number;
}

/** 文件树配置 */
export interface FileTreeConfig {
  /** 隐藏路径列表 */
  hidePaths: string[];
  /** 紧凑路径列表 */
  compactPaths: string[];
  /** 子项显示限制 */
  childLimit: number;
}

/** 工作配置 */
export interface WorkConfig {
  /** 会话 TTL（小时） */
  sessionTtlHours: number;
  /** 最大决策数 */
  maxDecisions: number;
}

/** Agent 配置 */
export interface AgentConfig {
  /** 名称 */
  name: string;
  /** 昵称 */
  nickname: string;
  /** 命名模式 */
  naming_mode: string;
  /** 角色 */
  role: string;
  /** 个性特征 */
  personality: string[];
  /** 核心价值观 */
  core_values: string[];
  /** 交互风格 */
  interaction_style: Record<string, string>;
}

/** 主人配置 */
export interface MasterConfig {
  /** 名称 */
  name: string;
  /** 昵称列表 */
  nickname: string[];
  /** 时区 */
  timezone: string;
  /** 标签 */
  labels: string[];
}

/** 人格配置 */
export interface PersonaConfig {
  /** AI 配置 */
  ai: AgentConfig;
  /** 主人配置 */
  master: MasterConfig;
}

/** 灵魂状态：PAD 情感模型 */
export interface SoulState {
  /** 灵魂版本标记 - for schema migration */
  version?: string;
  /** 愉悦度 */
  pleasure: number;
  /** 唤醒度 */
  arousal: number;
  /** 支配度 */
  dominance: number;
  /** 最后更新时间 */
  last_updated: string | null;
  /** 历史记录 */
  history: SoulStateHistory[];
}

/** 灵魂状态历史记录 */
export interface SoulStateHistory {
  /** 愉悦度 */
  pleasure: number;
  /** 唤醒度 */
  arousal: number;
  /** 支配度 */
  dominance: number;
  /** 时间戳 */
  timestamp: string;
  /** 触发事件 */
  trigger?: string;
}

/** 灵魂版本信息 - 用于版本追踪和回滚 */
export interface SoulVersion {
  /** 版本 */
  version: string;
  /** 时间戳 */
  timestamp: string;
  /** 校验和 */
  checksum?: string;
  /** 描述 */
  description?: string;
}

/** 记忆冲突信息 - 用于冲突检测 */
export interface MemoryConflict {
  /** 冲突主题 */
  topic: string;
  /** 现有内容 */
  existing_content: string;
  /** 新内容 */
  new_content: string;
  /** 冲突类型: "timestamp", "content", "structure" */
  conflict_type: string;
  /** 解决方案 */
  resolution?: string | null;
}

/** 记忆主题 */
export interface MemoryTopic {
  /** 主题名称 */
  name: string;
  /** 创建时间 */
  created: string;
  /** 更新时间 */
  updated: string;
  /** 状态 */
  status: 'active' | 'archived';
  /** 标签 */
  tags: string[];
}

/** 工具响应格式 */
export type ToolResponse = {
  /** 响应内容 */
  content: {
    /** 内容类型 */
    type: 'text';
    /** 文本内容 */
    text: string;
  }[];
};

/** 核心记忆配置 */
export interface CoreMemoryConfig {
  /** 是否启用 */
  enabled: boolean;
}

/** 实体记忆配置 */
export interface EntityMemoryConfig {
  /** 是否启用 */
  enabled: boolean;
  /** 最大实体数量 */
  max_entities: number;
}

/** 订阅事件类型 */
export type SubscriptionEvent =
  | 'memory_written'      // 记忆被写入
  | 'memory_archived'     // 主题被归档
  | 'soul_state_updated'  // 灵魂状态更新
  | 'persona_updated'     // 人格配置更新
  | 'all';                // 所有事件

/** 订阅记录 */
export interface Subscription {
  /** 订阅 ID */
  id: string;
  /** Webhook URL 回调地址 */
  url: string;
  /** 订阅的事件类型 */
  events: SubscriptionEvent[];
  /** 创建时间 */
  createdAt: string;
  /** 最后调用时间 */
  lastCalled: string | null;
  /** 调用失败次数 */
  failureCount: number;
  /** 最大失败次数后自动取消 */
  maxFailures: number;
  /** 可选的密钥用于验证 */
  secret: string | null;
}

/** AgentSoul 总配置 */
export interface AgentSoulConfig {
  /** KV 缓存配置 */
  kv_cache: KVCacheConfig;
  /** 核心记忆配置 */
  core_memory: CoreMemoryConfig;
  /** 实体记忆配置 */
  entity_memory: EntityMemoryConfig;
  /** 订阅推送配置 */
  subscription?: {
    /** 启用推送 */
    enabled: boolean;
    /** 请求超时毫秒 */
    timeoutMs: number;
  };
}
