/**
 * @fileoverview KV-Cache 工具模块
 * @description 提供三级缓存工具的 MCP 工具接口，包括保存、加载、搜索、列表、垃圾回收和后端信息查询等功能
 */

import { z } from 'zod';
import { SoulKVCache } from '../lib/kv-cache/index.js';
import config from '../lib/config.js';
import type { ToolResponse } from '../types.js';

/** KV-Cache 保存数据的 Schema 定义 */
const KVCacheSaveSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 本次会话的摘要 */
  summary: z.string(),
  /** 决策记录列表 */
  decisions: z.array(z.string()).optional(),
  /** 变更的文件列表 */
  files_changed: z.array(z.union([z.string(), z.object({ path: z.string(), desc: z.string().optional() })])).optional(),
  /** 待办事项列表 */
  todo: z.array(z.string()).optional(),
  /** 父会话 ID */
  parent_session_id: z.string().optional(),
  /** Agent 名称 */
  agent: z.string().optional(),
});

/** KV-Cache 加载数据的 Schema 定义 */
const KVCacheLoadSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** Token 预算限制 */
  token_budget: z.number().optional(),
});

/** KV-Cache 搜索数据的 Schema 定义 */
const KVCacheSearchSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 搜索查询字符串 */
  query: z.string(),
  /** 返回结果数量限制 */
  limit: z.number().optional(),
});

/** KV-Cache 列表快照的 Schema 定义 */
const KVCacheListSchema = z.object({
  /** 项目名称 */
  project: z.string(),
  /** 返回结果数量限制 */
  limit: z.number().optional(),
});

/** KV-Cache 垃圾回收的 Schema 定义 */
const KVCacheGcSchema = z.object({
  /** 项目名称（可选，默认为 'default'） */
  project: z.string().optional(),
});

/** KV-Cache 后端信息查询的 Schema 定义 */
const KVCacheBackendInfoSchema = z.object({
  /** 项目名称 */
  project: z.string(),
});

/** KV-Cache 保存操作的输入类型 */
type KVCacheSaveInput = z.infer<typeof KVCacheSaveSchema>;
/** KV-Cache 加载操作的输入类型 */
type KVCacheLoadInput = z.infer<typeof KVCacheLoadSchema>;
/** KV-Cache 搜索操作的输入类型 */
type KVCacheSearchInput = z.infer<typeof KVCacheSearchSchema>;
/** KV-Cache 列表操作的输入类型 */
type KVCacheListInput = z.infer<typeof KVCacheListSchema>;
/** KV-Cache 垃圾回收操作的输入类型 */
type KVCacheGcInput = z.infer<typeof KVCacheGcSchema>;
/** KV-Cache 后端信息查询操作的输入类型 */
type KVCacheBackendInfoInput = z.infer<typeof KVCacheBackendInfoSchema>;

/** KV-Cache 实例缓存（单例模式） */
let _kvCache: SoulKVCache | null = null;

/**
 * 获取 KV-Cache 实例（单例模式）
 * @returns SoulKVCache 实例
 */
function getKVCache(): SoulKVCache {
  if (!_kvCache) {
    _kvCache = new SoulKVCache(config.DATA_DIR, config.KV_CACHE);
  }
  return _kvCache;
}

/**
 * 处理 KV-Cache 保存请求
 * @param input 保存操作的输入参数
 * @returns 工具响应，包含保存的记录 ID
 */
export async function handleKvCacheSave(input: KVCacheSaveInput): Promise<ToolResponse> {
  const cache = getKVCache();
  // 处理文件变更列表，统一格式
  const filesChanged = input.files_changed?.map(f => {
    if (typeof f === 'string') return f;
    return { path: f.path, desc: f.desc };
  });

  // 调用缓存保存方法
  const id = await cache.save(input.agent || 'default', input.project, {
    summary: input.summary,
    decisions: input.decisions,
    filesCreated: filesChanged,
    filesModified: [],
    filesDeleted: [],
    todo: input.todo,
    parentSessionId: input.parent_session_id,
  });

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ id }),
    }],
  };
}

/**
 * 处理 KV-Cache 加载请求
 * @param input 加载操作的输入参数
 * @returns 工具响应，包含加载的缓存数据
 */
export async function handleKvCacheLoad(input: KVCacheLoadInput): Promise<ToolResponse> {
  const cache = getKVCache();
  const result = await cache.load(input.project, { budget: input.token_budget });
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result),
    }],
  };
}

/**
 * 处理 KV-Cache 搜索请求
 * @param input 搜索操作的输入参数
 * @returns 工具响应，包含搜索结果
 */
export async function handleKvCacheSearch(input: KVCacheSearchInput): Promise<ToolResponse> {
  const cache = getKVCache();
  const results = await cache.search(input.query, input.project, input.limit);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(results),
    }],
  };
}

/**
 * 处理 KV-Cache 列表快照请求
 * @param input 列表操作的输入参数
 * @returns 工具响应，包含快照列表
 */
export async function handleKvCacheList(input: KVCacheListInput): Promise<ToolResponse> {
  const cache = getKVCache();
  const results = await cache.listSnapshots(input.project, input.limit);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(results),
    }],
  };
}

/**
 * 处理 KV-Cache 垃圾回收请求
 * @param input 垃圾回收操作的输入参数
 * @returns 工具响应，包含垃圾回收结果
 */
export async function handleKvCacheGc(input: KVCacheGcInput): Promise<ToolResponse> {
  const cache = getKVCache();
  const project = input.project || 'default';
  const result = await cache.gc(project);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result),
    }],
  };
}

/**
 * 处理 KV-Cache 后端信息查询请求
 * @param input 后端信息查询操作的输入参数
 * @returns 工具响应，包含后端信息
 */
export async function handleKvCacheBackendInfo(input: KVCacheBackendInfoInput): Promise<ToolResponse> {
  const cache = getKVCache();
  const result = await cache.backendInfo(input.project);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result),
    }],
  };
}

export {
  KVCacheSaveSchema,
  KVCacheLoadSchema,
  KVCacheSearchSchema,
  KVCacheListSchema,
  KVCacheGcSchema,
  KVCacheBackendInfoSchema,
};
