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
 *       "args": ["/absolute/path/to/AgentSoul/mcp_server/dist/index.js"]
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

import { z } from 'zod';
import { PROJECT_ROOT } from './lib/paths.js';
import { initLanguage, getLanguageResources, getToolDescription, getStartupMessage } from './language/index.js';
import type { Tool } from '@modelcontextprotocol/sdk/types.js';

/**
 * Cached tools array with language descriptions already resolved.
 * Built once at startup after language initialization since language doesn't change at runtime.
 */
let cachedTools: Tool[] | null = null;

import {
  GetPersonaConfigSchema,
  handleGetPersonaConfig,
  WritePersonaConfigSchema,
  handleWritePersonaConfig,
  GetSoulStateSchema,
  handleGetSoulState,
  UpdateSoulStateSchema,
  handleUpdateSoulState,
  HealthCheckSchema,
  handleHealthCheck,
  GetGrowthCurveSchema,
  handleGetGrowthCurve,
  GetBaseRulesSchema,
  handleGetBaseRules,
  GetMcpUsageGuideSchema,
  handleGetMcpUsageGuide,
  McpToolIndexSchema,
  handleMcpToolIndex,
  GetPersonaVersionSchema,
  handleGetPersonaVersion,
  ListSoulVersionsSchema,
  handleListSoulVersions,
  RollbackSoulSchema,
  handleRollbackSoul,
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
  EntityFactAddSchema,
  handleEntityFactAdd,
  EntityFactInvalidateSchema,
  handleEntityFactInvalidate,
} from './tools/entity-memory.js';
import {
  VerbatimAddSchema,
  handleVerbatimAdd,
  VerbatimGetSchema,
  handleVerbatimGet,
  VerbatimSearchSchema,
  handleVerbatimSearch,
  VerbatimDeleteSchema,
  handleVerbatimDelete,
} from './tools/verbatim-evidence.js';

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
  BoardAddLabelsSchema,
  handleBoardAddLabels,
  BoardRemoveLabelsSchema,
  handleBoardRemoveLabels,
  BoardListLabelsSchema,
  handleBoardListLabels,
  BoardSearchDecisionsSchema,
  handleBoardSearchDecisions,
} from './tools/soul-board.js';

import {
  SearchMemorySchema,
  handleSearchMemory,
  TagMemorySchema,
  handleTagMemory,
  UntagMemorySchema,
  handleUntagMemory,
  GetMemoryTagsSchema,
  handleGetMemoryTags,
  ListTagsSchema,
  handleListTags,
  SetMemoryPrioritySchema,
  handleSetMemoryPriority,
  GetHighPriorityMemoriesSchema,
  handleGetHighPriorityMemories,
} from './tools/memory_enhanced.js';

import {
  GetLearningPreferencesSchema,
  handleGetLearningPreferences,
  SubmitFeedbackSchema,
  handleSubmitFeedback,
  ResetLearningSchema,
  handleResetLearning,
  SetLearningIntensitySchema,
  handleSetLearningIntensity,
  GetInteractionStatisticsSchema,
  handleGetInteractionStatistics,
} from './tools/adaptive.js';

import {
  SubscribeSchema,
  handleSubscribe,
  UnsubscribeSchema,
  handleUnsubscribe,
  ListSubscriptionsSchema,
  handleListSubscriptions,
} from './tools/subscription.js';

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
  // Extract the inner schema shape - handle both plain ZodObject and ZodEffects (refinements)
  // For ZodEffects created by .refine(), the inner schema is at _schema
  const shape = '_schema' in schema && schema._schema && 'shape' in schema._schema
    ? schema._schema.shape
    : 'shape' in schema
    ? schema.shape
    : {};
  return {
    name,
    description,
    inputSchema: {
      type: 'object',
      properties: shape,
    },
  };
}

/**
 * Tool metadata for building the cached tools list
 * schema can be ZodObject or ZodEffects (for refined schemas)
 */
interface ToolMetadata {
  name: string;
  fallbackDescription: string;
  schema: any;
}

/** All tool metadata - used to build the cached list once after language init */
const ALL_TOOLS: ToolMetadata[] = [
  // Soul tools
  { name: 'get_persona_config', fallbackDescription: 'Get the current persona configuration (agent identity and user profile). Call this at conversation startup to know who you are and who the user is. After calling this, you MUST also call get_mcp_usage_guide to get the workflow instructions.', schema: GetPersonaConfigSchema },
  { name: 'write_persona_config', fallbackDescription: 'Write and update the persona configuration (agent identity and user profile). Call this after updating agent information. Triggers persona_updated event to all subscribers.', schema: WritePersonaConfigSchema },
  { name: 'get_soul_state', fallbackDescription: 'Read current PAD affective state vector (pleasure, arousal, dominance). Call this before responding to understand your current emotional state.', schema: GetSoulStateSchema },
  { name: 'health_check', fallbackDescription: 'Run a full health check on the AgentSoul installation. Checks directory structure, config files, soul state, memory files, and permissions. Returns a complete health report with any issues found and fix suggestions.', schema: HealthCheckSchema },
  { name: 'get_growth_curve', fallbackDescription: 'Get soul growth curve historical data. Returns the full history of PAD affective state changes for visualization and trend analysis.', schema: GetGrowthCurveSchema },
  { name: 'update_soul_state', fallbackDescription: 'Update the PAD affective state vector after the conversation based on the interaction outcome.', schema: UpdateSoulStateSchema },
  { name: 'get_base_rules', fallbackDescription: 'Get the base rules documentation (SKILL, soul_base, memory_base, master_base, etc.). Call this when you need to re-read the system rules.', schema: GetBaseRulesSchema },
  { name: 'get_mcp_usage_guide', fallbackDescription: 'MANDATORY: Get the complete MCP usage guide. YOU MUST CALL THIS FIRST at conversation startup to understand when to call each tool, the AgentSoul workflow, and memory hierarchy rules. This guide tells you exactly how to use AgentSoul MCP correctly.', schema: GetMcpUsageGuideSchema },
  { name: 'mcp_tool_index', fallbackDescription: '🔍 AGENT RESEARCH TOOL: Get MCP tool reference - complete or specific. NOT REQUIRED on every startup. USAGE: 1) No params → full index, 2) category=\"x\" → filter by category, 3) tool=\"name\" → get detailed reference for ONE specific tool. WHEN TO USE: When uncertain which tool to use, forgot parameters, first time using tool. Study reference first before calling actual tool. MANDATORY when uncertain.', schema: McpToolIndexSchema },
  // Memory tools
  { name: 'read_memory_day', fallbackDescription: 'Read daily memory for a specific date (format: YYYY-MM-DD). Call this when you need to review what happened on that day or recall past conversations.', schema: ReadMemoryDaySchema },
  { name: 'write_memory_day', fallbackDescription: 'Write content to daily memory. Call this at the end of conversation to save daily conversation summary and important facts.', schema: WriteMemoryDaySchema },
  { name: 'read_memory_week', fallbackDescription: 'Read weekly memory for a specific week (format: YYYY-WW). Weekly memory summarizes events and progress for the week.', schema: ReadMemoryWeekSchema },
  { name: 'write_memory_week', fallbackDescription: 'Write content to weekly memory. Call this at the end of the week to summarize daily memory into weekly insights.', schema: WriteMemoryWeekSchema },
  { name: 'read_memory_month', fallbackDescription: 'Read monthly memory for a specific month (format: YYYY-MM). Monthly memory summarizes progress and goals.', schema: ReadMemoryMonthSchema },
  { name: 'write_memory_month', fallbackDescription: 'Write content to monthly memory. Call this at the end of the month to summarize weekly memory into monthly insights.', schema: WriteMemoryMonthSchema },
  { name: 'read_memory_year', fallbackDescription: 'Read yearly memory for a specific year (format: YYYY). Yearly memory summarizes major milestones and life changes.', schema: ReadMemoryYearSchema },
  { name: 'write_memory_year', fallbackDescription: 'Write content to yearly memory. Call this at the end of the year to summarize monthly memory into yearly milestones.', schema: WriteMemoryYearSchema },
  { name: 'read_memory_topic', fallbackDescription: 'Read topic-based memory by name. Call this before starting a discussion on a topic to load previous context and knowledge about that topic.', schema: ReadMemoryTopicSchema },
  { name: 'write_memory_topic', fallbackDescription: 'Write content to topic-based memory. Call this after discussing a topic to save new insights, decisions, and progress.', schema: WriteMemoryTopicSchema },
  { name: 'list_memory_topics', fallbackDescription: 'List memory topics filtered by status (active/archived/all). Call this to discover what topics you have in memory.', schema: ListMemoryTopicsSchema },
  { name: 'archive_memory_topic', fallbackDescription: 'Archive a memory topic (move from active to archive). Call this when a topic is completed or no longer actively discussed.', schema: ArchiveMemoryTopicSchema },
  // Core Memory tools
  { name: 'core_memory_read', fallbackDescription: 'Read all core memory entries for an agent. Core memory contains persistent key-value facts that are auto-injected at boot.', schema: CoreMemoryReadSchema },
  { name: 'core_memory_write', fallbackDescription: 'Write or update a key-value fact in core memory. Core memory persists across sessions and is auto-injected at boot.', schema: CoreMemoryWriteSchema },
  { name: 'core_memory_delete', fallbackDescription: 'Delete a key from core memory. Call this when a fact is no longer relevant.', schema: CoreMemoryDeleteSchema },
  { name: 'core_memory_list', fallbackDescription: 'List all keys in core memory for an agent.', schema: CoreMemoryListSchema },
  // Entity Memory tools
  { name: 'entity_upsert', fallbackDescription: 'Create or update a structured entity (person, hardware, project, concept, place, service). Entities are auto-injected at boot for quick reference.', schema: EntityUpsertSchema },
  { name: 'entity_get', fallbackDescription: 'Get a specific entity by name.', schema: EntityGetSchema },
  { name: 'entity_search', fallbackDescription: 'Search entities by keyword query.', schema: EntitySearchSchema },
  { name: 'entity_list', fallbackDescription: 'List all entities, optionally filtered by type.', schema: EntityListSchema },
  { name: 'entity_delete', fallbackDescription: 'Delete an entity by name.', schema: EntityDeleteSchema },
  { name: 'entity_prune', fallbackDescription: 'Prune old entities not mentioned within the specified days.', schema: EntityPruneSchema },
  { name: 'entity_fact_add', fallbackDescription: 'Add a new temporal fact for an attribute. Automatically invalidates any currently valid fact.', schema: EntityFactAddSchema },
  { name: 'entity_fact_invalidate', fallbackDescription: 'Invalidate all currently valid facts for a specific attribute on an entity.', schema: EntityFactInvalidateSchema },
  { name: 'verbatim_add', fallbackDescription: 'Add a verbatim evidence fragment - stores original unchanged text with metadata.', schema: VerbatimAddSchema },
  { name: 'verbatim_get', fallbackDescription: 'Get a verbatim evidence fragment by ID.', schema: VerbatimGetSchema },
  { name: 'verbatim_search', fallbackDescription: 'Search verbatim evidence fragments by keyword text with optional filtering.', schema: VerbatimSearchSchema },
  { name: 'verbatim_delete', fallbackDescription: 'Delete a verbatim evidence fragment.', schema: VerbatimDeleteSchema },
  // KV-Cache tools
  { name: 'kv_cache_save', fallbackDescription: 'Save a session snapshot to the 3-tier KV-Cache. Snapshots are automatically tiered (hot/warm/cold) and compressed.', schema: KVCacheSaveSchema },
  { name: 'kv_cache_load', fallbackDescription: 'Load the most recent session snapshot for a project with automatic token budget trimming.', schema: KVCacheLoadSchema },
  { name: 'kv_cache_search', fallbackDescription: 'Search across KV-Cache snapshots by keyword.', schema: KVCacheSearchSchema },
  { name: 'kv_cache_list', fallbackDescription: 'List all snapshots for a project.', schema: KVCacheListSchema },
  { name: 'kv_cache_gc', fallbackDescription: 'Run garbage collection on KV-Cache to remove old snapshots based on Ebbinghaus forgetting curve.', schema: KVCacheGcSchema },
  { name: 'kv_cache_backend_info', fallbackDescription: 'Get KV-Cache backend information and statistics.', schema: KVCacheBackendInfoSchema },
  // Soul Board tools
  { name: 'board_read', fallbackDescription: 'Read the complete project board state including active work, file ownership, and recent decisions.', schema: BoardReadSchema },
  { name: 'board_update_summary', fallbackDescription: 'Update the project summary in the board.', schema: BoardUpdateSummarySchema },
  { name: 'board_add_decision', fallbackDescription: 'Record a decision made during this project.', schema: BoardAddDecisionSchema },
  { name: 'board_add_labels', fallbackDescription: 'Add custom labels to the project for categorization.', schema: BoardAddLabelsSchema },
  { name: 'board_remove_labels', fallbackDescription: 'Remove custom labels from the project.', schema: BoardRemoveLabelsSchema },
  { name: 'board_list_labels', fallbackDescription: 'List all custom labels defined for the project.', schema: BoardListLabelsSchema },
  { name: 'board_search_decisions', fallbackDescription: 'Search project decisions by custom labels.', schema: BoardSearchDecisionsSchema },
  { name: 'board_claim_file', fallbackDescription: 'Claim file ownership to prevent conflicts in multi-agent environments.', schema: BoardClaimFileSchema },
  { name: 'board_release_file', fallbackDescription: 'Release all files claimed by this agent.', schema: BoardReleaseFileSchema },
  { name: 'board_set_active_work', fallbackDescription: 'Set the current active work task for this agent.', schema: BoardSetActiveWorkSchema },
  // Ledger tools
  { name: 'ledger_list', fallbackDescription: 'List ledger entries for a project.', schema: LedgerListSchema },
  { name: 'ledger_read', fallbackDescription: 'Read a specific ledger entry by ID.', schema: LedgerReadSchema },
  // Enhanced Memory tools
  { name: 'enhanced_memory_search', fallbackDescription: 'Enhanced memory search with fuzzy matching, date filtering, tag filtering and priority filtering. Returns sorted results by relevance * priority.', schema: SearchMemorySchema },
  { name: 'add_memory_tags', fallbackDescription: 'Add one or more tags to an existing enhanced memory.', schema: TagMemorySchema },
  { name: 'remove_memory_tags', fallbackDescription: 'Remove one or more tags from an existing enhanced memory.', schema: UntagMemorySchema },
  { name: 'get_memory_tags', fallbackDescription: 'Get all tags for a specific enhanced memory.', schema: GetMemoryTagsSchema },
  { name: 'list_all_tags', fallbackDescription: 'List all tags with usage statistics, optionally filtered by minimum count.', schema: ListTagsSchema },
  { name: 'set_memory_priority', fallbackDescription: 'Set the priority level (high/medium/low) for an enhanced memory. Higher priority memories get sorted first in search results.', schema: SetMemoryPrioritySchema },
  { name: 'get_high_priority_memories', fallbackDescription: 'Get a list of all high priority enhanced memory entries.', schema: GetHighPriorityMemoriesSchema },
  // Adaptive Learning tools
  { name: 'get_learning_preferences', fallbackDescription: 'Get the current learned user preferences from adaptive learning.', schema: GetLearningPreferencesSchema },
  { name: 'submit_feedback', fallbackDescription: 'Submit user feedback to improve adaptive learning of user preferences and PAD emotional state.', schema: SubmitFeedbackSchema },
  { name: 'reset_learning', fallbackDescription: 'Reset all adaptive learning data to default values (clears all learned preferences).', schema: ResetLearningSchema },
  { name: 'set_learning_intensity', fallbackDescription: 'Set the learning intensity (0 to 1) for adaptive adjustments. Higher intensity means faster learning.', schema: SetLearningIntensitySchema },
  { name: 'get_interaction_statistics', fallbackDescription: 'Get statistics about collected interaction data including feedback counts.', schema: GetInteractionStatisticsSchema },
  // Subscription Push tools
  { name: 'subscribe', fallbackDescription: 'Subscribe to soul events via webhook push. Get notified when memory is written, soul state changes, or topics are archived.', schema: SubscribeSchema },
  { name: 'unsubscribe', fallbackDescription: 'Cancel an existing subscription by ID.', schema: UnsubscribeSchema },
  { name: 'list_subscriptions', fallbackDescription: 'List all current subscriptions with their status.', schema: ListSubscriptionsSchema },
  // Version management tools
  { name: 'get_persona_version', fallbackDescription: 'Get current persona version information including version number, timestamp and checksum.', schema: GetPersonaVersionSchema },
  { name: 'list_soul_versions', fallbackDescription: 'List all available soul state version snapshots for rollback.', schema: ListSoulVersionsSchema },
  { name: 'rollback_soul', fallbackDescription: 'Rollback soul state (PAD emotion) to a specific previous version.', schema: RollbackSoulSchema },
];

/**
 * Build the complete tools array with language descriptions resolved.
 * Called once at startup after language initialization.
 */
function buildCachedTools(): Tool[] {
  const lang = getLanguageResources();
  return ALL_TOOLS.map(tool => defineTool(
    tool.name,
    getToolDescription(tool.name, tool.fallbackDescription),
    tool.schema
  ));
}

/**
 * 处理工具列表请求
 * @returns 返回所有可用工具的列表，包括人格工具、记忆工具、核心记忆工具、实体记忆工具、KV-Cache 工具、项目看板工具和账本工具
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  if (cachedTools !== null) {
    return { tools: cachedTools };
  }
  // This should only happen on first request before main() completes, which shouldn't happen
  // But build it anyway for robustness
  cachedTools = buildCachedTools();
  return { tools: cachedTools };
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
    case 'write_persona_config':
      return handleWritePersonaConfig(WritePersonaConfigSchema.parse(args));
    case 'get_soul_state':
      return handleGetSoulState();
    case 'update_soul_state':
      return handleUpdateSoulState(UpdateSoulStateSchema.parse(args));
    case 'health_check':
      return handleHealthCheck(HealthCheckSchema.parse(args));
    case 'get_growth_curve':
      return handleGetGrowthCurve();
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
    case 'entity_fact_add':
      return handleEntityFactAdd(EntityFactAddSchema.parse(args));
    case 'entity_fact_invalidate':
      return handleEntityFactInvalidate(EntityFactInvalidateSchema.parse(args));
    case 'verbatim_add':
      return handleVerbatimAdd(VerbatimAddSchema.parse(args));
    case 'verbatim_get':
      return handleVerbatimGet(VerbatimGetSchema.parse(args));
    case 'verbatim_search':
      return handleVerbatimSearch(VerbatimSearchSchema.parse(args));
    case 'verbatim_delete':
      return handleVerbatimDelete(VerbatimDeleteSchema.parse(args));

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
    case 'board_add_labels':
      return handleBoardAddLabels(BoardAddLabelsSchema.parse(args));
    case 'board_remove_labels':
      return handleBoardRemoveLabels(BoardRemoveLabelsSchema.parse(args));
    case 'board_list_labels':
      return handleBoardListLabels(BoardListLabelsSchema.parse(args));
    case 'board_search_decisions':
      return handleBoardSearchDecisions(BoardSearchDecisionsSchema.parse(args));
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

    // Enhanced Memory tools
    case 'enhanced_memory_search':
      return handleSearchMemory(SearchMemorySchema.parse(args));
    case 'add_memory_tags':
      return handleTagMemory(TagMemorySchema.parse(args));
    case 'remove_memory_tags':
      return handleUntagMemory(UntagMemorySchema.parse(args));
    case 'get_memory_tags':
      return handleGetMemoryTags(GetMemoryTagsSchema.parse(args));
    case 'list_all_tags':
      return handleListTags(ListTagsSchema.parse(args));
    case 'set_memory_priority':
      return handleSetMemoryPriority(SetMemoryPrioritySchema.parse(args));
    case 'get_high_priority_memories':
      return handleGetHighPriorityMemories(GetHighPriorityMemoriesSchema.parse(args));

    // Adaptive Learning tools
    case 'get_learning_preferences':
      return handleGetLearningPreferences();
    case 'submit_feedback':
      return handleSubmitFeedback(SubmitFeedbackSchema.parse(args));
    case 'reset_learning':
      return handleResetLearning();
    case 'set_learning_intensity':
      return handleSetLearningIntensity(SetLearningIntensitySchema.parse(args));
    case 'get_interaction_statistics':
      return handleGetInteractionStatistics();

    // Subscription Push tools
    case 'subscribe':
      return handleSubscribe(SubscribeSchema.parse(args));
    case 'unsubscribe':
      return handleUnsubscribe(UnsubscribeSchema.parse(args));
    case 'list_subscriptions':
      return handleListSubscriptions();

    // Version management tools
    case 'get_persona_version':
      return handleGetPersonaVersion();
    case 'list_soul_versions':
      return handleListSoulVersions();
    case 'rollback_soul':
      return handleRollbackSoul(RollbackSoulSchema.parse(args));

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

/**
 * 启动 MCP 服务器
 * @description 创建标准输入输出传输通道并连接到 MCP 服务器，启动后在标准错误输出打印运行信息
 */
async function main() {
  // Initialize multi-language support
  const langResources = initLanguage();

  // Build cached tools list with language descriptions resolved
  cachedTools = buildCachedTools();

  // 创建标准输入输出传输通道
  const transport = new StdioServerTransport();
  // 连接传输通道到服务器
  await server.connect(transport);

  // Only output startup confirmation in quiet mode
  // All debugging info is removed for cleaner logs
  if (process.env.AGENTSOUL_DEBUG === '1') {
    console.error(getStartupMessage('server_starting'));
    console.error(getStartupMessage('project_root', PROJECT_ROOT));
    console.error(getStartupMessage('working_dir', process.cwd()));
    console.error(getStartupMessage('language_loaded', langResources.language));
    console.error(getStartupMessage('tools_cached', cachedTools.length));
  }
  console.error(getStartupMessage('server_running'));
}

// 启动服务器并处理可能的错误
main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
