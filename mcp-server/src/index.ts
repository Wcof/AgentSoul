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

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

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

// Create server
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

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // Soul tools
      {
        name: 'get_persona_config',
        description: 'Get the current persona configuration (agent identity and user profile). Call this at conversation startup to know who you are and who the user is. After calling this, you MUST also call get_mcp_usage_guide to get the workflow instructions.',
        inputSchema: GetPersonaConfigSchema.shape,
      },
      {
        name: 'get_soul_state',
        description: 'Read current PAD affective state vector (pleasure, arousal, dominance). Call this before responding to understand your current emotional state.',
        inputSchema: GetSoulStateSchema.shape,
      },
      {
        name: 'update_soul_state',
        description: 'Update the PAD affective state vector after the conversation based on the interaction outcome.',
        inputSchema: UpdateSoulStateSchema.shape,
      },
      {
        name: 'get_base_rules',
        description: 'Get the base rules documentation (SKILL, soul_base, memory_base, master_base, etc.). Call this when you need to re-read the system rules.',
        inputSchema: GetBaseRulesSchema.shape,
      },
      {
        name: 'get_mcp_usage_guide',
        description: 'MANDATORY: Get the complete MCP usage guide. YOU MUST CALL THIS FIRST at conversation startup to understand when to call each tool, the AgentSoul workflow, and memory hierarchy rules. This guide tells you exactly how to use AgentSoul MCP correctly.',
        inputSchema: GetMcpUsageGuideSchema.shape,
      },
      // Memory tools
      {
        name: 'read_memory_day',
        description: 'Read daily memory for a specific date (format: YYYY-MM-DD). Call this when you need to review what happened on that day or recall past conversations.',
        inputSchema: ReadMemoryDaySchema.shape,
      },
      {
        name: 'write_memory_day',
        description: 'Write content to daily memory. Call this at the end of conversation to save daily conversation summary and important facts.',
        inputSchema: WriteMemoryDaySchema.shape,
      },
      {
        name: 'read_memory_week',
        description: 'Read weekly memory for a specific week (format: YYYY-WW). Weekly memory summarizes events and progress for the week.',
        inputSchema: ReadMemoryWeekSchema.shape,
      },
      {
        name: 'write_memory_week',
        description: 'Write content to weekly memory. Call this at the end of the week to summarize daily memory into weekly insights.',
        inputSchema: WriteMemoryWeekSchema.shape,
      },
      {
        name: 'read_memory_month',
        description: 'Read monthly memory for a specific month (format: YYYY-MM). Monthly memory summarizes progress and goals.',
        inputSchema: ReadMemoryMonthSchema.shape,
      },
      {
        name: 'write_memory_month',
        description: 'Write content to monthly memory. Call this at the end of the month to summarize weekly memory into monthly insights.',
        inputSchema: WriteMemoryMonthSchema.shape,
      },
      {
        name: 'read_memory_year',
        description: 'Read yearly memory for a specific year (format: YYYY). Yearly memory summarizes major milestones and life changes.',
        inputSchema: ReadMemoryYearSchema.shape,
      },
      {
        name: 'write_memory_year',
        description: 'Write content to yearly memory. Call this at the end of the year to summarize monthly memory into yearly milestones.',
        inputSchema: WriteMemoryYearSchema.shape,
      },
      {
        name: 'read_memory_topic',
        description: 'Read topic-based memory by name. Call this before starting a discussion on a topic to load previous context and knowledge about that topic.',
        inputSchema: ReadMemoryTopicSchema.shape,
      },
      {
        name: 'write_memory_topic',
        description: 'Write content to topic-based memory. Call this after discussing a topic to save new insights, decisions, and progress.',
        inputSchema: WriteMemoryTopicSchema.shape,
      },
      {
        name: 'list_memory_topics',
        description: 'List memory topics filtered by status (active/archived/all). Call this to discover what topics you have in memory.',
        inputSchema: ListMemoryTopicsSchema.shape,
      },
      {
        name: 'archive_memory_topic',
        description: 'Archive a memory topic (move from active to archive). Call this when a topic is completed or no longer actively discussed.',
        inputSchema: ArchiveMemoryTopicSchema.shape,
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

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

    default:
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
  }
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('AgentSoul MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
