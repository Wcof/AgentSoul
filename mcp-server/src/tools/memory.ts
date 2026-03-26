// AgentSoul MCP - Memory storage tools
// Handles hierarchical memory: daily/weekly/monthly/yearly time slices and topic-based memory

import { z } from 'zod';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';

const storage = new StorageManager();

// Generic response helpers to eliminate duplication
function makeReadResponse<T>(found: boolean, key: string, value: string, content: string | null): ToolResponse {
  const data = found
    ? { found, [key]: value, content }
    : { found: false, content: null };
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data, null, 2),
      },
    ],
  };
}

function makeWriteResponse(success: boolean, key: string, value: string, append: boolean): ToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(
          {
            success,
            [key]: value,
            mode: append ? 'append' : 'overwrite',
          },
          null,
          2
        ),
      },
    ],
  };
}

function handleAppendRead(
  identifier: string,
  content: string,
  append: boolean,
  readFn: (id: string) => string | null
): string {
  let fullContent = content;
  if (append) {
    const existing = readFn(identifier);
    if (existing !== null) {
      fullContent = existing + '\n\n' + content;
    }
  }
  return fullContent;
}

// Read daily memory for a specific date
export const ReadMemoryDaySchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

export async function handleReadMemoryDay(
  params: z.infer<typeof ReadMemoryDaySchema>
): Promise<ToolResponse> {
  const content = storage.readDailyMemory(params.date);
  return makeReadResponse(content !== null, 'date', params.date, content);
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
  const fullContent = handleAppendRead(date, content, append, storage.readDailyMemory.bind(storage));
  const success = storage.writeDailyMemory(date, fullContent);
  return makeWriteResponse(success, 'date', date, append);
}

// Read weekly memory for a specific week
export const ReadMemoryWeekSchema = z.object({
  year_week: z.string().describe('Week in YYYY-WW format (e.g. 2024-12)'),
});

export async function handleReadMemoryWeek(
  params: z.infer<typeof ReadMemoryWeekSchema>
): Promise<ToolResponse> {
  const content = storage.readWeeklyMemory(params.year_week);
  return makeReadResponse(content !== null, 'year_week', params.year_week, content);
}

// Write weekly memory
export const WriteMemoryWeekSchema = z.object({
  year_week: z.string().describe('Week in YYYY-WW format (e.g. 2024-12)'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

export async function handleWriteMemoryWeek(
  params: z.infer<typeof WriteMemoryWeekSchema>
): Promise<ToolResponse> {
  const { year_week, content, append } = params;
  const fullContent = handleAppendRead(year_week, content, append, storage.readWeeklyMemory.bind(storage));
  const success = storage.writeWeeklyMemory(year_week, fullContent);
  return makeWriteResponse(success, 'year_week', year_week, append);
}

// Read monthly memory for a specific month
export const ReadMemoryMonthSchema = z.object({
  year_month: z.string().describe('Month in YYYY-MM format (e.g. 2024-03)'),
});

export async function handleReadMemoryMonth(
  params: z.infer<typeof ReadMemoryMonthSchema>
): Promise<ToolResponse> {
  const content = storage.readMonthlyMemory(params.year_month);
  return makeReadResponse(content !== null, 'year_month', params.year_month, content);
}

// Write monthly memory
export const WriteMemoryMonthSchema = z.object({
  year_month: z.string().describe('Month in YYYY-MM format (e.g. 2024-03)'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

export async function handleWriteMemoryMonth(
  params: z.infer<typeof WriteMemoryMonthSchema>
): Promise<ToolResponse> {
  const { year_month, content, append } = params;
  const fullContent = handleAppendRead(year_month, content, append, storage.readMonthlyMemory.bind(storage));
  const success = storage.writeMonthlyMemory(year_month, fullContent);
  return makeWriteResponse(success, 'year_month', year_month, append);
}

// Read yearly memory for a specific year
export const ReadMemoryYearSchema = z.object({
  year: z.string().describe('Year in YYYY format (e.g. 2024)'),
});

export async function handleReadMemoryYear(
  params: z.infer<typeof ReadMemoryYearSchema>
): Promise<ToolResponse> {
  const content = storage.readYearlyMemory(params.year);
  return makeReadResponse(content !== null, 'year', params.year, content);
}

// Write yearly memory
export const WriteMemoryYearSchema = z.object({
  year: z.string().describe('Year in YYYY format (e.g. 2024)'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

export async function handleWriteMemoryYear(
  params: z.infer<typeof WriteMemoryYearSchema>
): Promise<ToolResponse> {
  const { year, content, append } = params;
  const fullContent = handleAppendRead(year, content, append, storage.readYearlyMemory.bind(storage));
  const success = storage.writeYearlyMemory(year, fullContent);
  return makeWriteResponse(success, 'year', year, append);
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
