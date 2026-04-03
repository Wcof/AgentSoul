/**
 * @fileoverview 增强记忆工具模块
 * @description 提供智能记忆管理功能，包括高级搜索、标签管理和优先级控制
 * Aligned with Python memory_enhanced module data structure
 */

import { z } from 'zod';
import { ToolResponse } from '../types.js';
import { readJson, writeJson } from '../lib/utils.js';
import { PROJECT_ROOT } from '../lib/paths.js';
import path from 'path';
import fs from 'fs';

/** Priority level type */
type PriorityLevel = 'low' | 'medium' | 'high';

/** Memory data structure (Python format) */
interface MemoryData {
  memory_id: string;
  content: string;
  tags?: string[];
  priority?: PriorityLevel;
  created_at: string;
  last_accessed: string;
}

/** Tags index (Python format) */
interface TagsIndex {
  tags: { [name: string]: { count: number; last_used: string } };
  memory_tags: { [memory_id: string]: string[] };
}

/** Priority index (Python format) */
interface PriorityIndex {
  priorities: { [memory_id: string]: { level: PriorityLevel; access_count: number; last_accessed: string; manual_override: boolean } };
}

/** TagStat output type */
interface TagStatOutput {
  name: string;
  count: number;
  last_used: string;
}

/**
 * Read JSON file tool function
 */
const readJsonFile = readJson;

/**
 * Write JSON file tool function
 */
const writeJsonFile = writeJson;

/**
 * Search memory Schema
 */
export const SearchMemorySchema = z.object({
  /** Search query keywords */
  query: z.string(),
  /** Start date (YYYY-MM-DD) */
  start_date: z.string().optional(),
  /** End date (YYYY-MM-DD) */
  end_date: z.string().optional(),
  /** Tags filter (AND semantics - all tags must match) */
  tags: z.array(z.string()).optional(),
  /** Priority filter */
  priority: z.enum(['low', 'medium', 'high']).optional(),
  /** Max results limit */
  limit: z.number().optional(),
});

/**
 * Search enhanced memory (aligned with Python data format)
 * @param params Search parameters
 * @returns Search results
 */
export async function handleSearchMemory(
  params: z.infer<typeof SearchMemorySchema>
): Promise<ToolResponse> {
  try {
    const { query, start_date, end_date, tags, priority, limit = 10 } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');

    // Load all memory files from directory (Python stores each memory as separate JSON)
    let results: any[] = [];

    if (!fs.existsSync(memoriesDir)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ success: true, total: 0, data: [] }),
        }],
      };
    }

    // Read all JSON memory files, skip index files
    const files = fs.readdirSync(memoriesDir).filter(
      f => f.endsWith('.json') && !f.includes('_index') && f !== 'tags.json' && f !== 'index.json'
    );

    for (const file of files) {
      try {
        const memoryPath = path.join(memoriesDir, file);
        const memory = readJsonFile<MemoryData>(memoryPath);
        if (!memory) continue;

        const memoryId = file.replace('.json', '');
        const memoryTags: string[] = memory.tags || [];
        const memoryPriority: PriorityLevel = memory.priority || 'medium';
        const createdAt = memory.created_at || '';
        const lastAccessed = memory.last_accessed || createdAt;

        // Date filtering
        if (start_date && createdAt && createdAt < start_date) continue;
        if (end_date && createdAt && createdAt > end_date) continue;

        // Priority filtering
        if (priority && memoryPriority !== priority) continue;

        // Tags filtering (AND semantics - all tags must match)
        if (tags && tags.length > 0) {
          const memoryTagsLower = memoryTags.map(t => t.toLowerCase());
          const allMatch = tags.every(tag =>
            memoryTagsLower.includes(tag.toLowerCase())
          );
          if (!allMatch) continue;
        }

        // Simple keyword search (full-text matching)
        let matchesQuery = true;
        if (query) {
          const queryLower = query.toLowerCase();
          const contentLower = (memory.content || '').toLowerCase();
          if (!contentLower.includes(queryLower) && !memoryTags.some(t => t.toLowerCase().includes(queryLower))) {
            matchesQuery = false;
          }
        }

        if (matchesQuery) {
          results.push({
            memory_id: memoryId,
            content: memory.content,
            relevance: 1.0,
            tags: memoryTags,
            last_accessed: lastAccessed,
            priority: memoryPriority,
            created: createdAt,
          });
        }
      } catch (e) {
        // Skip corrupted files
        continue;
      }
    }

    // Sort by priority and last accessed (newer/higher priority first)
    const priorityWeights: Record<PriorityLevel, number> = { high: 3, medium: 2, low: 1 };
    results.sort((a, b) => {
      const priorityDiff = priorityWeights[b.priority as PriorityLevel] - priorityWeights[a.priority as PriorityLevel];
      if (priorityDiff !== 0) return priorityDiff;
      return (b.last_accessed || '').localeCompare(a.last_accessed || '');
    });

    // Limit results
    results = results.slice(0, limit);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          total: results.length,
          data: results,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Add tags Schema
 */
export const TagMemorySchema = z.object({
  /** Memory ID */
  memoryId: z.string(),
  /** List of tags to add */
  tags: z.array(z.string()),
});

/**
 * Add tags to memory (aligned with Python format)
 * @param params Parameters
 * @returns Operation result
 */
export async function handleTagMemory(
  params: z.infer<typeof TagMemorySchema>
): Promise<ToolResponse> {
  try {
    const { memoryId, tags } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const tagsIndexPath = path.join(memoriesDir, 'tags_index.json');
    const memoryPath = path.join(memoriesDir, `${memoryId}.json`);

    // Load tags index (Python format)
    let tagsIndex: TagsIndex = { tags: {}, memory_tags: {} };
    if (fs.existsSync(tagsIndexPath)) {
      tagsIndex = readJsonFile<TagsIndex>(tagsIndexPath) || { tags: {}, memory_tags: {} };
    }

    // Ensure memory_tags entry exists
    if (!tagsIndex.memory_tags[memoryId]) {
      tagsIndex.memory_tags[memoryId] = [];
    }

    const existingTags = tagsIndex.memory_tags[memoryId];
    const now = new Date().toISOString();

    // Add new tags (avoid duplicates)
    tags.forEach(tag => {
      const tagLower = tag.trim().toLowerCase();
      if (tagLower && !existingTags.includes(tagLower)) {
        existingTags.push(tagLower);

        if (!tagsIndex.tags[tagLower]) {
          tagsIndex.tags[tagLower] = { count: 0, last_used: now };
        }
        tagsIndex.tags[tagLower].count += 1;
        tagsIndex.tags[tagLower].last_used = now;
      }
    });

    // Save updated tags index
    writeJsonFile(tagsIndexPath, tagsIndex);

    // Update tags in the memory file itself
    if (fs.existsSync(memoryPath)) {
      const memory = readJsonFile<MemoryData>(memoryPath);
      if (memory) {
        // Merge existing tags with new tags
        const currentMemoryTags = memory.tags || [];
        const allTags = [...new Set([...currentMemoryTags, ...tags.map(t => t.trim().toLowerCase())])];
        memory.tags = allTags;
        writeJsonFile(memoryPath, memory);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Successfully added tags to memory ${memoryId}: ${tags.join(', ')}`,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Remove tags Schema
 */
export const UntagMemorySchema = z.object({
  /** Memory ID */
  memoryId: z.string(),
  /** List of tags to remove */
  tags: z.array(z.string()),
});

/**
 * Remove tags from memory
 * @param params Parameters
 * @returns Operation result
 */
export async function handleUntagMemory(
  params: z.infer<typeof UntagMemorySchema>
): Promise<ToolResponse> {
  try {
    const { memoryId, tags } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const tagsIndexPath = path.join(memoriesDir, 'tags_index.json');
    const memoryPath = path.join(memoriesDir, `${memoryId}.json`);

    // Load tags index
    if (!fs.existsSync(tagsIndexPath)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `No tags found for memory ${memoryId}`,
          }),
        }],
      };
    }

    const tagsIndex = readJsonFile<TagsIndex>(tagsIndexPath) || { tags: {}, memory_tags: {} };
    const memoryTags = tagsIndex.memory_tags[memoryId];

    if (!memoryTags) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `No tags found for memory ${memoryId}`,
          }),
        }],
      };
    }

    // Remove requested tags
    tags.forEach(tag => {
      const tagLower = tag.trim().toLowerCase();
      const index = memoryTags.indexOf(tagLower);
      if (index >= 0) {
        memoryTags.splice(index, 1);
        // Decrement count in tag index, remove if count reaches zero
        if (tagsIndex.tags[tagLower]) {
          tagsIndex.tags[tagLower].count -= 1;
          if (tagsIndex.tags[tagLower].count <= 0) {
            delete tagsIndex.tags[tagLower];
          }
        }
      }
    });

    // Clean up empty memory entry
    if (memoryTags.length === 0) {
      delete tagsIndex.memory_tags[memoryId];
    }

    // Save updated index
    writeJsonFile(tagsIndexPath, tagsIndex);

    // Update memory file
    if (fs.existsSync(memoryPath)) {
      const memory = readJsonFile<MemoryData>(memoryPath);
      if (memory && memory.tags) {
        const remainingTags = memory.tags.filter(t => !tags.map(tag => tag.trim().toLowerCase()).includes(t.toLowerCase()));
        memory.tags = remainingTags;
        writeJsonFile(memoryPath, memory);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Successfully removed tags from memory ${memoryId}: ${tags.join(', ')}`,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Get memory tags Schema
 */
export const GetMemoryTagsSchema = z.object({
  /** Memory ID */
  memoryId: z.string(),
});

/**
 * Get all tags for a memory
 * @param params Parameters
 * @returns Tag list
 */
export async function handleGetMemoryTags(
  params: z.infer<typeof GetMemoryTagsSchema>
): Promise<ToolResponse> {
  try {
    const { memoryId } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const tagsIndexPath = path.join(memoriesDir, 'tags_index.json');

    let tags: string[] = [];

    if (fs.existsSync(tagsIndexPath)) {
      const tagsIndex = readJsonFile<TagsIndex>(tagsIndexPath) || { tags: {}, memory_tags: {} };
      tags = tagsIndex.memory_tags[memoryId] || [];
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: tags,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * List all tags Schema
 */
export const ListTagsSchema = z.object({
  /** Minimum usage count */
  min_count: z.number().optional(),
});

/**
 * List all tags with statistics
 * @param params Parameters
 * @returns Tag list
 */
export async function handleListTags(
  params: z.infer<typeof ListTagsSchema>
): Promise<ToolResponse> {
  try {
    const { min_count = 1 } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const tagsIndexPath = path.join(memoriesDir, 'tags_index.json');

    let tags: TagStatOutput[] = [];

    if (fs.existsSync(tagsIndexPath)) {
      const tagsIndex = readJsonFile<TagsIndex>(tagsIndexPath) || { tags: {}, memory_tags: {} };

      tags = Object.entries(tagsIndex.tags)
        .filter(([_, info]) => info.count >= min_count)
        .map(([name, info]) => ({
          name,
          count: info.count,
          last_used: info.last_used,
        }))
        .sort((a, b) => b.count - a.count || b.last_used.localeCompare(a.last_used));
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: tags,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Set memory priority Schema
 */
export const SetMemoryPrioritySchema = z.object({
  /** Memory ID */
  memoryId: z.string(),
  /** Priority level */
  priority: z.enum(['high', 'medium', 'low']),
});

/**
 * Set memory priority
 * @param params Parameters
 * @returns Operation result
 */
export async function handleSetMemoryPriority(
  params: z.infer<typeof SetMemoryPrioritySchema>
): Promise<ToolResponse> {
  try {
    const { memoryId, priority } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const priorityIndexPath = path.join(memoriesDir, 'priority_index.json');
    const memoryPath = path.join(memoriesDir, `${memoryId}.json`);

    // Load priority index
    let priorityIndex: PriorityIndex = { priorities: {} };
    if (fs.existsSync(priorityIndexPath)) {
      priorityIndex = readJsonFile<PriorityIndex>(priorityIndexPath) || { priorities: {} };
    }

    // Update priority
    priorityIndex.priorities[memoryId] = {
      level: priority,
      access_count: priorityIndex.priorities[memoryId]?.access_count || 0,
      last_accessed: new Date().toISOString(),
      manual_override: true,
    };

    // Save priority index
    writeJsonFile(priorityIndexPath, priorityIndex);

    // Update memory file
    if (fs.existsSync(memoryPath)) {
      const memory = readJsonFile<MemoryData>(memoryPath);
      if (memory) {
        memory.priority = priority;
        writeJsonFile(memoryPath, memory);
      }
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Successfully set priority ${priority} for memory ${memoryId}`,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}

/**
 * Get high priority memories Schema
 */
export const GetHighPriorityMemoriesSchema = z.object({
  /** Result limit */
  limit: z.number().optional(),
});

/**
 * Get list of high priority memories
 * @param params Parameters
 * @returns List of high priority memories
 */
export async function handleGetHighPriorityMemories(
  params: z.infer<typeof GetHighPriorityMemoriesSchema>
): Promise<ToolResponse> {
  try {
    const { limit = 20 } = params;
    const memoriesDir = path.join(PROJECT_ROOT, 'data', 'memories');
    const priorityIndexPath = path.join(memoriesDir, 'priority_index.json');

    let highPriority: any[] = [];

    if (fs.existsSync(priorityIndexPath)) {
      const priorityIndex = readJsonFile<PriorityIndex>(priorityIndexPath) || { priorities: {} };

      highPriority = Object.entries(priorityIndex.priorities)
        .filter(([_, info]) => info.level === 'high')
        .map(([memoryId, info]) => ({
          memory_id: memoryId,
          level: info.level,
          access_count: info.access_count,
          last_accessed: info.last_accessed,
        }))
        .sort((a, b) => b.last_accessed.localeCompare(a.last_accessed))
        .slice(0, limit);
    }

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: highPriority,
        }),
      }],
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: (error as Error).message,
        }),
      }],
    };
  }
}
