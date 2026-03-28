/**
 * @fileoverview 核心记忆工具模块
 * @description 提供核心记忆的读写、删除、列表功能，支持多 Agent 隔离存储
 */

import { z } from 'zod';
import { CoreMemory } from '../lib/core-memory.js';
import config from '../lib/config.js';
import type { ToolResponse } from '../types.js';

/** 读取核心记忆的输入参数 Schema */
const CoreMemoryReadSchema = z.object({
  /** Agent 名称，可选，默认为 'default' */
  agent_name: z.string().optional(),
});

/** 写入核心记忆的输入参数 Schema */
const CoreMemoryWriteSchema = z.object({
  /** 记忆键名 */
  key: z.string(),
  /** 记忆值 */
  value: z.string(),
  /** Agent 名称，可选，默认为 'default' */
  agent_name: z.string().optional(),
});

/** 删除核心记忆的输入参数 Schema */
const CoreMemoryDeleteSchema = z.object({
  /** 要删除的记忆键名 */
  key: z.string(),
  /** Agent 名称，可选，默认为 'default' */
  agent_name: z.string().optional(),
});

/** 列出核心记忆键的输入参数 Schema */
const CoreMemoryListSchema = z.object({
  /** Agent 名称，可选，默认为 'default' */
  agent_name: z.string().optional(),
});

/** 读取核心记忆的输入类型 */
type CoreMemoryReadInput = z.infer<typeof CoreMemoryReadSchema>;
/** 写入核心记忆的输入类型 */
type CoreMemoryWriteInput = z.infer<typeof CoreMemoryWriteSchema>;
/** 删除核心记忆的输入类型 */
type CoreMemoryDeleteInput = z.infer<typeof CoreMemoryDeleteSchema>;
/** 列出核心记忆键的输入类型 */
type CoreMemoryListInput = z.infer<typeof CoreMemoryListSchema>;

/** 核心记忆单例实例 */
let _coreMemory: CoreMemory | null = null;

/**
 * 获取核心记忆单例实例
 * @returns 核心记忆实例
 */
function getCoreMemory(): CoreMemory {
  // 懒加载单例模式，首次调用时创建实例
  if (!_coreMemory) {
    _coreMemory = new CoreMemory(config.DATA_DIR);
  }
  return _coreMemory;
}

/**
 * 处理读取核心记忆的请求
 * @param input - 读取请求参数
 * @returns 工具响应结果，包含核心记忆数据的 JSON 字符串
 */
export async function handleCoreMemoryRead(input: CoreMemoryReadInput): Promise<ToolResponse> {
  const memory = getCoreMemory();
  const agentName = input.agent_name || 'default';
  const data = memory.read(agentName);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(data),
    }],
  };
}

/**
 * 处理写入核心记忆的请求
 * @param input - 写入请求参数，包含键、值和可选的 Agent 名称
 * @returns 工具响应结果，包含写入操作结果的 JSON 字符串
 */
export async function handleCoreMemoryWrite(input: CoreMemoryWriteInput): Promise<ToolResponse> {
  const memory = getCoreMemory();
  const agentName = input.agent_name || 'default';
  const result = memory.write(agentName, input.key, input.value);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result),
    }],
  };
}

/**
 * 处理删除核心记忆的请求
 * @param input - 删除请求参数，包含要删除的键和可选的 Agent 名称
 * @returns 工具响应结果，包含删除操作结果的 JSON 字符串
 */
export async function handleCoreMemoryDelete(input: CoreMemoryDeleteInput): Promise<ToolResponse> {
  const memory = getCoreMemory();
  const agentName = input.agent_name || 'default';
  const deleted = memory.remove(agentName, input.key);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ deleted }),
    }],
  };
}

/**
 * 处理列出核心记忆键的请求
 * @param input - 列出请求参数，包含可选的 Agent 名称
 * @returns 工具响应结果，包含核心记忆键列表的 JSON 字符串
 */
export async function handleCoreMemoryList(input: CoreMemoryListInput): Promise<ToolResponse> {
  const memory = getCoreMemory();
  const agentName = input.agent_name || 'default';
  const keys = memory.keys(agentName);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ keys }),
    }],
  };
}

export {
  CoreMemoryReadSchema,
  CoreMemoryWriteSchema,
  CoreMemoryDeleteSchema,
  CoreMemoryListSchema,
};
