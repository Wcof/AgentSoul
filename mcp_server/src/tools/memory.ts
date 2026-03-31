/**
 * @fileoverview 分层记忆存储工具模块
 * @description 处理分层记忆系统，包括日/周/月/年的时间切片记忆和主题记忆的读写操作
 */

import { z } from 'zod';
import { StorageManager } from '../storage.js';
import { ToolResponse } from '../types.js';

const storage = new StorageManager();

/**
 * 通用读取响应生成函数，消除重复代码
 * @param found - 是否找到对应记忆内容
 * @param key - 响应数据的键名（如 date, year_week 等）
 * @param value - 键值
 * @param content - 记忆内容
 * @returns 格式化的工具响应
 */
function makeReadResponse<T>(found: boolean, key: string, value: string, content: string | null): ToolResponse {
  const data = found
    ? { found, [key]: value, content }
    : { found: false, content: null };
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(data),
      },
    ],
  };
}

/**
 * 通用写入响应生成函数
 * @param success - 写入操作是否成功
 * @param key - 响应数据的键名
 * @param value - 键值
 * @param append - 是否是追加模式
 * @returns 格式化的工具响应
 */
function makeWriteResponse(success: boolean, key: string, value: string, append: boolean): ToolResponse {
  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          success,
          [key]: value,
          mode: append ? 'append' : 'overwrite',
        }),
      },
    ],
  };
}

/**
 * 处理追加模式的内容拼接逻辑
 * @param identifier - 记忆标识符
 * @param content - 新内容
 * @param append - 是否追加模式
 * @param readFn - 读取已有内容的函数
 * @returns 处理后的完整内容
 */
function handleAppendRead(
  identifier: string,
  content: string,
  append: boolean,
  readFn: (id: string) => string | null
): string {
  let fullContent = content;
  // 如果是追加模式，读取现有内容并与新内容拼接
  if (append) {
    const existing = readFn(identifier);
    if (existing !== null) {
      fullContent = existing + '\n\n' + content;
    }
  }
  return fullContent;
}

/** 读取特定日期的记忆的参数定义 */
export const ReadMemoryDaySchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
});

/**
 * 处理读取特定日期记忆的函数
 * @param params - 包含日期的参数对象
 * @returns 工具响应对象
 */
export async function handleReadMemoryDay(
  params: z.infer<typeof ReadMemoryDaySchema>
): Promise<ToolResponse> {
  const content = storage.readDailyMemory(params.date);
  return makeReadResponse(content !== null, 'date', params.date, content);
}

/** 写入特定日期记忆的参数定义 */
export const WriteMemoryDaySchema = z.object({
  date: z.string().describe('Date in YYYY-MM-DD format'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

/**
 * 处理写入特定日期记忆的函数
 * @param params - 包含日期、内容、追加标记的参数对象
 * @returns 工具响应对象
 */
export async function handleWriteMemoryDay(
  params: z.infer<typeof WriteMemoryDaySchema>
): Promise<ToolResponse> {
  const { date, content, append } = params;
  const fullContent = handleAppendRead(date, content, append, storage.readDailyMemory.bind(storage));
  const success = storage.writeDailyMemory(date, fullContent);
  return makeWriteResponse(success, 'date', date, append);
}

/** 读取特定周记忆的参数定义 */
export const ReadMemoryWeekSchema = z.object({
  year_week: z.string().describe('Week in YYYY-WW format (e.g. 2024-12)'),
});

/**
 * 处理读取特定周记忆的函数
 * @param params - 包含年周的参数对象
 * @returns 工具响应对象
 */
export async function handleReadMemoryWeek(
  params: z.infer<typeof ReadMemoryWeekSchema>
): Promise<ToolResponse> {
  const content = storage.readWeeklyMemory(params.year_week);
  return makeReadResponse(content !== null, 'year_week', params.year_week, content);
}

/** 写入特定周记忆的参数定义 */
export const WriteMemoryWeekSchema = z.object({
  year_week: z.string().describe('Week in YYYY-WW format (e.g. 2024-12)'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

/**
 * 处理写入特定周记忆的函数
 * @param params - 包含年周、内容、追加标记的参数对象
 * @returns 工具响应对象
 */
export async function handleWriteMemoryWeek(
  params: z.infer<typeof WriteMemoryWeekSchema>
): Promise<ToolResponse> {
  const { year_week, content, append } = params;
  const fullContent = handleAppendRead(year_week, content, append, storage.readWeeklyMemory.bind(storage));
  const success = storage.writeWeeklyMemory(year_week, fullContent);
  return makeWriteResponse(success, 'year_week', year_week, append);
}

/** 读取特定月记忆的参数定义 */
export const ReadMemoryMonthSchema = z.object({
  year_month: z.string().describe('Month in YYYY-MM format (e.g. 2024-03)'),
});

/**
 * 处理读取特定月记忆的函数
 * @param params - 包含年月的参数对象
 * @returns 工具响应对象
 */
export async function handleReadMemoryMonth(
  params: z.infer<typeof ReadMemoryMonthSchema>
): Promise<ToolResponse> {
  const content = storage.readMonthlyMemory(params.year_month);
  return makeReadResponse(content !== null, 'year_month', params.year_month, content);
}

/** 写入特定月记忆的参数定义 */
export const WriteMemoryMonthSchema = z.object({
  year_month: z.string().describe('Month in YYYY-MM format (e.g. 2024-03)'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

/**
 * 处理写入特定月记忆的函数
 * @param params - 包含年月、内容、追加标记的参数对象
 * @returns 工具响应对象
 */
export async function handleWriteMemoryMonth(
  params: z.infer<typeof WriteMemoryMonthSchema>
): Promise<ToolResponse> {
  const { year_month, content, append } = params;
  const fullContent = handleAppendRead(year_month, content, append, storage.readMonthlyMemory.bind(storage));
  const success = storage.writeMonthlyMemory(year_month, fullContent);
  return makeWriteResponse(success, 'year_month', year_month, append);
}

/** 读取特定年记忆的参数定义 */
export const ReadMemoryYearSchema = z.object({
  year: z.string().describe('Year in YYYY format (e.g. 2024)'),
});

/**
 * 处理读取特定年记忆的函数
 * @param params - 包含年份的参数对象
 * @returns 工具响应对象
 */
export async function handleReadMemoryYear(
  params: z.infer<typeof ReadMemoryYearSchema>
): Promise<ToolResponse> {
  const content = storage.readYearlyMemory(params.year);
  return makeReadResponse(content !== null, 'year', params.year, content);
}

/** 写入特定年记忆的参数定义 */
export const WriteMemoryYearSchema = z.object({
  year: z.string().describe('Year in YYYY format (e.g. 2024)'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

/**
 * 处理写入特定年记忆的函数
 * @param params - 包含年份、内容、追加标记的参数对象
 * @returns 工具响应对象
 */
export async function handleWriteMemoryYear(
  params: z.infer<typeof WriteMemoryYearSchema>
): Promise<ToolResponse> {
  const { year, content, append } = params;
  const fullContent = handleAppendRead(year, content, append, storage.readYearlyMemory.bind(storage));
  const success = storage.writeYearlyMemory(year, fullContent);
  return makeWriteResponse(success, 'year', year, append);
}

/** 读取主题记忆的参数定义 */
export const ReadMemoryTopicSchema = z.object({
  topic: z.string().describe('Topic name'),
});

/**
 * 处理读取主题记忆的函数
 * @param params - 包含主题名称的参数对象
 * @returns 工具响应对象
 */
export async function handleReadMemoryTopic(
  params: z.infer<typeof ReadMemoryTopicSchema>
): Promise<ToolResponse> {
  const content = storage.readTopicMemory(params.topic);
  return makeReadResponse(content !== null, 'topic', params.topic, content);
}

/** 写入主题记忆的参数定义 */
export const WriteMemoryTopicSchema = z.object({
  topic: z.string().describe('Topic name'),
  content: z.string().describe('Content to write'),
  append: z.boolean().optional().default(false).describe('Append to existing content instead of overwriting'),
});

/**
 * 处理写入主题记忆的函数
 * @param params - 包含主题名称、内容、追加标记的参数对象
 * @returns 工具响应对象
 */
export async function handleWriteMemoryTopic(
  params: z.infer<typeof WriteMemoryTopicSchema>
): Promise<ToolResponse> {
  const { topic, content, append } = params;
  const fullContent = handleAppendRead(topic, content, append, storage.readTopicMemory.bind(storage));
  const success = storage.writeTopicMemory(topic, fullContent);
  return makeWriteResponse(success, 'topic', topic, append);
}

/** 列出记忆主题的参数定义 */
export const ListMemoryTopicsSchema = z.object({
  status: z.enum(['active', 'archived', 'all']).optional().default('active'),
});

/**
 * 处理列出记忆主题的函数
 * @param params - 包含状态筛选的参数对象
 * @returns 工具响应对象
 */
export async function handleListMemoryTopics(
  params: z.infer<typeof ListMemoryTopicsSchema>
): Promise<ToolResponse> {
  const allTopics = storage.listMemoryTopics();
  // 根据状态筛选主题列表，如果是 'all' 则返回全部
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

/** 归档主题的参数定义 */
export const ArchiveMemoryTopicSchema = z.object({
  topic: z.string().describe('Topic name to archive'),
});

/**
 * 处理归档主题的函数
 * @param params - 包含主题名称的参数对象
 * @returns 工具响应对象
 */
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
