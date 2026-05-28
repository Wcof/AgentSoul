/**
 * @fileoverview 配置管理模块
 */

import { PROJECT_ROOT } from './paths.js';

export interface KVCacheConfig {
  hotDays: number;
  warmDays: number;
  coldDays: number;
  maxSnapshots: number;
  gcThreshold: number;
  useSqliteBackend: boolean;
  sqliteDbPath: string;
  tokenBudget: { bootContext: number; searchResult: number; progressiveLoad: boolean };
}

export const DEFAULT_KV_CACHE_CONFIG: KVCacheConfig = {
  hotDays: 7, warmDays: 30, coldDays: 365, maxSnapshots: 1000, gcThreshold: 0.3,
  useSqliteBackend: false, sqliteDbPath: 'sqlite/kv_cache.db',
  tokenBudget: { bootContext: 2000, searchResult: 500, progressiveLoad: true },
};

export interface SoulConfig {
  DATA_DIR: string;
  KV_CACHE: KVCacheConfig;
  MEMORY: { dayDir: string; weekDir: string; monthDir: string; yearDir: string; topicDir: string; topicArchiveDir: string };
  CORE_MEMORY_DIR: string;
  ENTITY_MEMORY_DIR: string;
  LEARNING_DIR: string;
  SUBSCRIPTIONS_DIR: string;
  VERSIONS_DIR: string;
}

function resolve(...parts: string[]): string {
  return PROJECT_ROOT + '/' + parts.filter(p => p).join('/');
}

export const DEFAULT_SOUL_CONFIG: SoulConfig = {
  DATA_DIR: resolve('data'),
  KV_CACHE: { ...DEFAULT_KV_CACHE_CONFIG },
  MEMORY: {
    dayDir: resolve('data/memory/day'), weekDir: resolve('data/memory/week'),
    monthDir: resolve('data/memory/month'), yearDir: resolve('data/memory/year'),
    topicDir: resolve('data/memory/topic'), topicArchiveDir: resolve('data/memory/topic/archive'),
  },
  CORE_MEMORY_DIR: resolve('data/core-memory'),
  ENTITY_MEMORY_DIR: resolve('data/entity-memory'),
  LEARNING_DIR: resolve('data/learning'),
  SUBSCRIPTIONS_DIR: resolve('data/subscriptions'),
  VERSIONS_DIR: resolve('data/soul/versions'),
};

const config = { ...DEFAULT_SOUL_CONFIG };
export default config;
