/**
 * @fileoverview 增强记忆工具模块
 * @description 提供智能记忆管理功能，包括高级搜索、标签管理和优先级控制
 */

import { z } from 'zod';
import { ToolResponse } from '../types.js';
import { readJson, writeJson } from '../lib/utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import path from 'path';

/** 优先级类型定义 */
type PriorityLevel = 'low' | 'medium' | 'high';

/** 记忆索引条目 */
interface MemoryIndexEntry {
  memory_id: string;
  content: string;
  relevance: number;
  tags: string[];
  last_accessed: string;
  priority: PriorityLevel;
  created: string;
}

/** 标签统计条目 */
interface TagStat {
  name: string;
  count: number;
  last_used: string;
}

/**
 * 读取 JSON 文件工具函数
 */
const readJsonFile = readJson;

/**
 * 写入 JSON 文件工具函数
 */
const writeJsonFile = writeJson;

/**
 * 搜索记忆 Schema
 */
export const SearchMemorySchema = z.object({
  /** 搜索关键词 */
  query: z.string(),
  /** 起始日期 (YYYY-MM-DD) */
  start_date: z.string().optional(),
  /** 结束日期 (YYYY-MM-DD) */
  end_date: z.string().optional(),
  /** 标签过滤 */
  tags: z.array(z.string()).optional(),
  /** 优先级过滤 */
  priority: z.enum(['low', 'medium', 'high']).optional(),
  /** 返回结果限制 */
  limit: z.number().optional(),
});

/**
 * 搜索增强记忆
 * @param params 搜索参数
 * @returns 搜索结果
 */
export async function handleSearchMemory(
  params: z.infer<typeof SearchMemorySchema>
): Promise<ToolResponse> {
  try {
    const { query, start_date, end_date, tags, priority, limit = 10 } = params;
    const indexPath = path.join(PROJECT_ROOT, 'data', 'memories', 'index.json');
    const index = readJsonFile<MemoryIndexEntry[]>(indexPath) || [];

    // 简单过滤搜索（实际模糊搜索由 Python 逻辑处理，这里只做基本过滤）
    let results = [...index];

    // 日期过滤
    if (start_date) {
      results = results.filter(r => r.created >= start_date);
    }
    if (end_date) {
      results = results.filter(r => r.created <= end_date);
    }

    // 标签过滤
    if (tags && tags.length > 0) {
      results = results.filter(r => tags.every(t => r.tags?.includes(t)));
    }

    // 优先级过滤
    if (priority) {
      results = results.filter(r => r.priority === priority);
    }

    // 关键词简单搜索
    if (query) {
      const queryLower = query.toLowerCase();
      results = results.filter(r =>
        r.content?.toLowerCase().includes(queryLower) ||
        r.tags?.some(t => t.toLowerCase().includes(queryLower))
      );
    }

    // 限制结果数量
    results = results.slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            total: results.length,
            data: results.map(r => ({
              memory_id: r.memory_id,
              content: r.content,
              relevance: r.relevance || 1.0,
              tags: r.tags || [],
              last_accessed: r.last_accessed || r.created,
              priority: r.priority || 'medium',
            })),
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 添加标签 Schema
 */
export const TagMemorySchema = z.object({
  /** 记忆 ID */
  memoryId: z.string(),
  /** 要添加的标签列表 */
  tags: z.array(z.string()),
});

/**
 * 为记忆添加标签
 * @param params 参数
 * @returns 操作结果
 */
export async function handleTagMemory(
  params: z.infer<typeof TagMemorySchema>
): Promise<ToolResponse> {
  try {
    const { memoryId, tags } = params;
    const indexPath = path.join(PROJECT_ROOT, 'data', 'memories', 'index.json');
    const index = readJsonFile<MemoryIndexEntry[]>(indexPath) || [];

    const memoryIndex = index.findIndex(m => m.memory_id === memoryId);
    if (memoryIndex >= 0) {
      // 添加标签（去重）
      const existingTags = index[memoryIndex].tags || [];
      const newTags = [...new Set([...existingTags, ...tags])];
      index[memoryIndex].tags = newTags;
      writeJsonFile(indexPath, index);

      // 更新标签统计
      const tagsPath = path.join(PROJECT_ROOT, 'data', 'memories', 'tags.json');
      const tagStats = readJsonFile<TagStat[]>(tagsPath) || [];
      tags.forEach(tag => {
        const existing = tagStats.find(t => t.name === tag);
        if (existing) {
          existing.count += 1;
          existing.last_used = new Date().toISOString();
        } else {
          tagStats.push({
            name: tag,
            count: 1,
            last_used: new Date().toISOString(),
          });
        }
      });
      writeJsonFile(tagsPath, tagStats);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `成功为记忆 ${memoryId} 添加标签: ${tags.join(', ')}`,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 移除标签 Schema
 */
export const UntagMemorySchema = z.object({
  /** 记忆 ID */
  memoryId: z.string(),
  /** 要移除的标签列表 */
  tags: z.array(z.string()),
});

/**
 * 从记忆移除标签
 * @param params 参数
 * @returns 操作结果
 */
export async function handleUntagMemory(
  params: z.infer<typeof UntagMemorySchema>
): Promise<ToolResponse> {
  try {
    const { memoryId, tags } = params;
    const indexPath = path.join(PROJECT_ROOT, 'data', 'memories', 'index.json');
    const index = readJsonFile<MemoryIndexEntry[]>(indexPath) || [];

    const memoryIndex = index.findIndex(m => m.memory_id === memoryId);
    if (memoryIndex >= 0) {
      // 移除标签
      const existingTags = index[memoryIndex].tags || [];
      index[memoryIndex].tags = existingTags.filter(t => !tags.includes(t));
      writeJsonFile(indexPath, index);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `成功从记忆 ${memoryId} 移除标签: ${tags.join(', ')}`,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 获取记忆标签 Schema
 */
export const GetMemoryTagsSchema = z.object({
  /** 记忆 ID */
  memoryId: z.string(),
});

/**
 * 获取记忆的所有标签
 * @param params 参数
 * @returns 标签列表
 */
export async function handleGetMemoryTags(
  params: z.infer<typeof GetMemoryTagsSchema>
): Promise<ToolResponse> {
  try {
    const { memoryId } = params;
    const indexPath = path.join(PROJECT_ROOT, 'data', 'memories', 'index.json');
    const index = readJsonFile<MemoryIndexEntry[]>(indexPath) || [];

    const memory = index.find(m => m.memory_id === memoryId);
    const tags = memory?.tags || [];

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: tags,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 列出所有标签 Schema
 */
export const ListTagsSchema = z.object({
  /** 最小使用次数 */
  min_count: z.number().optional(),
});

/**
 * 列出所有标签及其统计
 * @param params 参数
 * @returns 标签列表
 */
export async function handleListTags(
  params: z.infer<typeof ListTagsSchema>
): Promise<ToolResponse> {
  try {
    const { min_count = 1 } = params;
    const tagsPath = path.join(PROJECT_ROOT, 'data', 'memories', 'tags.json');
    const tags = readJsonFile<TagStat[]>(tagsPath) || [];

    let filteredTags = tags;
    if (min_count > 1) {
      filteredTags = tags.filter(t => t.count >= min_count);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: filteredTags.map(t => ({
              name: t.name,
              count: t.count,
              last_used: t.last_used,
            })),
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 设置记忆优先级 Schema
 */
export const SetMemoryPrioritySchema = z.object({
  /** 记忆 ID */
  memoryId: z.string(),
  /** 优先级 */
  priority: z.enum(['high', 'medium', 'low']),
});

/**
 * 设置记忆优先级
 * @param params 参数
 * @returns 操作结果
 */
export async function handleSetMemoryPriority(
  params: z.infer<typeof SetMemoryPrioritySchema>
): Promise<ToolResponse> {
  try {
    const { memoryId, priority } = params;
    const indexPath = path.join(PROJECT_ROOT, 'data', 'memories', 'index.json');
    const index = readJsonFile<MemoryIndexEntry[]>(indexPath) || [];

    const memoryIndex = index.findIndex(m => m.memory_id === memoryId);
    if (memoryIndex >= 0) {
      index[memoryIndex].priority = priority;
      writeJsonFile(indexPath, index);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `成功将记忆 ${memoryId} 的优先级设置为 ${priority}`,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}

/**
 * 获取高优先级记忆 Schema
 */
export const GetHighPriorityMemoriesSchema = z.object({
  /** 返回结果限制 */
  limit: z.number().optional(),
});

/**
 * 获取高优先级记忆列表
 * @param params 参数
 * @returns 高优先级记忆列表
 */
export async function handleGetHighPriorityMemories(
  params: z.infer<typeof GetHighPriorityMemoriesSchema>
): Promise<ToolResponse> {
  try {
    const { limit = 20 } = params;
    const indexPath = path.join(PROJECT_ROOT, 'data', 'memories', 'index.json');
    const index = readJsonFile<MemoryIndexEntry[]>(indexPath) || [];

    const highPriority = index
      .filter(m => m.priority === 'high')
      .slice(0, limit);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: highPriority,
          }),
        },
      ],
    };
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: (error as Error).message,
          }),
        },
      ],
    };
  }
}
