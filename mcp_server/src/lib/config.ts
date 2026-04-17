/**
 * @fileoverview Configuration loader
 * @description Loads behavior configuration from behavior.yaml
 */

import path from 'path';
import yaml from 'js-yaml';
import { PROJECT_ROOT, DATA_ROOT } from './paths.js';
import { readFile } from './utils.js';

/**
 * Behavior configuration interface
 */
export interface BehaviorConfig {
  enabled: boolean;
  auto_memory: boolean;
  emotional_response: boolean;
  task_scheduling: boolean;
  memory_daily_summary: boolean;
  response_length_limit: number;
  forbidden_topics: string[];
  allowed_topics: string[];
  priority: string[];
}

/**
 * Default behavior configuration
 */
const DEFAULT_BEHAVIOR: BehaviorConfig = {
  enabled: true,
  auto_memory: true,
  emotional_response: true,
  task_scheduling: true,
  memory_daily_summary: true,
  response_length_limit: 0,
  forbidden_topics: [],
  allowed_topics: [],
  priority: [
    'privacy_protection',
    'task_completion',
    'emotional_support',
    'professional_assistance',
  ],
};

/**
 * Export path constants for other modules
 */
export const DATA_DIR = DATA_ROOT;
export const PROJECT_DIR = PROJECT_ROOT;
export const CORE_MEMORY = path.join(DATA_ROOT, 'core-memory');
export const ENTITY_MEMORY = path.join(DATA_ROOT, 'entity-memory');
export const KV_CACHE = path.join(DATA_ROOT, 'kv-cache');
export const SOUL_BOARD = path.join(DATA_ROOT, 'soul-board');

/**
 * Load behavior configuration from file
 * @returns The loaded configuration or default if file not found
 */
export function loadBehaviorConfig(): BehaviorConfig {
  const configPath = path.join(PROJECT_ROOT, 'config', 'behavior.yaml');
  const content = readFile(configPath);

  if (!content) {
    return { ...DEFAULT_BEHAVIOR };
  }

  try {
    const parsed = yaml.load(content) as Partial<BehaviorConfig>;
    // Merge with defaults to ensure all fields are present
    return {
      ...DEFAULT_BEHAVIOR,
      ...parsed,
    };
  } catch (e) {
    console.error('Error parsing behavior.yaml, using defaults:', e);
    return { ...DEFAULT_BEHAVIOR };
  }
}

/**
 * Singleton instance
 */
let cachedConfig: BehaviorConfig | null = null;

/**
 * Get behavior configuration (cached for performance)
 * @returns The behavior configuration
 */
export function getBehaviorConfig(): BehaviorConfig {
  if (!cachedConfig) {
    cachedConfig = loadBehaviorConfig();
  }
  return cachedConfig;
}

/**
 * Clear the cached configuration to force reload on next get
 */
export function reloadConfig(): void {
  cachedConfig = null;
}

export default {
  loadBehaviorConfig,
  getBehaviorConfig,
  reloadConfig,
  DATA_DIR,
  PROJECT_DIR,
  CORE_MEMORY,
  ENTITY_MEMORY,
  KV_CACHE,
  SOUL_BOARD,
};
