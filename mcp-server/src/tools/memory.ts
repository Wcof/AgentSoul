// AgentSoul MCP - Memory storage tools
// Handles non-working memory: daily notes and topic-based memory

import { z } from 'zod';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';

const storage = new StorageManager();

// Read daily memory for a specific date
export const ReadMemoryDaySchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

export async function handleReadMemoryDay(
  params: z.infer<typeof ReadMemoryDaySchema>
): Promise<ToolResponse> {
  const content = storage.readDailyMemory(params.date);

  if (content === null) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              found: false,
              content: null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            found: true,
            date: params.date,
            content: content,
          },
          null,
          2
        ),
      },
    ],
  };
}

// Write daily memory
export const WriteMemoryDaySchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

export async function handleWriteMemoryDay(
  params: z.infer<typeof WriteMemoryDaySchema>
): Promise<ToolResponse> {
  const { date, content, append } = params;

  let fullContent = content;
  if (append) {
    const existing = storage.readDailyMemory(date);
    if (existing !== null) {
      fullContent = existing + '\n\n' + content;
    }
  }

  const success = storage.writeDailyMemory(date, fullContent);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success,
            date,
            mode: append ? 'append' : 'overwrite',
          },
          null,
          2
        ),
      },
    ],
  };
}

// Read topic memory
export const ReadMemoryTopicSchema = z.object({
  topic: z.string().describe('Topic name'),
});

export async function handleReadMemoryTopic(
  params: z.infer<typeof ReadMemoryTopicSchema>
): Promise<ToolResponse> {
  const content = storage.readTopicMemory(params.topic);

  if (content === null) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              found: false,
              topic: params.topic,
              content: null,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            found: true,
            topic: params.topic,
            content: content,
          },
          null,
          2
        ),
      },
    ],
  };
}

// Write topic memory
export const WriteMemoryTopicSchema = z.object({
  topic: z.string().describe('Topic name'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

export async function handleWriteMemoryTopic(
  params: z.infer<typeof WriteMemoryTopicSchema>
): Promise<ToolResponse> {
  const { topic, content, append } = params;

  let fullContent = content;
  if (append) {
    const existing = storage.readTopicMemory(topic);
    if (existing !== null) {
      fullContent = existing + '\n\n' + content;
    }
  }

  const success = storage.writeTopicMemory(topic, fullContent);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success,
            topic,
            mode: append ? 'append' : 'overwrite',
          },
          null,
          2
        ),
      },
    ],
  };
}

// List memory topics by status
export const ListMemoryTopicsSchema = z.object({
  status: z.enum(['active', 'archived', 'all']).optional().default('active'),
});

export async function handleListMemoryTopics(
  params: z.infer<typeof ListMemoryTopicsSchema>
): Promise<ToolResponse> {
  const allTopics = storage.listMemoryTopics();
  const filtered = params.status === 'all'
    ? allTopics
    : allTopics.filter(t => t.status === params.status);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            count: filtered.length,
            topics: filtered,
          },
          null,
          2
        ),
      },
    ],
  };
}

// Archive a topic
export const ArchiveMemoryTopicSchema = z.object({
  topic: z.string().describe('Topic name to archive'),
});

export async function handleArchiveMemoryTopic(
  params: z.infer<typeof ArchiveMemoryTopicSchema>
): Promise<ToolResponse> {
  const success = storage.archiveTopic(params.topic);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success,
            topic: params.topic,
          },
          null,
          2
        ),
      },
    ],
  };
}
