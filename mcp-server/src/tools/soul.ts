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

// 静态指南缓存
const USAGE_GUIDE = `# AgentSoul MCP Usage Guide

This is the Model Context Protocol server for AgentSoul - a general-purpose AI Agent personality framework with affective computing and hierarchical memory.

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
| \`get_persona_config\` | Conversation startup |
| \`get_soul_state\` | Before responding |
| \`update_soul_state\` | After conversation, update emotion |
| \`get_base_rules\` | When you need to recheck system rules |
| \`get_mcp_usage_guide\` | When you need to confirm the workflow |
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
