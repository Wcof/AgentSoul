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
} from './tools/soul.js';

import {
  ReadMemoryDaySchema,
  handleReadMemoryDay,
  WriteMemoryDaySchema,
  handleWriteMemoryDay,
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
    name: 'agentsoul',
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
        description: 'Get the current persona configuration (agent identity and user profile)',
        inputSchema: GetPersonaConfigSchema.shape,
      },
      {
        name: 'get_soul_state',
        description: 'Read current PAD affective state vector (pleasure, arousal, dominance)',
        inputSchema: GetSoulStateSchema.shape,
      },
      {
        name: 'update_soul_state',
        description: 'Update the PAD affective state vector',
        inputSchema: UpdateSoulStateSchema.shape,
      },
      {
        name: 'get_base_rules',
        description: 'Get the base rules documentation (SKILL, soul_base, memory_base, master_base, etc.)',
        inputSchema: GetBaseRulesSchema.shape,
      },
      // Memory tools
      {
        name: 'read_memory_day',
        description: 'Read daily memory for a specific date (format: YYYY-MM-DD)',
        inputSchema: ReadMemoryDaySchema.shape,
      },
      {
        name: 'write_memory_day',
        description: 'Write content to daily memory',
        inputSchema: WriteMemoryDaySchema.shape,
      },
      {
        name: 'read_memory_topic',
        description: 'Read topic-based memory by name',
        inputSchema: ReadMemoryTopicSchema.shape,
      },
      {
        name: 'write_memory_topic',
        description: 'Write content to topic-based memory',
        inputSchema: WriteMemoryTopicSchema.shape,
      },
      {
        name: 'list_memory_topics',
        description: 'List memory topics filtered by status (active/archived/all)',
        inputSchema: ListMemoryTopicsSchema.shape,
      },
      {
        name: 'archive_memory_topic',
        description: 'Archive a memory topic (move from active to archive)',
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

    // Memory tools
    case 'read_memory_day':
      return handleReadMemoryDay(ReadMemoryDaySchema.parse(args));
    case 'write_memory_day':
      return handleWriteMemoryDay(WriteMemoryDaySchema.parse(args));
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
