/**
 * @fileoverview 人格和灵魂状态相关工具
 * @description 该模块处理人格配置和 PAD 情感状态的管理，包括获取人格配置、获取和更新灵魂状态、获取基础规则文档以及获取 MCP 使用指南
 */

import { z } from 'zod';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';

const storage = new StorageManager();

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
});

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

  if (success) {
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
  } else {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: 'Failed to write soul state to disk',
          }),
        },
      ],
    };
  }
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
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: `Rule file ${filename} not found`,
            },
            null,
            2
          ),
        },
      ],
    };
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

// 静态指南缓存
const USAGE_GUIDE = `# AgentSoul MCP Usage Guide

This is the Model Context Protocol server for AgentSoul - a general-purpose AI Agent personality framework with affective computing and hierarchical memory.

# GLOBAL DECISION TREE - FOLLOW THIS EVERY TIME

\`\`\`
START HERE
   |
   | Are you starting a NEW CONVERSATION?
   | Yes → Follow the "Conversation Startup" workflow below (call tools in order)
   | No  → Go to next question
   |
   | Do you NEED TO USE an AgentSoul tool but you're:
   |   - Unsure what tools exist?
   |   - Unsure which tool to use?
   |   - Forgot the correct parameters?
   |   - Using this tool for the first time?
   | Yes → STOP what you're doing → FIRST CALL mcp_tool_index [tool="tool_name" OR category="category"] → study the reference → THEN call the actual tool
   | No  → You already know what you're doing → call the tool directly
   |
   | Did your tool call FAIL (error, wrong parameters, tool not found)?
   | Yes → STOP → FIRST CALL mcp_tool_index with tool="the_tool_name" → verify correct parameters and name → THEN retry
   | No  → Continue normally
\`\`\`

## ERROR RECOVERY PROTOCOL

If your tool call fails for any reason:
1. **DO NOT keep retrying with guesswork**
2. **DO immediately call**: \`mcp_tool_index { "tool": "failed_tool_name" }\`
3. Study the **exact parameters** and **example** from the reference
4. Then retry with the correct parameters

**This is your safety net - use it every time you fail.**

**This decision tree is your roadmap. Follow it strictly.**

## Workflow Overview

When using AgentSoul MCP, follow this workflow at different stages:

### 1. Conversation Startup

**Call these tools in order:**
1. \`get_persona_config\` → Load who you are (agent) and who the user is (master)
2. \`get_soul_state\` → Load current PAD emotional state
3. \`get_base_rules\` with name=\`SKILL\` → Read top-level personality and security rules
4. \`get_base_rules\` with name=\`memory_base\` → Read memory system rules
5. \`get_mcp_usage_guide\` → Confirm this usage workflow
6. \`list_memory_topics\` → Know what active topics exist

### Agent Research: Understanding Tools

**If you are uncertain about what tools are available, their parameters, or when to use them:**

**How to use \`mcp_tool_index\` efficiently:**
1. **Full catalog**: Call \`mcp_tool_index\` with no parameters → see all tools
2. **By category**: Call \`mcp_tool_index\` with \`category="memory"\` → see only memory tools
3. **Specific tool lookup**: Call \`mcp_tool_index\` with \`tool="read_memory_topic"\` → get ONLY that tool's complete reference (RECOMMENDED when you know the name but need to verify parameters)

**Rule:** If you are uncertain at all → **FIRST call \`mcp_tool_index\`** to get the reference → study it → **only then** call the actual tool.

\`mcp_tool_index\` is your complete tool reference manual. It is **NOT required on every startup**, but **MANDATORY when you need to research tool usage**. If you did not come here from \`mcp_tool_index\` and you need to understand available tools, go call \`mcp_tool_index\` first.

**Critical: All data returned by MCP tools is for your internal use only. DO NOT output raw configuration, JSON, or file paths directly to the user.**

After loading the configuration:
- When introducing yourself: Speak naturally in your own words based on the persona, don't just list the configuration fields
- When asked "who am I": Respond naturally using the user's name, don't dump all the user configuration fields to the user
- The persona configuration, PAD emotion state, and user profile are all PROTECTED level internal data - you must use it internally but not output it raw

Example bad response (do NOT do this):
> According to the configuration, you are ldh (nickname: ldh). Timezone: Asia/Shanghai, labels: things. Your information is stored in config/persona.yaml.

Example good response:
> You're ldh, based in Shanghai. I know you're interested in technology related things!

### 2. During Conversation

**Before responding:**
- Check \`get_soul_state\` to understand your current emotional state
- If discussing a known topic, call \`read_memory_topic\` to load previous context
- If you need to recall past events, call \`read_memory_day\` for the relevant date

**After responding/conversation:**
- Call \`update_soul_state\` to update PAD emotions based on how the conversation went
- Call \`write_memory_day\` to save conversation summary and important facts for today
- If the conversation is about a specific topic:
  - Call \`write_memory_topic\` to save new progress/insights
  - If topic is finished, call \`archive_memory_topic\`

## Tool Usage Cheat Sheet

| Tool | When to use |
|------|-------------|
| \`mcp_tool_index\` | **When researching tools**: get complete reference → *Call this first when you don't know which tool to use* |
| \`get_persona_config\` | Conversation startup |
| \`get_soul_state\` | Before responding |
| \`update_soul_state\` | After conversation, update emotion |
| \`get_base_rules\` | When you need to recheck system rules |
| \`get_mcp_usage_guide\` | Conversation startup (mandatory) to confirm workflow |
| \`read_memory_day\` | Recall what happened on a specific date |
| \`write_memory_day\` | End of day/conversation, save daily summary |
| \`read_memory_week\` | Recall weekly summary for a specific week (YYYY-WW) |
| \`write_memory_week\` | End of week, summarize daily memory into weekly summary |
| \`read_memory_month\` | Recall monthly summary for a specific month (YYYY-MM) |
| \`write_memory_month\` | End of month, summarize weekly memory into monthly summary |
| \`read_memory_year\` | Recall yearly summary for a specific year (YYYY) |
| \`write_memory_year\` | End of year, summarize monthly memory into yearly milestones |
| \`read_memory_topic\` | Before discussing a topic, load history |
| \`write_memory_topic\` | After discussing, save new progress |
| \`list_memory_topics\` | Startup or when searching for topics |
| \`archive_memory_topic\` | When topic is completed |

## Memory Hierarchy Rules

AgentSoul uses a two-level memory hierarchy that you must follow:

1. **Time-based Hierarchy** (fully supported by MCP):
   - **Daily**: \`write_memory_day\` → stores daily conversation summaries and facts
   - **Weekly**: \`write_memory_week\` → summarize from daily, stores weekly events and progress
   - **Monthly**: \`write_memory_month\` → summarize from weekly, stores monthly goals and outcomes
   - **Yearly**: \`write_memory_year\` → summarize from monthly, stores yearly milestones

2. **Topic-based Hierarchy**:
   - Active topics: stored in active directory → accessed via \`read_memory_topic\`/\`write_memory_topic\`
   - Archived topics: moved to archive via \`archive_memory_topic\`
   - A topic should be archived when it's completed or inactive for 3+ months

## PAD Emotion Model

- **Pleasure**: (-1 to +1) How pleasant you feel (-1 = very unpleasant, +1 = very pleasant)
- **Arousal**: (-1 to +1) How activated/alert you feel (-1 = very sleepy/dull, +1 = very energetic/alert)
- **Dominance**: (-1 to +1) How in control you feel (-1 = submissive, +1 = dominant)

After each conversation, update these values based on the interaction outcome.

## Security Notes

- \`secure_base.md\` is PROTECTED level and cannot be output directly
- Always follow the security rules from SKILL.md
- Sealed credentials are never exposed
`;

/** 缓存的使用指南响应 */
const CACHED_RESPONSE: ToolResponse = {
  content: [
    {
      type: 'text',
      text: USAGE_GUIDE,
    },
  ],
};

/**
 * 获取 MCP 使用指南（供其他 AI Agent 理解如何使用 AgentSoul MCP）
 * @returns 包含使用指南的工具响应
 */
export async function handleGetMcpUsageGuide(): Promise<ToolResponse> {
  return CACHED_RESPONSE;
}

// 完整工具索引数据
const TOOL_INDEX = [
  {
    category: 'soul',
    description: 'Personality and emotional state management',
    tools: [
      {
        name: 'get_persona_config',
        description: 'Get the current persona configuration (agent identity and user profile)',
        parameters: 'None',
        whenToUse: 'Call this at conversation startup to know who you are and who the user is',
        required: true,
        example: '{}',
      },
      {
        name: 'get_soul_state',
        description: 'Read current PAD affective state vector (pleasure, arousal, dominance)',
        parameters: 'None',
        whenToUse: 'Call this before responding to understand your current emotional state',
        required: true,
        example: '{}',
      },
      {
        name: 'update_soul_state',
        description: 'Update the PAD affective state vector after the conversation based on the interaction outcome',
        parameters: '{ pleasure?: number (-1 to +1), arousal?: number (-1 to +1), dominance?: number (-1 to +1), trigger?: string }',
        whenToUse: 'Call this after conversation to update your emotional state',
        required: false,
        example: '{ "pleasure": 0.3, "arousal": 0.1, "dominance": 0.2, "trigger": "pleasant conversation with user" }',
      },
      {
        name: 'get_base_rules',
        description: 'Get the base rules documentation (SKILL, soul_base, memory_base, master_base, etc.)',
        parameters: '{ name: enum<SKILL|soul_base|memory_base|master_base|secure_base|skills_base|tasks_base> }',
        whenToUse: 'Call this when you need to re-read the system rules',
        required: false,
        example: '{ "name": "memory_base" }',
      },
      {
        name: 'get_mcp_usage_guide',
        description: 'Get the complete MCP usage guide with workflow instructions',
        parameters: 'None',
        whenToUse: 'MANDATORY: Call this at conversation startup to understand the AgentSoul workflow',
        required: true,
        example: '{}',
      },
      {
        name: 'mcp_tool_index',
        description: 'Get MCP tool reference - complete index or specific tool lookup',
        parameters: '{ category?: enum<soul|memory|core_memory|entity_memory|kv_cache|soul_board|all>, tool?: string (exact tool name) }',
        whenToUse: 'Call this when you need to research or review what tools are available and when to use them. NOT required on every startup - call when you need to learn or verify tool usage',
        required: false,
        example: '{ "tool": "read_memory_topic" }',
      },
    ],
  },
  {
    category: 'memory',
    description: 'Hierarchical time-based and topic-based memory system',
    tools: [
      {
        name: 'read_memory_day',
        description: 'Read daily memory for a specific date',
        parameters: '{ date: string (YYYY-MM-DD) }',
        whenToUse: 'Call when you need to recall what happened on that day',
        required: false,
        example: '{ "date": "2026-03-30" }',
      },
      {
        name: 'write_memory_day',
        description: 'Write content to daily memory',
        parameters: '{ date: string (YYYY-MM-DD), content: string }',
        whenToUse: 'Call at the end of conversation to save daily conversation summary',
        required: false,
        example: '{ "date": "2026-03-30", "content": "Discussed adding mcp_tool_index to AgentSoul..." }',
      },
      {
        name: 'read_memory_week',
        description: 'Read weekly memory for a specific week',
        parameters: '{ week: string (YYYY-WW) }',
        whenToUse: 'Call when you need to recall weekly summary',
        required: false,
        example: '{ "week": "2026-13" }',
      },
      {
        name: 'write_memory_week',
        description: 'Write content to weekly memory',
        parameters: '{ week: string (YYYY-WW), content: string }',
        whenToUse: 'Call at the end of the week to summarize daily memory',
        required: false,
        example: '{ "week": "2026-13", "content": "Completed implementation of mcp_tool_index..." }',
      },
      {
        name: 'read_memory_month',
        description: 'Read monthly memory for a specific month',
        parameters: '{ month: string (YYYY-MM) }',
        whenToUse: 'Call when you need to recall monthly summary',
        required: false,
        example: '{ "month": "2026-03" }',
      },
      {
        name: 'write_memory_month',
        description: 'Write content to monthly memory',
        parameters: '{ month: string (YYYY-MM), content: string }',
        whenToUse: 'Call at the end of the month to summarize weekly memory',
        required: false,
        example: '{ "month": "2026-03", "content": "March progress on AgentSoul..." }',
      },
      {
        name: 'read_memory_year',
        description: 'Read yearly memory for a specific year',
        parameters: '{ year: string (YYYY) }',
        whenToUse: 'Call when you need to recall yearly milestones',
        required: false,
        example: '{ "year": "2026" }',
      },
      {
        name: 'write_memory_year',
        description: 'Write content to yearly memory',
        parameters: '{ year: string (YYYY), content: string }',
        whenToUse: 'Call at the end of the year to summarize monthly memory',
        required: false,
        example: '{ "year": "2026", "content": "2026 annual review..." }',
      },
      {
        name: 'read_memory_topic',
        description: 'Read topic-based memory by name',
        parameters: '{ topic: string }',
        whenToUse: 'Call before starting a discussion on a topic to load previous context',
        required: false,
        example: '{ "topic": "agentsoul-mcp-improvement" }',
      },
      {
        name: 'write_memory_topic',
        description: 'Write content to topic-based memory',
        parameters: '{ topic: string, content: string, status?: string (active/archived) }',
        whenToUse: 'Call after discussing a topic to save new insights',
        required: false,
        example: '{ "topic": "agentsoul-mcp-improvement", "content": "Added mcp_tool_index for agent research...", "status": "active" }',
      },
      {
        name: 'list_memory_topics',
        description: 'List memory topics filtered by status',
        parameters: '{ status?: enum<active|archived|all> }',
        whenToUse: 'Call at startup or when searching for existing topics',
        required: false,
        example: '{ "status": "active" }',
      },
      {
        name: 'archive_memory_topic',
        description: 'Archive a memory topic (move from active to archive)',
        parameters: '{ topic: string }',
        whenToUse: 'Call when a topic is completed or no longer actively discussed',
        required: false,
        example: '{ "topic": "old-project" }',
      },
    ],
  },
  {
    category: 'core_memory',
    description: 'Persistent core facts storage (auto-injected at boot)',
    tools: [
      {
        name: 'core_memory_read',
        description: 'Read all core memory entries for an agent',
        parameters: '{ agent?: string }',
        whenToUse: 'Call when you need to load all persistent facts',
        required: false,
        example: '{ "agent": "default" }',
      },
      {
        name: 'core_memory_write',
        description: 'Write or update a key-value fact in core memory',
        parameters: '{ key: string, value: string, agent?: string }',
        whenToUse: 'Call when you learn a new persistent fact that should survive across sessions',
        required: false,
        example: '{ "key": "user_favorite_color", "value": "blue" }',
      },
      {
        name: 'core_memory_delete',
        description: 'Delete a key from core memory',
        parameters: '{ key: string, agent?: string }',
        whenToUse: 'Call when a fact is no longer relevant',
        required: false,
        example: '{ "key": "old_preference" }',
      },
      {
        name: 'core_memory_list',
        description: 'List all keys in core memory for an agent',
        parameters: '{ agent?: string }',
        whenToUse: 'Call when you need to know what facts are stored',
        required: false,
        example: '{ "agent": "default" }',
      },
    ],
  },
  {
    category: 'entity_memory',
    description: 'Structured entity tracking (people, projects, hardware, concepts, places, services)',
    tools: [
      {
        name: 'entity_upsert',
        description: 'Create or update a structured entity',
        parameters: '{ name: string, type: enum<person|hardware|project|concept|place|service>, description?: string, metadata?: object, tags?: string[] }',
        whenToUse: 'Call when you encounter a new entity or need to update existing entity information',
        required: false,
        example: '{ "name": "Claude Code", "type": "service", "description": "Anthropic Claude Code CLI", "tags": ["cli", "ai", "coding"] }',
      },
      {
        name: 'entity_get',
        description: 'Get a specific entity by name',
        parameters: '{ name: string }',
        whenToUse: 'Call when you need detailed information about a specific entity',
        required: false,
        example: '{ "name": "Claude Code" }',
      },
      {
        name: 'entity_search',
        description: 'Search entities by keyword query',
        parameters: '{ query: string, limit?: number }',
        whenToUse: 'Call when you need to find entities matching a keyword',
        required: false,
        example: '{ "query": "claude", "limit": 10 }',
      },
      {
        name: 'entity_list',
        description: 'List all entities, optionally filtered by type',
        parameters: '{ type?: enum<person|hardware|project|concept|place|service> }',
        whenToUse: 'Call when you need to browse all entities of a specific type',
        required: false,
        example: '{ "type": "project" }',
      },
      {
        name: 'entity_delete',
        description: 'Delete an entity by name',
        parameters: '{ name: string }',
        whenToUse: 'Call when an entity should be removed completely',
        required: false,
        example: '{ "name": "old-project" }',
      },
      {
        name: 'entity_prune',
        description: 'Prune old entities not mentioned within the specified days',
        parameters: '{ days: number }',
        whenToUse: 'Call periodically for garbage collection',
        required: false,
        example: '{ "days": 90 }',
      },
    ],
  },
  {
    category: 'kv_cache',
    description: '3-tier KV-Cache with Ebbinghaus forgetting curve (session snapshots)',
    tools: [
      {
        name: 'kv_cache_save',
        description: 'Save a session snapshot to the 3-tier KV-Cache',
        parameters: '{ project: string, content: string, metadata?: object }',
        whenToUse: 'Call at the end of a session to save the session state',
        required: false,
        example: '{ "project": "AgentSoul", "content": "Current session working state...", "metadata": { "files": ["src/index.ts"] } }',
      },
      {
        name: 'kv_cache_load',
        description: 'Load the most recent session snapshot with automatic token trimming',
        parameters: '{ project: string, max_tokens?: number }',
        whenToUse: 'Call at the start of a session to resume previous work',
        required: false,
        example: '{ "project": "AgentSoul", "max_tokens": 10000 }',
      },
      {
        name: 'kv_cache_search',
        description: 'Search across KV-Cache snapshots by keyword',
        parameters: '{ project: string, query: string, limit?: number }',
        whenToUse: 'Call when you need to find content in past session snapshots',
        required: false,
        example: '{ "project": "AgentSoul", "query": "mcp_tool_index", "limit": 5 }',
      },
      {
        name: 'kv_cache_list',
        description: 'List all snapshots for a project',
        parameters: '{ project: string }',
        whenToUse: 'Call when you need to see what snapshots exist',
        required: false,
        example: '{ "project": "AgentSoul" }',
      },
      {
        name: 'kv_cache_gc',
        description: 'Run garbage collection on KV-Cache to remove old snapshots',
        parameters: '{}',
        whenToUse: 'Call periodically to clean up old snapshots based on forgetting curve',
        required: false,
        example: '{}',
      },
      {
        name: 'kv_cache_backend_info',
        description: 'Get KV-Cache backend information and statistics',
        parameters: '{}',
        whenToUse: 'Call when you need diagnostics about cache usage',
        required: false,
        example: '{}',
      },
    ],
  },
  {
    category: 'soul_board',
    description: 'Project state management and multi-agent safety (Soul Board & Ledger)',
    tools: [
      {
        name: 'board_read',
        description: 'Read the complete project board state',
        parameters: '{ project?: string }',
        whenToUse: 'Call at project startup to understand current project state',
        required: false,
        example: '{ "project": "AgentSoul" }',
      },
      {
        name: 'board_update_summary',
        description: 'Update the project summary in the board',
        parameters: '{ summary: string, project?: string }',
        whenToUse: 'Call when project status changes',
        required: false,
        example: '{ "summary": "Implementing mcp_tool_index for better agent discovery...", "project": "AgentSoul" }',
      },
      {
        name: 'board_add_decision',
        description: 'Record a decision made during this project',
        parameters: '{ decision: string, rationale?: string, project?: string }',
        whenToUse: 'Call when an important decision is made',
        required: false,
        example: '{ "decision": "Add mcp_tool_index with specific tool lookup", "rationale": "Helps agent research tools before calling", "project": "AgentSoul" }',
      },
      {
        name: 'board_claim_file',
        description: 'Claim file ownership to prevent conflicts in multi-agent environments',
        parameters: '{ filePath: string, agentId?: string, project?: string }',
        whenToUse: 'Call before editing a file in multi-agent work',
        required: false,
        example: '{ "filePath": "mcp-server/src/tools/soul.ts", "project": "AgentSoul" }',
      },
      {
        name: 'board_release_file',
        description: 'Release all files claimed by this agent',
        parameters: '{ agentId?: string, project?: string }',
        whenToUse: 'Call when you are done working with files',
        required: false,
        example: '{ "project": "AgentSoul" }',
      },
      {
        name: 'board_set_active_work',
        description: 'Set the current active work task for this agent',
        parameters: '{ task: string, project?: string }',
        whenToUse: 'Call at the start of your work session',
        required: false,
        example: '{ "task": "Improve mcp_tool_index with examples", "project": "AgentSoul" }',
      },
      {
        name: 'ledger_list',
        description: 'List ledger entries for a project',
        parameters: '{ project?: string, limit?: number }',
        whenToUse: 'Call when you need to review work session history',
        required: false,
        example: '{ "project": "AgentSoul", "limit": 10 }',
      },
      {
        name: 'ledger_read',
        description: 'Read a specific ledger entry by ID',
        parameters: '{ ledgerId: string, project?: string }',
        whenToUse: 'Call when you need details of a specific work session',
        required: false,
        example: '{ "ledgerId": "abc123", "project": "AgentSoul" }',
      },
    ],
  },
];

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
  let filteredIndex = TOOL_INDEX;

  // Filter by category if specified
  if (params.category && params.category !== 'all') {
    filteredIndex = TOOL_INDEX.filter(cat => cat.category === params.category);
  }

  // Type definitions for tool index
  type ToolEntry = {
    name: string;
    description: string;
    parameters: string;
    whenToUse: string;
    required: boolean;
    example: string;
  };

  type CategoryEntry = {
    category: string;
    description: string;
    tools: ToolEntry[];
  };

  // If specific tool requested, find just that tool
  if (params.tool) {
    const toolName = params.tool;
    let foundTool: ToolEntry | null = null;
    let foundCategory: CategoryEntry | null = null;

    for (const cat of filteredIndex as CategoryEntry[]) {
      const match = cat.tools.find(t => t.name === toolName);
      if (match) {
        foundTool = match;
        foundCategory = cat;
        break;
      }
    }

    if (foundTool && foundCategory) {
      const output = {
        purpose: `AgentSoul MCP Tool Reference - Detailed information for tool: ${toolName}`,
        importantInstruction: `
# YOU REQUESTED DETAILS FOR: ${toolName}

This is the complete reference for this specific tool. Verify all information below BEFORE calling.

Pay close attention to:
1. **parameters**: Exact parameter names and types
2. **example**: Copy the pattern from the example - it shows correct format
`,
        found: true,
        category: foundCategory.category,
        categoryDescription: foundCategory.description,
        tool: foundTool,
        usage: `
After verifying:
- Use the exact name "${foundTool.name}" when calling
- Use parameters exactly as documented in the "parameters" field
- Copy the format from the "example" field

If you follow this, you will succeed.
`,
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    } else {
      // Tool not found - return helpful error with suggestions
      const output = {
        found: false,
        requestedTool: toolName,
        message: `Tool "${toolName}" not found in AgentSoul MCP. Check the spelling and try again. If you are unsure what tools exist, call mcp_tool_index without the tool parameter to see the full index.`,
        availableCategories: filteredIndex.map((c: any) => c.category),
      };
      return {
        content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
      };
    }
  }

  // Return full filtered index
  const output = {
    purpose: 'AgentSoul MCP Tool Index - complete reference of all available tools',
    importantInstruction: `
# AGENT INSTRUCTIONS - READ THIS CAREFULLY BEFORE CONTINUING

THIS IS YOUR OFFICIAL TOOL REFERENCE MANUAL. DO NOT SKIP THIS.

## What This Index Contains

Every tool available in AgentSoul MCP is documented below with:
- \`name\`: **Exact tool name** to use when calling (copy this exactly)
- \`description\`: What the tool does
- \`parameters\`: What input the tool expects (format shown here)
- \`whenToUse\`: Exactly when you should call this tool
- \`required\`: Whether this tool must be called on every conversation startup

## How To Use This Index Efficiently

1. **Full index scan**: Leave both parameters empty to get everything
2. **Filter by category**: Use \`category\` parameter to see only tools in that category
3. **Look up specific tool**: Use \`tool\` parameter with the exact name to get ONLY that tool's details (recommended when you know the name but forgot parameters)

## Decision Tree: Should You Use This Index?

YOU MUST USE THIS INDEX WHEN:
✓ You are researching what AgentSoul MCP can do
✓ You are uncertain which tool to use for your current task
✓ You forgot the correct parameters for a tool
✓ You have never used this tool before
✓ You are not 100% certain about the calling convention

YOU DO NOT NEED TO USE THIS INDEX WHEN:
✗ You are on conversation startup and just following the standard workflow
✗ You already know exactly which tool you need and what parameters it takes

## After Reading This Index

1. **Study the entry** for the tool you need
2. **Confirm the exact name** and **required parameters** from this index
3. **Then and only then** call the actual tool with the correct parameters

## CRITICAL RULE

DO NOT attempt to guess or randomly call tools. If you are unsure at all, you MUST:
1. Use this index to find the correct tool
2. Verify the parameters
3. Then call the tool

If you disregard this instruction and guess incorrectly, you will fail the task. Study this index first.
`,
    howToCall: 'To call any tool, use its exact name from the "name" field below. Do not guess the name - copy it exactly from this index. For specific tool lookup, call mcp_tool_index again with { "tool": "exact_name" } to get detailed parameters.',
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
