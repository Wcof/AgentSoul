// AgentSoul MCP - Soul-related tools
// Soul handles persona configuration and PAD affective state

import { z } from 'zod';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';

const storage = new StorageManager();

// Get persona configuration
export const GetPersonaConfigSchema = z.object({});

export async function handleGetPersonaConfig(): Promise<ToolResponse> {
  const config = storage.readPersonaConfig();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(config, null, 2),
      },
    ],
  };
}

// Get current soul state (PAD vector)
export const GetSoulStateSchema = z.object({});

export async function handleGetSoulState(): Promise<ToolResponse> {
  const state = storage.readSoulState();

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(state, null, 2),
      },
    ],
  };
}

// Update soul state
export const UpdateSoulStateSchema = z.object({
  pleasure: z.number().min(-1).max(1).optional(),
  arousal: z.number().min(-1).max(1).optional(),
  dominance: z.number().min(-1).max(1).optional(),
  trigger: z.string().optional(),
});

export async function handleUpdateSoulState(
  params: z.infer<typeof UpdateSoulStateSchema>
): Promise<ToolResponse> {
  const current = storage.readSoulState();
  const timestamp = new Date().toISOString();

  // Create new state with updated values
  const newState = {
    ...current,
    pleasure: params.pleasure ?? current.pleasure,
    arousal: params.arousal ?? current.arousal,
    dominance: params.dominance ?? current.dominance,
    last_updated: timestamp,
  };

  // Add to history
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

  // Keep last 100 history entries
  if (newState.history.length > 100) {
    newState.history = newState.history.slice(-100);
  }

  const success = storage.writeSoulState(newState);

  if (success) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: true,
              new_state: newState,
            },
            null,
            2
          ),
        },
      ],
    };
  } else {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              success: false,
              error: 'Failed to write soul state to disk',
            },
            null,
            2
          ),
        },
      ],
    };
  }
}

// Get base rules documentation
export const GetBaseRulesSchema = z.object({
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

  // Security: Level 3 (SEALED) content cannot be output
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

// Get MCP usage guide (for other AI agents to understand how to use AgentSoul MCP)
export const GetMcpUsageGuideSchema = z.object({});

// Static guide cached once
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

const CACHED_RESPONSE: ToolResponse = {
  content: [
    {
      type: 'text',
      text: USAGE_GUIDE,
    },
  ],
};

export async function handleGetMcpUsageGuide(): Promise<ToolResponse> {
  return CACHED_RESPONSE;
}
