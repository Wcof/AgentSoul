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
