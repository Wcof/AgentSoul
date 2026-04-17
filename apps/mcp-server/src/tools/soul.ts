/**
 * @fileoverview 人格和灵魂状态相关工具
 * @description 该模块处理人格配置和 PAD 情感状态的管理，包括获取人格配置、获取和更新灵魂状态、获取基础规则文档以及获取 MCP 使用指南
 */

import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ErrorCode, McpError } from '@modelcontextprotocol/sdk/types.js';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';
import { readFile } from '../lib/utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import { getLanguageResources, LanguageResources, CategoryIndex, ToolIndexEntry } from '../language/index.js';
import { triggerEvent } from './subscription.js';

const storage = new StorageManager();

/**
 * Static mapping from tool name to category - this is configuration metadata that doesn't change per-language
 */
const TOOL_TO_CATEGORY: Record<string, string> = {
  get_persona_config: 'soul',
  write_persona_config: 'soul',
  get_soul_state: 'soul',
  update_soul_state: 'soul',
  health_check: 'soul',
  get_growth_curve: 'soul',
  get_base_rules: 'soul',
  get_mcp_usage_guide: 'soul',
  mcp_tool_index: 'soul',
  read_memory_day: 'memory',
  write_memory_day: 'memory',
  read_memory_week: 'memory',
  write_memory_week: 'memory',
  read_memory_month: 'memory',
  write_memory_month: 'memory',
  read_memory_year: 'memory',
  write_memory_year: 'memory',
  read_memory_topic: 'memory',
  write_memory_topic: 'memory',
  list_memory_topics: 'memory',
  archive_memory_topic: 'memory',
  core_memory_read: 'core_memory',
  core_memory_write: 'core_memory',
  core_memory_delete: 'core_memory',
  core_memory_list: 'core_memory',
  entity_upsert: 'entity_memory',
  entity_get: 'entity_memory',
  entity_search: 'entity_memory',
  entity_list: 'entity_memory',
  entity_delete: 'entity_memory',
  entity_prune: 'entity_memory',
  entity_fact_add: 'entity_memory',
  entity_fact_invalidate: 'entity_memory',
  verbatim_add: 'memory',
  verbatim_get: 'memory',
  verbatim_search: 'memory',
  verbatim_delete: 'memory',
  kv_cache_save: 'kv_cache',
  kv_cache_load: 'kv_cache',
  kv_cache_search: 'kv_cache',
  kv_cache_list: 'kv_cache',
  kv_cache_gc: 'kv_cache',
  kv_cache_backend_info: 'kv_cache',
  board_read: 'soul_board',
  board_update_summary: 'soul_board',
  board_add_decision: 'soul_board',
  board_add_labels: 'soul_board',
  board_remove_labels: 'soul_board',
  board_list_labels: 'soul_board',
  board_search_decisions: 'soul_board',
  board_claim_file: 'soul_board',
  board_release_file: 'soul_board',
  board_set_active_work: 'soul_board',
  ledger_list: 'soul_board',
  ledger_read: 'soul_board',
  subscribe: 'subscription',
  unsubscribe: 'subscription',
  list_subscriptions: 'subscription',
  get_persona_version: 'soul',
  list_soul_versions: 'soul',
  rollback_soul: 'soul',
  get_health_history: 'soul',
};

/**
 * Cached built tool index - since language resources don't change at runtime,
 * we only need to build this once after language initialization.
 */
let cachedToolIndex: CategoryIndex[] | null = null;

/** 获取人格配置的输入参数 Schema */
export const GetPersonaConfigSchema = z.object({});

/**
 * 获取人格配置
 * @returns 包含人格配置的工具响应
 */
export async function handleGetPersonaConfig(): Promise<ToolResponse> {
  const config = storage.readPersonaConfig();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(config),
      },
    ],
  };
}

/** 获取当前灵魂状态（PAD 向量）的输入参数 Schema */
export const GetSoulStateSchema = z.object({});

/**
 * 获取当前灵魂状态（PAD 向量）
 * @returns 包含当前灵魂状态的工具响应
 */
export async function handleGetSoulState(): Promise<ToolResponse> {
  const state = storage.readSoulState();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(state),
      },
    ],
  };
}

/** 更新灵魂状态的输入参数 Schema */
export const UpdateSoulStateSchema = z.object({
  /** 愉悦度 (-1 到 +1) */
  pleasure: z.number().min(-1).max(1).optional(),
  /** 唤醒度 (-1 到 +1) */
  arousal: z.number().min(-1).max(1).optional(),
  /** 支配度 (-1 到 +1) */
  dominance: z.number().min(-1).max(1).optional(),
  /** 触发原因 */
  trigger: z.string().optional(),
}).refine(
  data => {
    // At least one field must be provided for an update
    return data.pleasure !== undefined ||
           data.arousal !== undefined ||
           data.dominance !== undefined ||
           data.trigger !== undefined;
  },
  {
    message: "At least one field (pleasure, arousal, dominance, or trigger) must be provided for update",
  }
);

/**
 * 更新灵魂状态
 * @param params - 更新参数，包含可选的 PAD 值和触发原因
 * @returns 包含更新结果的工具响应
 */
export async function handleUpdateSoulState(
  params: z.infer<typeof UpdateSoulStateSchema>
): Promise<ToolResponse> {
  const current = storage.readSoulState();
  const timestamp = new Date().toISOString();

  // 创建包含更新值的新状态
  const newState = {
    ...current,
    pleasure: params.pleasure ?? current.pleasure,
    arousal: params.arousal ?? current.arousal,
    dominance: params.dominance ?? current.dominance,
    last_updated: timestamp,
  };

  // 添加到历史记录
  newState.history = [
    ...current.history,
    {
      pleasure: newState.pleasure,
      arousal: newState.arousal,
      dominance: newState.dominance,
      timestamp,
      trigger: params.trigger,
    },
  ];

  // 只保留最近 100 条历史记录
  if (newState.history.length > 100) {
    newState.history = newState.history.slice(-100);
  }

  const success = storage.writeSoulState(newState);

  if (!success) {
    throw new McpError(ErrorCode.InternalError, 'Failed to write soul state to disk');
  }

  triggerEvent('soul_state_updated', {
    pleasure: newState.pleasure,
    arousal: newState.arousal,
    dominance: newState.dominance,
    trigger: params.trigger,
    timestamp,
  });

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success: true,
          new_state: newState,
        }),
      },
    ],
  };
}

/** 获取基础规则文档的输入参数 Schema */
export const GetBaseRulesSchema = z.object({
  /** 规则文件名称 */
  name: z.enum([
    'SKILL',
    'soul_base',
    'memory_base',
    'master_base',
    'secure_base',
    'skills_base',
    'tasks_base',
  ]),
});

/**
 * 获取基础规则文档
 * @param params - 参数，包含要获取的规则文件名称
 * @returns 包含规则文档内容的工具响应
 */
export async function handleGetBaseRules(
  params: z.infer<typeof GetBaseRulesSchema>
): Promise<ToolResponse> {
  const filename = `${params.name}.md`;
  const content = storage.readBaseRule(filename);

  if (content === null) {
    throw new McpError(ErrorCode.InvalidRequest, `Rule file ${filename} not found`);
  }

  // 安全检查：Level 3 (SEALED) 内容不能输出
  if (params.name === 'secure_base') {
    return {
      content: [
        {
          type: 'text',
          text: 'secure_base.md contains security protocol that is PROTECTED level and cannot be output directly. The rules are applied internally only.',
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: content,
      },
    ],
  };
}

/** 获取 MCP 使用指南的输入参数 Schema */
export const GetMcpUsageGuideSchema = z.object({});

/** 获取 MCP 工具索引的输入参数 Schema */
export const McpToolIndexSchema = z.object({
  /** 可选按分类过滤工具 (soul, memory, core_memory, entity_memory, kv_cache, soul_board, all) */
  category: z.enum(['soul', 'memory', 'core_memory', 'entity_memory', 'kv_cache', 'soul_board', 'all']).optional(),
  /** 可选查询单个特定工具 (精确名称) */
  tool: z.string().optional(),
});

/**
 * 获取 MCP 使用指南（供其他 AI Agent 理解如何使用 AgentSoul MCP）
 * @returns 包含使用指南的工具响应
 */
export async function handleGetMcpUsageGuide(): Promise<ToolResponse> {
  const lang = getLanguageResources();
  return {
    content: [
      {
        type: 'text',
        text: lang.usage_guide,
      },
    ],
  };
}

/**
 * 从加载的语言资源构建工具索引结构
 * Optimized: single pass over tools O(T) instead of nested O(C*T)
 */
function buildToolIndex(lang: LanguageResources): CategoryIndex[] {
  // Group tools by category first - single pass over all tools
  const toolsByCategory = new Map<string, ToolIndexEntry[]>();

  // Initialize empty arrays for all categories
  for (const categoryKey of Object.keys(lang.categories)) {
    toolsByCategory.set(categoryKey, []);
  }

  // Add each tool to its category - one pass through all tools
  for (const [toolName, toolData] of Object.entries(lang.tool_index)) {
    const categoryKey = TOOL_TO_CATEGORY[toolName];
    const categoryTools = toolsByCategory.get(categoryKey);
    if (categoryTools) {
      categoryTools.push({
        name: toolName,
        description: toolData.description,
        parameters: toolData.parameters,
        whenToUse: toolData.whenToUse,
        required: toolData.required,
        example: toolData.example,
      });
    }
  }

  // Build the final result
  const result: CategoryIndex[] = [];
  for (const [categoryKey, categoryDesc] of Object.entries(lang.categories)) {
    result.push({
      category: categoryKey,
      description: categoryDesc,
      tools: toolsByCategory.get(categoryKey) || [],
    });
  }

  return result;
}

/**
 * Get MCP Tool Index - returns complete index of all available tools with detailed usage information
 * @description This tool is for agent research: when you need to understand what tools are available,
 *              their parameters, and when to use them, call this tool.
 *              It is NOT required on every conversation startup - only call when you need to research.
 * @param params - Filter parameters (optional category filter, optional specific tool query)
 * @returns Complete tool index with usage information
 */
export async function handleMcpToolIndex(
  params: z.infer<typeof McpToolIndexSchema>
): Promise<ToolResponse> {
  const lang = getLanguageResources();
  let toolIndex: CategoryIndex[];
  if (cachedToolIndex !== null) {
    toolIndex = cachedToolIndex;
  } else {
    toolIndex = buildToolIndex(lang);
    cachedToolIndex = toolIndex;
  }
  let filteredIndex = toolIndex;

  // Filter by category if specified
  if (params.category && params.category !== 'all') {
    filteredIndex = toolIndex.filter(cat => cat.category === params.category);
  }

  // If specific tool requested, find just that tool
  if (params.tool) {
    const toolName = params.tool;
    let foundTool: ToolIndexEntry | null = null;
    let foundCategory: CategoryIndex | null = null;

    for (const cat of filteredIndex as CategoryIndex[]) {
      const match = cat.tools.find(t => t.name === toolName);
      if (match) {
        foundTool = match;
        foundCategory = cat;
        break;
      }
    }

    if (foundTool && foundCategory) {
      const messages = lang.tool_index_messages;
      const output = {
        purpose: messages.specific_tool_purpose.replace('%s', toolName),
        importantInstruction: `
# ${messages.specific_tool_header.replace('%s', toolName)}

${messages.specific_tool_intro}

${messages.specific_tool_payattention}
`,
        found: true,
        category: foundCategory.category,
        categoryDescription: foundCategory.description,
        tool: foundTool,
        usage: `
${messages.specific_tool_usage.replace('%s', foundTool.name)}
`,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    } else {
      // Tool not found - return helpful error with suggestions
      const messages = lang.tool_index_messages;
      const output = {
        found: false,
        requestedTool: toolName,
        message: messages.tool_not_found.replace('%s', toolName),
        availableCategories: filteredIndex.map((c: any) => c.category),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    }
  }

  // Return full filtered index
  const messages = lang.tool_index_messages;
  const output = {
    purpose: messages.purpose,
    importantInstruction: messages.important_instruction,
    howToCall: messages.how_to_call,
    totalTools: filteredIndex.reduce((sum, cat) => sum + cat.tools.length, 0),
    index: filteredIndex,
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(output, null, 2),
      },
    ],
  };
}


/** 获取灵魂状态版本列表的参数Schema */
export const ListSoulVersionsSchema = z.object({});

/**
 * 获取灵魂状态版本历史列表
 * @returns 可用版本列表
 */
export async function handleListSoulVersions(): Promise<ToolResponse> {
  const versions = storage.listSoulStateVersions();
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        count: versions.length,
        versions,
      }, null, 2),
    }],
  };
}

/** 回滚灵魂状态到指定版本的参数Schema */
export const RollbackSoulSchema = z.object({
  /** 目标版本标识 */
  version: z.string(),
});

/**
 * 回滚灵魂状态到指定版本
 * @param params 参数，包含目标版本
 * @returns 回滚结果
 */
export async function handleRollbackSoul(
  params: z.infer<typeof RollbackSoulSchema>
): Promise<ToolResponse> {
  const success = storage.rollbackSoulState(params.version);
  if (!success) {
    throw new McpError(ErrorCode.InvalidRequest, `Failed to rollback to version ${params.version}`);
  }
  const current = storage.readSoulState();
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        current_state: current,
      }, null, 2),
    }],
  };
}

/** 获取人格版本信息的参数Schema */
export const GetPersonaVersionSchema = z.object({});

/**
 * 获取当前人格配置的版本信息
 * @returns 版本信息，包含版本号、时间戳和校验和
 */
export async function handleGetPersonaVersion(): Promise<ToolResponse> {
  const version = storage.getPersonaVersion();
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(version, null, 2),
    }],
  };
}

/** 写入人格配置的输入参数Schema */
export const WritePersonaConfigSchema = z.object({
  /** AI 代理配置 */
  ai: z.object({
    /** Agent 名称 */
    name: z.string(),
    /** Agent 昵称 */
    nickname: z.string(),
    /** 命名模式 */
    naming_mode: z.string(),
    /** 角色描述 */
    role: z.string(),
    /** 个性特征列表 */
    personality: z.array(z.string()),
    /** 核心价值观列表 */
    core_values: z.array(z.string()),
    /** 交互风格 */
    interaction_style: z.record(z.string(), z.any()),
  }),
  /** 主人（用户）配置 */
  master: z.object({
    /** 用户名称 */
    name: z.string(),
    /** 用户昵称列表 */
    nickname: z.array(z.string()),
    /** 用户时区 */
    timezone: z.string(),
    /** 用户标签/兴趣列表 */
    labels: z.array(z.string()),
  }),
});

/**
 * 写入人格配置
 * @param params - 完整的人格配置
 * @returns 写入结果
 */
export async function handleWritePersonaConfig(
  params: z.infer<typeof WritePersonaConfigSchema>
): Promise<ToolResponse> {
  const success = storage.writePersonaConfig(params);

  if (!success) {
    throw new McpError(ErrorCode.InternalError, 'Failed to write persona config to disk');
  }

  const timestamp = new Date().toISOString();
  triggerEvent('persona_updated', {
    config: params,
    timestamp,
  });

  const version = storage.getPersonaVersion();
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        version,
      }, null, 2),
    }],
  };
}

/** 获取灵魂成长曲线数据的输入参数Schema */
export const GetGrowthCurveSchema = z.object({});

/** 获取健康度历史记录的输入参数Schema */
export const GetHealthHistorySchema = z.object({
  /** 获取最近多少条记录，默认 20 */
  limit: z.number().int().min(1).max(100).optional(),
});

/** 健康检查的输入参数Schema */
export const HealthCheckSchema = z.object({
  /** 是否包含记忆文件抽样检查 */
  include_memory_samples: z.boolean().optional(),
});

/** 健康检查结果接口 */
interface HealthIssue {
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  location?: string;
  fix_suggestion?: string;
}

/** 健康检查报告接口 */
interface HealthReport {
  timestamp: string;
  total_checks: number;
  errors: number;
  warnings: number;
  issues: HealthIssue[];
  is_healthy: boolean;
  soul_version: string | null;
}

/**
 * 运行完整的灵魂健康检查
 * @param params - 检查参数
 * @returns 健康检查报告
 */
export async function handleHealthCheck(
  params: z.infer<typeof HealthCheckSchema>
): Promise<ToolResponse> {
  const includeMemorySamples = params.include_memory_samples ?? true;
  const report = storage.runHealthCheck(includeMemorySamples);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(report, null, 2),
    }],
  };
}

/**
 * 获取灵魂成长曲线历史数据
 * @returns PAD 情感状态历史记录数组，用于生成趋势可视化
 */
export async function handleGetGrowthCurve(): Promise<ToolResponse> {
  const state = storage.readSoulState();

  // 计算统计数据
  const history = state.history || [];

  const stats = {
    total_records: history.length,
    earliest_timestamp: history.length > 0 ? history[0].timestamp : null,
    latest_timestamp: history.length > 0 ? history[history.length - 1].timestamp : null,
    current: {
      pleasure: state.pleasure,
      arousal: state.arousal,
      dominance: state.dominance,
    },
    history: history,
  };

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        data: stats,
      }, null, 2),
    }],
  };
}

/**
 * 健康历史记录条目接口
 */
interface HealthHistoryEntry {
  timestamp: string;
  iteration: number;
  health: number;
  pass_rate: number;
  mode: string;
  description: string;
}

/**
 * 获取项目迭代健康度历史记录
 * @param params 查询参数（可选 limit）
 * @returns 解析后的健康度历史记录数组
 */
export async function handleGetHealthHistory(
  params: z.infer<typeof GetHealthHistorySchema>
): Promise<ToolResponse> {
  const limit = params.limit ?? 20;
  const modernPath = path.join(PROJECT_ROOT, 'docs', 'auto-upgrade', '.soul_health.md');
  const legacyPath = path.join(PROJECT_ROOT, '.soul_health.md');
  const healthPath = fs.existsSync(modernPath) ? modernPath : legacyPath;

  if (!fs.existsSync(healthPath)) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: [],
          total_records: 0,
          message: 'No health history file found',
        }, null, 2),
      }],
    };
  }

  const content = readFile(healthPath);
  if (content === null) {
    throw new McpError(ErrorCode.InternalError, 'Failed to read health history file');
  }

  const lines = content.trim().split('\n').filter(line => line.trim().length > 0);
  const entries: HealthHistoryEntry[] = [];

  // Parse each line - format: [timestamp] | iteration[N] | 健康度:[score] | 通过率:[rate] | 模式:[mode] | [description]
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Extract parts between | separators
    const parts = trimmed.split('|').map(p => p.replace(/^\[|\]$/g, '').trim());
    if (parts.length >= 6) {
      const timestamp = parts[0];
      const iterationMatch = parts[1].match(/迭代\s*\[?(\d+)\]?/);
      const healthMatch = parts[2].match(/健康度\s*\[?(\d+)\]?/);
      const rateMatch = parts[3].match(/通过率\s*\[?(\d+)%\]?/);
      const modeMatch = parts[4].match(/\s*模式:\s*\[?([^\]]+)\]?/);

      const entry: HealthHistoryEntry = {
        timestamp: timestamp,
        iteration: iterationMatch ? parseInt(iterationMatch[1], 10) : 0,
        health: healthMatch ? parseInt(healthMatch[1], 10) : 0,
        pass_rate: rateMatch ? parseInt(rateMatch[1], 10) : 0,
        mode: modeMatch ? modeMatch[1].trim() : parts[4].trim(),
        description: parts.slice(5).join('|').trim(),
      };
      entries.push(entry);
    }
  }

  // Sort by iteration ascending, then take last N
  entries.sort((a, b) => a.iteration - b.iteration);
  const recent = entries.slice(-limit);

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        total_records: entries.length,
        returned_records: recent.length,
        data: recent,
      }, null, 2),
    }],
  };
}
