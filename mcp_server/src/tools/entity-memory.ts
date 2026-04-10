/**
 * @fileoverview 实体记忆工具模块
 * @description 提供实体记忆的 CRUD 操作工具，包括实体的插入、更新、查询、搜索、列表、删除和清理功能
 */

import { z } from 'zod';
import { EntityMemory, EntityFact, Entity } from '../lib/entity-memory.js';
import config from '../lib/config.js';
import type { ToolResponse } from '../types.js';
import type { EntityType } from '../types.js';

/** 实体类型枚举定义 */
const entityTypeEnum = z.enum(['person', 'hardware', 'project', 'concept', 'place', 'service']);

/** 实体插入/更新的输入验证 Schema */
const EntityUpsertSchema = z.object({
  /** 实体类型 */
  type: entityTypeEnum,
  /** 实体名称 */
  name: z.string(),
  /** 实体属性键值对 */
  attributes: z.record(z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});

/** 实体获取的输入验证 Schema */
const EntityGetSchema = z.object({
  /** 实体名称 */
  name: z.string(),
});

/** 实体搜索的输入验证 Schema */
const EntitySearchSchema = z.object({
  /** 搜索查询字符串 */
  query: z.string(),
});

/** 实体列表的输入验证 Schema */
const EntityListSchema = z.object({
  /** 可选的实体类型过滤 */
  type: entityTypeEnum.optional(),
});

/** 实体删除的输入验证 Schema */
const EntityDeleteSchema = z.object({
  /** 实体名称 */
  name: z.string(),
  /** 可选的实体类型 */
  type: entityTypeEnum.optional(),
});

/** 实体清理的输入验证 Schema */
const EntityPruneSchema = z.object({
  /** 最大保留天数，超过此天数的实体将被清理 */
  max_age_days: z.number().optional(),
});

/** 添加时间事实的输入验证 Schema */
const EntityFactAddSchema = z.object({
  /** 实体名称 */
  name: z.string().min(1),
  /** 属性/谓词名称 */
  attribute: z.string().min(1),
  /** 事实值 */
  value: z.string().min(1),
  /** 置信度 0-1，默认为 1.0 */
  confidence: z.number().min(0).max(1).optional(),
  /** 事实来源引用（来自哪个记忆/主题） */
  source_ref: z.string().optional(),
});

/** 失效事实的输入验证 Schema */
const EntityFactInvalidateSchema = z.object({
  /** 实体名称 */
  name: z.string().min(1),
  /** 属性/谓词名称，要失效此属性所有当前有效事实 */
  attribute: z.string().min(1),
});

/** 实体插入/更新的输入类型 */
type EntityUpsertInput = z.infer<typeof EntityUpsertSchema>;
/** 实体获取的输入类型 */
type EntityGetInput = z.infer<typeof EntityGetSchema>;
/** 实体搜索的输入类型 */
type EntitySearchInput = z.infer<typeof EntitySearchSchema>;
/** 实体列表的输入类型 */
type EntityListInput = z.infer<typeof EntityListSchema>;
/** 实体删除的输入类型 */
type EntityDeleteInput = z.infer<typeof EntityDeleteSchema>;
/** 实体清理的输入类型 */
type EntityPruneInput = z.infer<typeof EntityPruneSchema>;
/** 添加时间事实的输入类型 */
type EntityFactAddInput = z.infer<typeof EntityFactAddSchema>;
/** 失效事实的输入类型 */
type EntityFactInvalidateInput = z.infer<typeof EntityFactInvalidateSchema>;

/** 实体记忆实例的单例缓存 */
let _entityMemory: EntityMemory | null = null;

/**
 * 获取实体记忆实例（单例模式）
 * @returns 实体记忆实例
 */
function getEntityMemory(): EntityMemory {
  if (!_entityMemory) {
    _entityMemory = new EntityMemory(config.DATA_DIR);
  }
  return _entityMemory;
}

/**
 * 处理实体插入或更新请求
 * @param input - 包含实体类型、名称和属性的输入对象
 * @returns 工具响应，包含操作结果的 JSON 字符串
 */
export async function handleEntityUpsert(input: EntityUpsertInput): Promise<ToolResponse> {
  const memory = getEntityMemory();

  const result = memory.upsert({
    type: input.type as EntityType,
    name: input.name,
    description: '',
    aliases: [],
    attributes: input.attributes || {},
    tags: [],
  } as unknown as Omit<Entity, 'created_at' | 'updated_at' | 'accessed_at'>);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(result),
    }],
  };
}

/**
 * 处理获取实体请求
 * @param input - 包含实体名称的输入对象
 * @returns 工具响应，包含实体数据的 JSON 字符串
 */
export async function handleEntityGet(input: EntityGetInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  const entity = memory.get(input.name);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(entity),
    }],
  };
}

/**
 * 处理搜索实体请求
 * @param input - 包含搜索查询的输入对象
 * @returns 工具响应，包含搜索结果的 JSON 字符串
 */
export async function handleEntitySearch(input: EntitySearchInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  const results = memory.search(input.query);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(results),
    }],
  };
}

/**
 * 处理列出实体请求
 * @param input - 可选包含实体类型过滤的输入对象
 * @returns 工具响应，包含实体列表的 JSON 字符串
 */
export async function handleEntityList(input: EntityListInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  let entities;
  if (input.type) {
    entities = memory.getByType(input.type as EntityType);
  } else {
    entities = memory.list();
  }
  return {
    content: [{
      type: 'text',
      text: JSON.stringify(entities),
    }],
  };
}

/**
 * 处理删除实体请求
 * @param input - 包含实体名称和可选类型的输入对象
 * @returns 工具响应，包含删除结果的 JSON 字符串
 */
export async function handleEntityDelete(input: EntityDeleteInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  const deleted = memory.remove(input.name, input.type as EntityType | undefined);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ deleted }),
    }],
  };
}

/**
 * 处理清理过期实体请求
 * @param input - 可选包含最大保留天数的输入对象
 * @returns 工具响应，包含清理结果的 JSON 字符串
 */
export async function handleEntityPrune(input: EntityPruneInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  const pruned = memory.prune(input.max_age_days);
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({ pruned }),
    }],
  };
}

/**
 * 处理添加时间事实请求
 * 自动失效该属性当前所有有效事实，添加新事实
 * @param input - 包含实体名称、属性、值的输入对象
 * @returns 工具响应，包含操作结果的 JSON 字符串
 */
export async function handleEntityFactAdd(input: EntityFactAddInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  const result = memory.addFact(
    input.name,
    input.attribute,
    input.value,
    input.confidence,
    input.source_ref || null
  );
  return {
    content: [{
      type: 'text',
      text: result
        ? JSON.stringify({ success: true, entity: result})
        : JSON.stringify({ success: false, error: 'Entity not found' }),
    }],
  };
}

/**
 * 处理失效事实请求
 * 失效实体指定属性所有当前有效事实
 * @param input - 包含实体名称和属性的输入对象
 * @returns 工具响应，包含失效数量的 JSON 字符串
 */
export async function handleEntityFactInvalidate(input: EntityFactInvalidateInput): Promise<ToolResponse> {
  const memory = getEntityMemory();
  const result = memory.invalidateFacts(input.name, input.attribute);
  return {
    content: [{
      type: 'text',
      text: result !== null
        ? JSON.stringify({ success: true, invalidated: result })
        : JSON.stringify({ success: false, error: 'Entity not found' }),
    }],
  };
}

export {
  EntityUpsertSchema,
  EntityGetSchema,
  EntitySearchSchema,
  EntityListSchema,
  EntityDeleteSchema,
  EntityPruneSchema,
  EntityFactAddSchema,
  EntityFactInvalidateSchema,
};
