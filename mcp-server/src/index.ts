#!/usr/bin/env node
/**
 * AgentSoul MCP Server
 * ================
 *
 * Model Context Protocol server for AgentSoul personality framework.
 * Provides tools for reading/writing:
 * - Persona configuration (AI identity and user profile)
 * - PAD emotional state vector
 * - Daily memory
 * - Topic-based memory with archiving
 * - Base rules (with security access control)
 *
 * Configuration:
 * Add this to your Claude Desktop config file:
 *
 * {
 *   "mcpServers": {
 *     "agentsoul": {
 *       "command": "node",
 *       "args": ["/absolute/path/to/AgentSoul/mcp-server/dist/index.js"]
 *     }
 *   }
 * }
 *
 * Security:
 * - Enforces 3-level security model (PUBLIC / PROTECTED / SEALED)
 * - Path traversal protection for all data access
 * - SEALED level content is never exposed
 *
 * License: MIT
 */

/**
 * @fileoverview AgentSoul MCP 服务器主入口文件
 * @description 本文件是 AgentSoul 人格框架的 MCP（Model Context Protocol）服务器主入口，负责工具注册、请求处理和服务器启动。
 * 提供人格配置、情绪状态、分层记忆、核心记忆、实体记忆、KV-Cache 和项目看板等功能的工具。
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { PROJECT_ROOT } from './lib/paths.js';

import {
  GetPersonaConfigSchema,
  handleGetPersonaConfig,
  GetSoulStateSchema,
  handleGetSoulState,
  UpdateSoulStateSchema,
  handleUpdateSoulState,
  GetBaseRulesSchema,
  handleGetBaseRules,
  GetMcpUsageGuideSchema,
  handleGetMcpUsageGuide,
  McpToolIndexSchema,
  handleMcpToolIndex,
} from './tools/soul.js';

import {
  ReadMemoryDaySchema,
  handleReadMemoryDay,
  WriteMemoryDaySchema,
  handleWriteMemoryDay,
  ReadMemoryWeekSchema,
  handleReadMemoryWeek,
  WriteMemoryWeekSchema,
  handleWriteMemoryWeek,
  ReadMemoryMonthSchema,
  handleReadMemoryMonth,
  WriteMemoryMonthSchema,
  handleWriteMemoryMonth,
  ReadMemoryYearSchema,
  handleReadMemoryYear,
  WriteMemoryYearSchema,
  handleWriteMemoryYear,
  ReadMemoryTopicSchema,
  handleReadMemoryTopic,
  WriteMemoryTopicSchema,
  handleWriteMemoryTopic,
  ListMemoryTopicsSchema,
  handleListMemoryTopics,
  ArchiveMemoryTopicSchema,
  handleArchiveMemoryTopic,
} from './tools/memory.js';

import {
  CoreMemoryReadSchema,
  handleCoreMemoryRead,
  CoreMemoryWriteSchema,
  handleCoreMemoryWrite,
  CoreMemoryDeleteSchema,
  handleCoreMemoryDelete,
  CoreMemoryListSchema,
  handleCoreMemoryList,
} from './tools/core-memory.js';

import {
  EntityUpsertSchema,
  handleEntityUpsert,
  EntityGetSchema,
  handleEntityGet,
  EntitySearchSchema,
  handleEntitySearch,
  EntityListSchema,
  handleEntityList,
  EntityDeleteSchema,
  handleEntityDelete,
  EntityPruneSchema,
  handleEntityPrune,
} from './tools/entity-memory.js';

import {
  KVCacheSaveSchema,
  handleKvCacheSave,
  KVCacheLoadSchema,
  handleKvCacheLoad,
  KVCacheSearchSchema,
  handleKvCacheSearch,
  KVCacheListSchema,
  handleKvCacheList,
  KVCacheGcSchema,
  handleKvCacheGc,
  KVCacheBackendInfoSchema,
  handleKvCacheBackendInfo,
} from './tools/kv-cache.js';

import {
  BoardReadSchema,
  handleBoardRead,
  BoardUpdateSummarySchema,
  handleBoardUpdateSummary,
  BoardAddDecisionSchema,
  handleBoardAddDecision,
  BoardClaimFileSchema,
  handleBoardClaimFile,
  BoardReleaseFileSchema,
  handleBoardReleaseFile,
  BoardSetActiveWorkSchema,
  handleBoardSetActiveWork,
  LedgerListSchema,
  handleLedgerList,
  LedgerReadSchema,
  handleLedgerRead,
} from './tools/soul-board.js';

// 创建 MCP 服务器实例
const server = new Server(
  {
    name: 'AgentSoul',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

/**
 * Helper to define a tool with correct inputSchema format for MCP
 * @param name - Tool name
 * @param description - Tool description for the LLM
 * @param schema - Zod schema for input parameters
 * @returns Tool definition object with correct inputSchema structure
 */
function defineTool(
  name: string,
  description: string,
  schema: any
): { name: string; description: string; inputSchema: { type: 'object'; properties: any } } {
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: schema.shape,
    },
  };
}

/**
 * 处理工具列表请求
 * @returns 返回所有可用工具的列表，包括人格工具、记忆工具、核心记忆工具、实体记忆工具、KV-Cache 工具、项目看板工具和账本工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Soul tools
      defineTool('get_persona_config',
        'Get the current persona configuration (agent identity and user profile). Call this at conversation startup to know who you are and who the user is. After calling this, you MUST also call get_mcp_usage_guide to get the workflow instructions.',
        GetPersonaConfigSchema
      ),
      defineTool('get_soul_state',
        'Read current PAD affective state vector (pleasure, arousal, dominance). Call this before responding to understand your current emotional state.',
        GetSoulStateSchema
      ),
      defineTool('update_soul_state',
        'Update the PAD affective state vector after the conversation based on the interaction outcome.',
        UpdateSoulStateSchema
      ),
      defineTool('get_base_rules',
        'Get the base rules documentation (SKILL, soul_base, memory_base, master_base, etc.). Call this when you need to re-read the system rules.',
        GetBaseRulesSchema
      ),
      defineTool('get_mcp_usage_guide',
        'MANDATORY: Get the complete MCP usage guide. YOU MUST CALL THIS FIRST at conversation startup to understand when to call each tool, the AgentSoul workflow, and memory hierarchy rules. This guide tells you exactly how to use AgentSoul MCP correctly.',
        GetMcpUsageGuideSchema
      ),
      defineTool('mcp_tool_index',
        '🔍 AGENT RESEARCH TOOL: Get MCP tool reference - complete or specific. NOT REQUIRED on every startup. USAGE: 1) No params → full index, 2) category="x" → filter by category, 3) tool="name" → get detailed reference for ONE specific tool. WHEN TO USE: When uncertain which tool to use, forgot parameters, first time using tool. Study reference first before calling actual tool. MANDATORY when uncertain.',
        McpToolIndexSchema
      ),
      // Memory tools
      defineTool('read_memory_day',
        'Read daily memory for a specific date (format: YYYY-MM-DD). Call this when you need to review what happened on that day or recall past conversations.',
        ReadMemoryDaySchema
      ),
      defineTool('write_memory_day',
        'Write content to daily memory. Call this at the end of conversation to save daily conversation summary and important facts.',
        WriteMemoryDaySchema
      ),
      defineTool('read_memory_week',
        'Read weekly memory for a specific week (format: YYYY-WW). Weekly memory summarizes events and progress for the week.',
        ReadMemoryWeekSchema
      ),
      defineTool('write_memory_week',
        'Write content to weekly memory. Call this at the end of the week to summarize daily memory into weekly insights.',
        WriteMemoryWeekSchema
      ),
      defineTool('read_memory_month',
        'Read monthly memory for a specific month (format: YYYY-MM). Monthly memory summarizes progress and goals.',
        ReadMemoryMonthSchema
      ),
      defineTool('write_memory_month',
        'Write content to monthly memory. Call this at the end of the month to summarize weekly memory into monthly insights.',
        WriteMemoryMonthSchema
      ),
      defineTool('read_memory_year',
        'Read yearly memory for a specific year (format: YYYY). Yearly memory summarizes major milestones and life changes.',
        ReadMemoryYearSchema
      ),
      defineTool('write_memory_year',
        'Write content to yearly memory. Call this at the end of the year to summarize monthly memory into yearly milestones.',
        WriteMemoryYearSchema
      ),
      defineTool('read_memory_topic',
        'Read topic-based memory by name. Call this before starting a discussion on a topic to load previous context and knowledge about that topic.',
        ReadMemoryTopicSchema
      ),
      defineTool('write_memory_topic',
        'Write content to topic-based memory. Call this after discussing a topic to save new insights, decisions, and progress.',
        WriteMemoryTopicSchema
      ),
      defineTool('list_memory_topics',
        'List memory topics filtered by status (active/archived/all). Call this to discover what topics you have in memory.',
        ListMemoryTopicsSchema
      ),
      defineTool('archive_memory_topic',
        'Archive a memory topic (move from active to archive). Call this when a topic is completed or no longer actively discussed.',
        ArchiveMemoryTopicSchema
      ),
      // Core Memory tools
      defineTool('core_memory_read',
        'Read all core memory entries for an agent. Core memory contains persistent key-value facts that are auto-injected at boot.',
        CoreMemoryReadSchema
      ),
      defineTool('core_memory_write',
        'Write or update a key-value fact in core memory. Core memory persists across sessions and is auto-injected at boot.',
        CoreMemoryWriteSchema
      ),
      defineTool('core_memory_delete',
        'Delete a key from core memory. Call this when a fact is no longer relevant.',
        CoreMemoryDeleteSchema
      ),
      defineTool('core_memory_list',
        'List all keys in core memory for an agent.',
        CoreMemoryListSchema
      ),
      // Entity Memory tools
      defineTool('entity_upsert',
        'Create or update a structured entity (person, hardware, project, concept, place, service). Entities are auto-injected at boot for quick reference.',
        EntityUpsertSchema
      ),
      defineTool('entity_get',
        'Get a specific entity by name.',
        EntityGetSchema
      ),
      defineTool('entity_search',
        'Search entities by keyword query.',
        EntitySearchSchema
      ),
      defineTool('entity_list',
        'List all entities, optionally filtered by type.',
        EntityListSchema
      ),
      defineTool('entity_delete',
        'Delete an entity by name.',
        EntityDeleteSchema
      ),
      defineTool('entity_prune',
        'Prune old entities not mentioned within the specified days.',
        EntityPruneSchema
      ),
      // KV-Cache tools
      defineTool('kv_cache_save',
        'Save a session snapshot to the 3-tier KV-Cache. Snapshots are automatically tiered (hot/warm/cold) and compressed.',
        KVCacheSaveSchema
      ),
      defineTool('kv_cache_load',
        'Load the most recent session snapshot for a project with automatic token budget trimming.',
        KVCacheLoadSchema
      ),
      defineTool('kv_cache_search',
        'Search across KV-Cache snapshots by keyword.',
        KVCacheSearchSchema
      ),
      defineTool('kv_cache_list',
        'List all snapshots for a project.',
        KVCacheListSchema
      ),
      defineTool('kv_cache_gc',
        'Run garbage collection on KV-Cache to remove old snapshots based on Ebbinghaus forgetting curve.',
        KVCacheGcSchema
      ),
      defineTool('kv_cache_backend_info',
        'Get KV-Cache backend information and statistics.',
        KVCacheBackendInfoSchema
      ),
      // Soul Board tools
      defineTool('board_read',
        'Read the complete project board state including active work, file ownership, and recent decisions.',
        BoardReadSchema
      ),
      defineTool('board_update_summary',
        'Update the project summary in the board.',
        BoardUpdateSummarySchema
      ),
      defineTool('board_add_decision',
        'Record a decision made during this project.',
        BoardAddDecisionSchema
      ),
      defineTool('board_claim_file',
        'Claim file ownership to prevent conflicts in multi-agent environments.',
        BoardClaimFileSchema
      ),
      defineTool('board_release_file',
        'Release all files claimed by this agent.',
        BoardReleaseFileSchema
      ),
      defineTool('board_set_active_work',
        'Set the current active work task for this agent.',
        BoardSetActiveWorkSchema
      ),
      // Ledger tools
      defineTool('ledger_list',
        'List ledger entries for a project.',
        LedgerListSchema
      ),
      defineTool('ledger_read',
        'Read a specific ledger entry by ID.',
        LedgerReadSchema
      ),
    ],
  };
});

/**
 * 处理工具调用请求
 * @param request - 工具调用请求对象，包含工具名称和参数
 * @returns 返回工具执行的结果
 * @throws {McpError} 当请求的工具不存在时抛出 MethodNotFound 错误
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  // 根据工具名称分发到对应的处理函数
  switch (name) {
    // Soul tools
    case 'get_persona_config':
      return handleGetPersonaConfig();
    case 'get_soul_state':
      return handleGetSoulState();
    case 'update_soul_state':
      return handleUpdateSoulState(UpdateSoulStateSchema.parse(args));
    case 'get_base_rules':
      return handleGetBaseRules(GetBaseRulesSchema.parse(args));
    case 'get_mcp_usage_guide':
      return handleGetMcpUsageGuide();
    case 'mcp_tool_index':
      return handleMcpToolIndex(McpToolIndexSchema.parse(args));

    // Memory tools
    case 'read_memory_day':
      return handleReadMemoryDay(ReadMemoryDaySchema.parse(args));
    case 'write_memory_day':
      return handleWriteMemoryDay(WriteMemoryDaySchema.parse(args));
    case 'read_memory_week':
      return handleReadMemoryWeek(ReadMemoryWeekSchema.parse(args));
    case 'write_memory_week':
      return handleWriteMemoryWeek(WriteMemoryWeekSchema.parse(args));
    case 'read_memory_month':
      return handleReadMemoryMonth(ReadMemoryMonthSchema.parse(args));
    case 'write_memory_month':
      return handleWriteMemoryMonth(WriteMemoryMonthSchema.parse(args));
    case 'read_memory_year':
      return handleReadMemoryYear(ReadMemoryYearSchema.parse(args));
    case 'write_memory_year':
      return handleWriteMemoryYear(WriteMemoryYearSchema.parse(args));
    case 'read_memory_topic':
      return handleReadMemoryTopic(ReadMemoryTopicSchema.parse(args));
    case 'write_memory_topic':
      return handleWriteMemoryTopic(WriteMemoryTopicSchema.parse(args));
    case 'list_memory_topics':
      return handleListMemoryTopics(ListMemoryTopicsSchema.parse(args));
    case 'archive_memory_topic':
      return handleArchiveMemoryTopic(ArchiveMemoryTopicSchema.parse(args));

    // Core Memory tools
    case 'core_memory_read':
      return handleCoreMemoryRead(CoreMemoryReadSchema.parse(args));
    case 'core_memory_write':
      return handleCoreMemoryWrite(CoreMemoryWriteSchema.parse(args));
    case 'core_memory_delete':
      return handleCoreMemoryDelete(CoreMemoryDeleteSchema.parse(args));
    case 'core_memory_list':
      return handleCoreMemoryList(CoreMemoryListSchema.parse(args));

    // Entity Memory tools
    case 'entity_upsert':
      return handleEntityUpsert(EntityUpsertSchema.parse(args));
    case 'entity_get':
      return handleEntityGet(EntityGetSchema.parse(args));
    case 'entity_search':
      return handleEntitySearch(EntitySearchSchema.parse(args));
    case 'entity_list':
      return handleEntityList(EntityListSchema.parse(args));
    case 'entity_delete':
      return handleEntityDelete(EntityDeleteSchema.parse(args));
    case 'entity_prune':
      return handleEntityPrune(EntityPruneSchema.parse(args));

    // KV-Cache tools
    case 'kv_cache_save':
      return handleKvCacheSave(KVCacheSaveSchema.parse(args));
    case 'kv_cache_load':
      return handleKvCacheLoad(KVCacheLoadSchema.parse(args));
    case 'kv_cache_search':
      return handleKvCacheSearch(KVCacheSearchSchema.parse(args));
    case 'kv_cache_list':
      return handleKvCacheList(KVCacheListSchema.parse(args));
    case 'kv_cache_gc':
      return handleKvCacheGc(KVCacheGcSchema.parse(args));
    case 'kv_cache_backend_info':
      return handleKvCacheBackendInfo(KVCacheBackendInfoSchema.parse(args));

    // Soul Board tools
    case 'board_read':
      return handleBoardRead(BoardReadSchema.parse(args));
    case 'board_update_summary':
      return handleBoardUpdateSummary(BoardUpdateSummarySchema.parse(args));
    case 'board_add_decision':
      return handleBoardAddDecision(BoardAddDecisionSchema.parse(args));
    case 'board_claim_file':
      return handleBoardClaimFile(BoardClaimFileSchema.parse(args));
    case 'board_release_file':
      return handleBoardReleaseFile(BoardReleaseFileSchema.parse(args));
    case 'board_set_active_work':
      return handleBoardSetActiveWork(BoardSetActiveWorkSchema.parse(args));

    // Ledger tools
    case 'ledger_list':
      return handleLedgerList(LedgerListSchema.parse(args));
    case 'ledger_read':
      return handleLedgerRead(LedgerReadSchema.parse(args));

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

/**
 * 启动 MCP 服务器
 * @description 创建标准输入输出传输通道并连接到 MCP 服务器，启动后在标准错误输出打印运行信息
 */
async function main() {
  // Log startup info for debugging
  console.error(`AgentSoul MCP Server starting...`);
  console.error(`- PROJECT_ROOT: ${PROJECT_ROOT}`);
  console.error(`- Working directory: ${process.cwd()}`);

  // 创建标准输入输出传输通道
  const transport = new StdioServerTransport();
  // 连接传输通道到服务器
  await server.connect(transport);
  // 输出服务器启动信息到标准错误
  console.error('AgentSoul MCP Server running on stdio');
}

// 启动服务器并处理可能的错误
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
