/**
 * @fileoverview AgentSoul MCP - 存储工具模块
 * @description 提供数据持久化功能，包括人格配置读取、灵魂状态管理、时间记忆和主题记忆的读写操作
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { safePath, readFile, writeFile, sanitizeTopicName, safeGet, toList, logWAL } from './lib/utils.js';
import { PROJECT_ROOT } from './lib/paths.js';
import { SoulState, PersonaConfig, MemoryConflict } from './types.js';

/** 原始人格配置接口，用于向后兼容不同版本的配置格式 */
interface RawPersonaConfig {
  agent?: Record<string, unknown>;
  ai?: Record<string, unknown>;
  persona?: {
    ai?: Record<string, unknown>;
    master?: Record<string, unknown>;
  };
  master?: Record<string, unknown>;
}

/** 数据根目录路径 - can be overridden by AGENTSOUL_DATA_ROOT environment variable */
const DATA_ROOT = process.env.AGENTSOUL_DATA_ROOT
  ? path.resolve(process.env.AGENTSOUL_DATA_ROOT)
  : path.join(PROJECT_ROOT, 'data');

/**
 * Get the current data root directory path.
 * @returns The resolved data root path
 */
export function getDataRoot(): string {
  return DATA_ROOT;
}

/**
 * Detect if OpenClaw is installed globally
 * Checks for ~/.openclaw/workspace/_agentsoul_installed marker file
 * @returns The OpenClaw agent data path if installed, null otherwise
 */
// Cache detection result - only detect once at module load
let cachedDetection: string | null | undefined = undefined;
export function detectOpenClawGlobalInstall(): string | null {
  if (cachedDetection !== undefined) {
    return cachedDetection;
  }
  const homeDir = process.env.HOME || process.env.USERPROFILE;
  if (!homeDir) {
    cachedDetection = null;
    return null;
  }

  const openclawWorkspace = path.join(homeDir, '.openclaw', 'workspace');
  const markerPath = path.join(openclawWorkspace, '_agentsoul_installed');
  if (fs.existsSync(markerPath)) {
    // OpenClaw has AgentSoul installed, return the agent data root
    cachedDetection = path.join(openclawWorkspace, 'agent', 'data');
    return cachedDetection;
  }
  cachedDetection = null;
  return null;
}

/**
 * Default PAD emotional state vector - created once at module load
 * Default baseline values: Pleasure=0.3, Arousal=0.2, Dominance=0.3
 *
 * NOTE: Keep this in sync with the same constant defined in:
 * common/__init__.py - DEFAULT_PAD_STATE
 * If you change the baseline here, change it there too to keep consistency across codebases.
 */
const DEFAULT_SOUL_STATE: SoulState = {
  version: '1.0.0',
  pleasure: 0.3,
  arousal: 0.2,
  dominance: 0.3,
  last_updated: null,
  history: [],
};

/**
 * Get a copy of the default soul state.
 * Returns a copy to prevent accidental mutation of the constant.
 */
function getDefaultSoulState(): SoulState {
  return { ...DEFAULT_SOUL_STATE };
}

/**
 * Default persona configuration - created once at module load
 */
const DEFAULT_PERSONA_CONFIG: PersonaConfig = {
  ai: {
    name: 'Agent',
    nickname: '',
    naming_mode: 'default',
    role: 'AI Assistant',
    personality: [],
    core_values: [],
    interaction_style: {},
  },
  master: {
    name: '',
    nickname: [],
    timezone: 'Asia/Shanghai',
    labels: [],
  },
};

/**
 * Get a copy of the default persona configuration.
 * Returns a copy to prevent accidental mutation of the constant.
 */
function getDefaultPersonaConfig(): PersonaConfig {
  return {
    ai: { ...DEFAULT_PERSONA_CONFIG.ai },
    master: { ...DEFAULT_PERSONA_CONFIG.master },
  };
}

/**
 * 存储管理器类
 * 负责 AgentSoul 所有数据的持久化操作，包括人格配置、灵魂状态和各种记忆
 */
export class StorageManager {
  private readonly openclawDataRoot: string | null;

  /**
   * 构造函数
   * @param projectRoot - 可选的项目根目录，用于向后兼容 (unused - PROJECT_ROOT from paths.ts is used instead)
   */
  constructor(projectRoot?: string) {
    // Backward compatibility kept, unused parameter kept for compatibility
    void projectRoot;
    // Detect OpenClaw installation (cached once at module level)
    this.openclawDataRoot = detectOpenClawGlobalInstall();
    if (this.openclawDataRoot) {
      console.log(`[AgentSoul MCP] Detected OpenClaw global installation, will sync writes to: ${this.openclawDataRoot}`);
    }
  }

  /**
   * Get the detected OpenClaw data root (if any)
   * @returns OpenClaw data root path or null if not detected
   */
  getOpenClawDataRoot(): string | null {
    return this.openclawDataRoot;
  }

  /**
   * Helper: Ensure parent directory exists and write file atomically
   * Uses write-then-rename for atomicity with automatic rollback on failure
   * Retries up to 3 times for intermittent IO errors (file locking, etc)
   * @param fullPath - Full path to write
   * @param rootPath - Root path for safe path check
   * @param content - Content to write
   * @param retries - Number of retries (default: 3)
   * @param delayMs - Delay between retries in ms (default: 100)
   * @returns True if write was successful
   */
  private ensureDirAndWrite(
    fullPath: string,
    rootPath: string,
    content: string,
    retries: number = 3,
    delayMs: number = 100
  ): boolean {
    const checkedPath = safePath(fullPath, rootPath);
    if (!checkedPath) {
      return false;
    }

    const parentDir = path.dirname(checkedPath);
    // fs.mkdirSync with recursive: true is safe even if directory exists
    // No need for prior exists check - avoids TOCTOU race
    fs.mkdirSync(parentDir, { recursive: true });

    let lastError: unknown = null;
    for (let attempt = 0; attempt < retries; attempt++) {
      // Atomic write: write to temp file first, then rename
      // This prevents partial writes and enables rollback if something goes wrong
      const tempPath = `${checkedPath}.tmp.${Date.now()}-${attempt}`;

      try {
        const tempSuccess = writeFile(tempPath, content);
        if (!tempSuccess) {
          // Clean up temp file if write failed
          try {
            fs.unlinkSync(tempPath);
          } catch {
            // Ignore cleanup errors
          }
          continue;
        }

        // Rename temp file to target (atomic on POSIX systems)
        fs.renameSync(tempPath, checkedPath);
        return true;
      } catch (e) {
        lastError = e;
        // Clean up temp file on error
        console.error(`[AgentSoul Storage] Atomic write failed (attempt ${attempt + 1}/${retries}) for ${fullPath}:`, e);
        try {
          fs.unlinkSync(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        // Wait before retrying if not last attempt
        if (attempt < retries - 1) {
          const start = Date.now();
          while (Date.now() - start < delayMs) {
            // Busy wait for simplicity - short delay
          }
        }
      }
    }

    // All attempts failed
    console.error(`[AgentSoul Storage] All ${retries} write attempts failed for ${fullPath}:`, lastError);
    return false;
  }

  /**
   * Sync write to OpenClaw installation if detected
   * @param relativePath - Relative path from data root
   * @param content - Content to write
   * @returns True if sync was successful, false otherwise
   */
  private syncWriteToOpenClaw(relativePath: string, content: string): boolean {
    if (!this.openclawDataRoot) {
      return false;
    }
    const ocPath = path.join(this.openclawDataRoot, relativePath);
    return this.ensureDirAndWrite(ocPath, this.openclawDataRoot, content);
  }

  /**
   * 读取人格配置文件
   * 支持多种配置格式，从 YAML 文件中解析并标准化为 PersonaConfig 格式
   * @returns 标准化后的人格配置对象
   */
  readPersonaConfig(): PersonaConfig {
    const configPath = path.join(PROJECT_ROOT, 'config', 'persona.yaml');

    const content = readFile(configPath);
    if (content === null) {
      console.error(`[AgentSoul Storage] WARNING: Could not read persona config from ${configPath}, using defaults`);
      console.error(`[AgentSoul Storage] PROJECT_ROOT = ${PROJECT_ROOT}`);
      return getDefaultPersonaConfig();
    }

    const raw = yaml.load(content) as RawPersonaConfig;

    let aiData: Record<string, unknown>;
    let masterData: Record<string, unknown>;

    // 检测并处理不同版本的配置格式
    if ('agent' in raw && raw.agent) {
      aiData = raw.agent as Record<string, unknown>;
      masterData = (raw as { master?: Record<string, unknown> }).master || {};
    } else if ('persona' in raw && raw.persona && 'ai' in raw.persona) {
      aiData = raw.persona.ai as Record<string, unknown>;
      masterData = (raw.persona as { master?: Record<string, unknown> }).master || {};
    } else if ('ai' in raw) {
      aiData = raw.ai as Record<string, unknown>;
      masterData = (raw as { master?: Record<string, unknown> }).master || {};
    } else {
      aiData = { name: 'Agent' };
      masterData = {};
    }

    return {
      ai: {
        name: safeGet(aiData, 'name', 'Agent'),
        nickname: safeGet(aiData, 'nickname', ''),
        naming_mode: safeGet(aiData, 'naming_mode', 'default'),
        role: safeGet(aiData, 'role', 'AI Assistant'),
        personality: toList(aiData.personality),
        core_values: toList(aiData.core_values),
        interaction_style: safeGet(aiData, 'interaction_style', {}),
      },
      master: {
        name: safeGet(masterData, 'name', ''),
        nickname: toList(masterData.nickname),
        timezone: safeGet(masterData, 'timezone', 'Asia/Shanghai'),
        labels: toList(masterData.labels),
      },
    };
  }

  /**
   * 写入人格配置
   * @param config - 人格配置对象
   * @returns 是否写入成功
   */
  writePersonaConfig(config: PersonaConfig): boolean {
    const configPath = path.join(PROJECT_ROOT, 'config', 'persona.yaml');

    // Convert back to YAML format expected by the project
    const yamlContent = yaml.dump({
      agent: {
        name: config.ai.name,
        nickname: config.ai.nickname,
        role: config.ai.role,
        personality: config.ai.personality,
        core_values: config.ai.core_values,
        interaction_style: config.ai.interaction_style,
      },
      master: {
        name: config.master.name,
        nickname: config.master.nickname,
        timezone: config.master.timezone,
        labels: config.master.labels,
      },
    });

    const success = writeFile(configPath, yamlContent);
    logWAL('writePersonaConfig', 'persona.yaml', configPath, success, {
      agent_name: config.ai.name,
      master_name: config.master.name,
    });

    return success;
  }

  /**
   * 运行完整的健康检查
   * @param includeMemorySamples - 是否包含记忆文件抽样检查
   * @returns 健康检查报告
   */
  runHealthCheck(includeMemorySamples: boolean): {
    timestamp: string;
    total_checks: number;
    errors: number;
    warnings: number;
    issues: Array<{
      level: 'error' | 'warning' | 'info';
      category: string;
      message: string;
      location?: string;
      fix_suggestion?: string;
    }>;
    is_healthy: boolean;
    soul_version: string | null;
  } {
    const allIssues: Array<{
      level: 'error' | 'warning' | 'info';
      category: string;
      message: string;
      location?: string;
      fix_suggestion?: string;
    }> = [];

    // 1. 检查必需目录结构
    const requiredDirs = [
      'data',
      'var/data/soul',
      'var/data/soul/soul_variable',
      'var/data/memory',
      'var/data/memory/day',
      'var/data/memory/week',
      'var/data/memory/month',
      'var/data/memory/year',
      'var/data/memory/topic',
      'var/data/memory/topic/archive',
      'var/data/entity-memory',
      'var/data/core-memory',
      'var/data/kv-cache',
      'config',
    ];

    for (const dirPath of requiredDirs) {
      const fullPath = path.join(PROJECT_ROOT, dirPath);
      if (!fs.existsSync(fullPath)) {
        allIssues.push({
          level: 'info',
          category: 'directory',
          message: `Optional directory doesn't exist: ${dirPath}`,
          location: fullPath,
          fix_suggestion: 'Will be created automatically on first write',
        });
      } else {
        try {
          fs.accessSync(fullPath, fs.constants.W_OK);
        } catch {
          allIssues.push({
            level: 'error',
            category: 'permission',
            message: `Directory not writable: ${dirPath}`,
            location: fullPath,
            fix_suggestion: `Check permissions: chmod -R u+w ${dirPath}`,
          });
        }
      }
    }

    // 2. 检查配置文件
    const personaPath = path.join(PROJECT_ROOT, 'config', 'persona.yaml');
    if (!fs.existsSync(personaPath)) {
      allIssues.push({
        level: 'error',
        category: 'config',
        message: 'persona.yaml not found',
        location: personaPath,
        fix_suggestion: 'Run installation to generate default config',
      });
    } else {
      try {
        const content = readFile(personaPath);
        if (content === null) {
          allIssues.push({
            level: 'error',
            category: 'config',
            message: 'Cannot read persona.yaml',
            location: personaPath,
          });
        } else {
          // Just check YAML parseability
          yaml.load(content);
        }
      } catch (e) {
        allIssues.push({
          level: 'error',
          category: 'config',
          message: `Failed to parse config: ${(e as Error).message}`,
          location: personaPath,
          fix_suggestion: 'Check YAML syntax',
        });
      }
    }

    const behaviorPath = path.join(PROJECT_ROOT, 'config', 'behavior.yaml');
    if (!fs.existsSync(behaviorPath)) {
      allIssues.push({
        level: 'warning',
        category: 'config',
        message: 'behavior.yaml not found (using defaults)',
        location: behaviorPath,
        fix_suggestion: 'Copy from default template if you need custom behavior settings',
      });
    }

    // 3. 检查灵魂状态
    const statePath = path.join(DATA_ROOT, 'soul', 'soul_variable', 'state_vector.json');
    let soulVersion: string | null = null;
    if (!fs.existsSync(statePath)) {
      allIssues.push({
        level: 'warning',
        category: 'soul_state',
        message: 'Soul state file doesn\'t exist yet',
        location: statePath,
        fix_suggestion: 'Will be created automatically on first update_soul_state call',
      });
    } else {
      try {
        const content = readFile(statePath);
        if (content === null) {
          allIssues.push({
            level: 'error',
            category: 'soul_state',
            message: 'Cannot read soul state file',
            location: statePath,
          });
        } else {
          const state = JSON.parse(content) as {
            pleasure?: unknown;
            arousal?: unknown;
            dominance?: unknown;
            version?: string;
          };
          const requiredFields = ['pleasure', 'arousal', 'dominance'];
          for (const field of requiredFields) {
            if (!(field in state)) {
              allIssues.push({
                level: 'error',
                category: 'soul_state',
                message: `Missing required field: ${field}`,
                location: statePath,
                fix_suggestion: 'Delete the file to reset to defaults',
              });
            } else {
              const val = (state as Record<string, unknown>)[field];
              if (typeof val !== 'number' || val < -1 || val > 1) {
                allIssues.push({
                  level: 'error',
                  category: 'soul_state',
                  message: `Invalid value for ${field}: ${val} (must be between -1 and 1)`,
                  location: statePath,
                  fix_suggestion: 'Delete the file to reset to defaults',
                });
              }
            }
          }
          if (state.version) {
            soulVersion = state.version;
          }
        }
      } catch (e) {
        allIssues.push({
          level: 'error',
          category: 'soul_state',
          message: `Invalid JSON: ${(e as Error).message}`,
          location: statePath,
          fix_suggestion: 'Delete the file to reset to defaults',
        });
      }
    }

    // 4. 抽样检查记忆文件
    if (includeMemorySamples) {
      const memoryDirs = [
        { path: 'var/data/memory/day', desc: 'day' },
        { path: 'var/data/memory/week', desc: 'week' },
        { path: 'var/data/memory/month', desc: 'month' },
        { path: 'var/data/memory/year', desc: 'year' },
        { path: 'var/data/memory/topic', desc: 'topic' },
      ];

      for (const { path: dirPath, desc } of memoryDirs) {
        const fullPath = path.join(PROJECT_ROOT, dirPath);
        if (!fs.existsSync(fullPath)) continue;

        try {
          const files = fs.readdirSync(fullPath);
          const sampled = files.slice(0, 10);

          for (const file of sampled) {
            const filePath = path.join(fullPath, file);
            try {
              const content = readFile(filePath);
              if (content === null) continue;
              if (content.length === 0 && !file.startsWith('.gitkeep')) {
                allIssues.push({
                  level: 'info',
                  category: 'memory',
                  message: `Empty memory file: ${file}`,
                  location: filePath,
                });
              }
            } catch (e) {
              allIssues.push({
                level: 'warning',
                category: 'memory',
                message: `Failed to read: ${(e as Error).message}`,
                location: filePath,
              });
            }
          }
        } catch (e) {
          allIssues.push({
            level: 'warning',
            category: 'memory',
            message: `Failed to scan directory: ${(e as Error).message}`,
            location: fullPath,
          });
        }
      }
    }

    // 5. 权限检查
    const configRoot = path.join(PROJECT_ROOT, 'config');
    if (fs.existsSync(configRoot)) {
      try {
        fs.accessSync(configRoot, fs.constants.W_OK);
      } catch {
        allIssues.push({
          level: 'error',
          category: 'permission',
          message: 'Config directory not writable',
          location: configRoot,
          fix_suggestion: 'chmod u+w config/',
        });
      }
    }
    const dataRoot = DATA_ROOT;
    if (fs.existsSync(dataRoot)) {
      try {
        fs.accessSync(dataRoot, fs.constants.W_OK);
      } catch {
        allIssues.push({
          level: 'error',
          category: 'permission',
          message: 'Data directory not writable',
          location: dataRoot,
          fix_suggestion: 'chmod -R u+w data/',
        });
      }
    }

    const errors = allIssues.filter(i => i.level === 'error').length;
    const warnings = allIssues.filter(i => i.level === 'warning').length;

    return {
      timestamp: new Date().toISOString(),
      total_checks: allIssues.length + 1,
      errors,
      warnings,
      issues: allIssues,
      is_healthy: errors === 0,
      soul_version: soulVersion || null,
    };
  }

  /**
   * 读取基础规则文件
   * @param filename - 规则文件名
   * @returns 文件内容或 null
   */
  readBaseRule(filename: string): string | null {
    const rulePath = path.join(PROJECT_ROOT, 'src', filename);
    return readFile(rulePath);
  }

  /**
   * 获取灵魂状态文件路径
   * @returns 灵魂状态文件的完整路径
   */
  private getSoulStatePath(): string {
    return path.join(DATA_ROOT, 'soul', 'soul_variable', 'state_vector.json');
  }

  /**
   * 读取当前灵魂状态
   * 如果文件不存在或解析失败，返回默认状态
   * @returns 灵魂状态对象
   */
  readSoulState(): SoulState {
    const statePath = this.getSoulStatePath();

    const checkedPath = safePath(statePath, DATA_ROOT);
    if (!checkedPath) {
      console.error('Path traversal detected in readSoulState');
      return getDefaultSoulState();
    }

    const content = readFile(checkedPath);
    if (content === null) {
      // 返回默认基准状态
      return getDefaultSoulState();
    }

    try {
      return JSON.parse(content) as SoulState;
    } catch (e) {
      return getDefaultSoulState();
    }
  }

  /**
   * 写入灵魂状态
   * @param state - 要保存的灵魂状态对象
   * @returns 写入是否成功
   */
  writeSoulState(state: SoulState): boolean {
    const statePath = this.getSoulStatePath();

    const checkedPath = safePath(statePath, DATA_ROOT);
    if (!checkedPath) {
      console.error('Path traversal detected in writeSoulState');
      logWAL('writeSoulState', 'state_vector', statePath, false, { error: 'Path traversal detected' });
      return false;
    }

    // 确保版本字段存在
    if (!state.version) {
      state.version = '1.0.0';
    }

    const success = writeFile(checkedPath, JSON.stringify(state, null, 2));

    // 保存版本快照用于回滚
    if (success) {
      this._saveVersionSnapshot(state);
      // If OpenClaw is detected, sync write to it
      this.syncWriteToOpenClaw('soul/soul_variable/state_vector.json', JSON.stringify(state, null, 2));
    }

    logWAL('writeSoulState', 'state_vector', checkedPath, success, {
      version: state.version,
      pleasure: state.pleasure,
      arousal: state.arousal,
      dominance: state.dominance,
    });

    return success;
  }

  /**
   * 保存版本快照用于回滚
   * @param state - 灵魂状态对象
   */
  private _saveVersionSnapshot(state: SoulState): void {
    try {
      const historyDir = path.join(DATA_ROOT, 'soul', 'versions');
      historyDir && fs.mkdirSync(historyDir, { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '');
      const version = state.version || '1.0.0';
      const snapshotPath = path.join(historyDir, `${timestamp}_v${version}.json`);
      fs.writeFileSync(snapshotPath, JSON.stringify(state, null, 2), 'utf8');
      // 只保留最近 50 个版本
      const snapshots = fs.readdirSync(historyDir).filter(f => f.endsWith('.json'));
      if (snapshots.length > 50) {
        snapshots.sort();
        for (const old of snapshots.slice(0, snapshots.length - 50)) {
          try {
            fs.unlinkSync(path.join(historyDir, old));
          } catch {
            // Ignore cleanup errors
          }
        }
      }
    } catch (e) {
      console.error('[AgentSoul Storage] Failed to save version snapshot:', e);
    }
  }

  /**
   * 获取基于时间的记忆文件路径
   * @param period - 时间周期类型
   * @param identifier - 标识符（日期、周次、月份或年份）
   * @returns 记忆文件的完整路径
   */
  private getTimeMemoryPath(period: 'day' | 'week' | 'month' | 'year', identifier: string): string {
    return path.join(DATA_ROOT, 'memory', period, `${identifier}.md`);
  }

  /**
   * 读取基于时间的记忆（通用方法）
   * @param period - 时间周期类型
   * @param identifier - 标识符
   * @returns 记忆内容或 null
   */
  private readTimeMemory(period: 'day' | 'week' | 'month' | 'year', identifier: string): string | null {
    const filePath = this.getTimeMemoryPath(period, identifier);

    const checkedPath = safePath(filePath, DATA_ROOT);
    if (!checkedPath) {
      console.error(`Path traversal detected in read${period}Memory`);
      return null;
    }

    return readFile(checkedPath);
  }

  /**
   * Parse date identifier to year, month, day components
   * @param date - Date string in YYYY-MM-DD format
   * @returns Object with year, month, day numbers or null if invalid
   */
  private parseDate(date: string): { year: number; month: number; day: number } | null {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return null;
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    if (isNaN(year) || isNaN(month) || isNaN(day)) return null;
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    // Verify the date actually exists (e.g., not February 30)
    const dateObj = new Date(year, month - 1, day);
    if (dateObj.getFullYear() !== year || dateObj.getMonth() !== month - 1 || dateObj.getDate() !== day) {
      return null;
    }
    return { year, month, day };
  }

  /**
   * Get year-week identifier for a given date
   * @param date - Date in YYYY-MM-DD format
   * @returns Year-week string in YYYY-WW format or null if invalid
   *
   * Uses (dayOfYear - 1) // 7 + 1 calculation - simple but good enough for aggregation
   */
  private dateToYearWeek(date: string): string | null {
    const parsed = this.parseDate(date);
    if (!parsed) return null;

    const dateObj = new Date(parsed.year, parsed.month - 1, parsed.day);
    const startOfYear = new Date(parsed.year, 0, 1);
    const dayOfYear = Math.floor((dateObj.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    const week = Math.floor((dayOfYear - 1) / 7) + 1;
    return `${parsed.year}-${week.toString().padStart(2, '0')}`;
  }

  /**
   * Get year-month identifier for a given date
   * @param date - Date in YYYY-MM-DD format
   * @returns Year-month string in YYYY-MM format or null if invalid
   */
  private dateToYearMonth(date: string): string | null {
    const parsed = this.parseDate(date);
    if (!parsed) return null;
    return `${parsed.year}-${parsed.month.toString().padStart(2, '0')}`;
  }

  /**
   * Get year identifier for a given date
   * @param date - Date in YYYY-MM-DD format
   * @returns Year string in YYYY format or null if invalid
   */
  private dateToYear(date: string): string | null {
    const parsed = this.parseDate(date);
    if (!parsed) return null;
    return `${parsed.year}`;
  }

  /**
   * Check if a date belongs to a past period that should be archived
   * @param currentDate - The date that was just written (current date)
   * @param archivedDate - The date to check if it should be archived
   * @returns True if archivedDate is old enough to be archived
   */
  private shouldArchiveDayToWeek(currentDate: string, archivedDate: string): boolean {
    const parsedCurrent = this.parseDate(currentDate);
    const parsedArchived = this.parseDate(archivedDate);
    if (!parsedCurrent || !parsedArchived) return false;

    // If the archived date is from a different week than current date, it should be archived
    const currentWeek = this.dateToYearWeek(currentDate);
    const archivedWeek = this.dateToYearWeek(archivedDate);
    if (currentWeek !== archivedWeek) return true;

    // Same week but more than 7 days ago - should be archived
    const currentDateObj = new Date(parsedCurrent.year, parsedCurrent.month - 1, parsedCurrent.day);
    const archivedDateObj = new Date(parsedArchived.year, parsedArchived.month - 1, parsedArchived.day);
    const daysDiff = Math.floor((currentDateObj.getTime() - archivedDateObj.getTime()) / (1000 * 60 * 60 * 24));

    return daysDiff >= 7;
  }

  /**
   * Check if a week should be archived to month
   * @param yearWeek - Week identifier in YYYY-WW format
   * @returns True if week belongs to a completed month that should be archived
   */
  private shouldArchiveWeekToMonth(yearWeek: string): boolean {
    // For any week that's not the current week of the current month, it should be archived
    // We can just always aggregate - the write will happen regardless, but if the month is complete
    // it gets aggregated to monthly. For our automatic triggering, we just check if this is not the current week
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentWeek = Math.floor((today.getDate() - 1 + this.getDayOfYear(today)) / 7) + 1;
    const [year, weekStr] = yearWeek.split('-');
    const week = parseInt(weekStr, 10);

    if (parseInt(year, 10) < currentYear) {
      return true; // Previous year, definitely should be archived
    }
    if (parseInt(year, 10) > currentYear) {
      return false; // Future, don't archive yet
    }
    // Same year - if week is more than 2 weeks behind current, archive
    return week < currentWeek - 1;
  }

  /**
   * Check if a month should be archived to year
   * @param yearMonth - Month identifier in YYYY-MM format
   * @returns True if month is completed and should be archived
   */
  private shouldArchiveMonthToYear(yearMonth: string): boolean {
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const [year, monthStr] = yearMonth.split('-');
    const month = parseInt(monthStr, 10);

    if (parseInt(year, 10) < currentYear) {
      return true; // Previous year, definitely should be archived
    }
    if (parseInt(year, 10) > currentYear) {
      return false; // Future, don't archive yet
    }
    // Same year - if month is before current month, it's completed - should archive
    return month < currentMonth;
  }

  /**
   * Get day of year for a date
   */
  private getDayOfYear(date: Date): number {
    const startOfYear = new Date(date.getFullYear(), 0, 1);
    const diff = date.getTime() - startOfYear.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }

  /**
   * Aggregate all daily memories for a week into weekly memory content
   * @param yearWeek - Week identifier
   * @returns Aggregated content or null if no daily files found
   */
  private aggregateDailyToWeekly(yearWeek: string): string | null {
    const dayDir = path.join(DATA_ROOT, 'memory', 'day');
    if (!fs.existsSync(dayDir)) return null;

    let aggregated = `# Weekly Aggregation: ${yearWeek}\n\n`;
    let hasContent = false;

    const files = fs.readdirSync(dayDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const date = file.replace('.md', '');
      const fileWeek = this.dateToYearWeek(date);
      if (fileWeek === yearWeek) {
        const content = this.readDailyMemory(date);
        if (content && content.trim()) {
          aggregated += `## ${date}\n\n${content.trim()}\n\n---\n\n`;
          hasContent = true;
        }
      }
    }

    return hasContent ? aggregated : null;
  }

  /**
   * Aggregate all weekly memories for a month into monthly memory content
   * @param yearMonth - Month identifier
   * @returns Aggregated content or null if no weekly files found
   */
  private aggregateWeeklyToMonthly(yearMonth: string): string | null {
    const weekDir = path.join(DATA_ROOT, 'memory', 'week');
    if (!fs.existsSync(weekDir)) return null;

    let aggregated = `# Monthly Aggregation: ${yearMonth}\n\n`;
    let hasContent = false;

    const files = fs.readdirSync(weekDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const yearWeek = file.replace('.md', '');
      // Check if this week belongs to the month
      // Simple check: starts with YYYY-MM
      if (yearWeek.startsWith(yearMonth)) {
        const content = this.readWeeklyMemory(yearWeek);
        if (content && content.trim()) {
          aggregated += `## ${yearWeek}\n\n${content.trim()}\n\n---\n\n`;
          hasContent = true;
        }
      }
    }

    return hasContent ? aggregated : null;
  }

  /**
   * Aggregate all monthly memories for a year into yearly memory content
   * @param year - Year identifier
   * @returns Aggregated content or null if no monthly files found
   */
  private aggregateMonthlyToYearly(year: string): string | null {
    const monthDir = path.join(DATA_ROOT, 'memory', 'month');
    if (!fs.existsSync(monthDir)) return null;

    let aggregated = `# Yearly Aggregation: ${year}\n\n`;
    let hasContent = false;

    const files = fs.readdirSync(monthDir);
    for (const file of files) {
      if (!file.endsWith('.md')) continue;
      const yearMonth = file.replace('.md', '');
      // Check if this month belongs to the year
      if (yearMonth.startsWith(year)) {
        const content = this.readMonthlyMemory(yearMonth);
        if (content && content.trim()) {
          const monthName = this.getMonthName(parseInt(yearMonth.split('-')[1], 10));
          aggregated += `## ${monthName} ${year}\n\n${content.trim()}\n\n---\n\n`;
          hasContent = true;
        }
      }
    }

    return hasContent ? aggregated : null;
  }

  /**
   * Get Chinese month name
   */
  private getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month - 1] || `${month}`;
  }

  /**
   * Trigger automatic hierarchical archiving after writing a new daily memory
   * @param currentDate - The date that was just written
   */
  private triggerAutomaticArchiving(currentDate: string): void {
    try {
      const dayDir = path.join(DATA_ROOT, 'memory', 'day');
      if (!fs.existsSync(dayDir)) return;

      // Step 1: Archive past days to weeks
      const dayFiles = fs.readdirSync(dayDir);
      const archivedWeeks = new Set<string>();

      for (const file of dayFiles) {
        if (!file.endsWith('.md')) continue;
        const dayDate = file.replace('.md', '');
        if (this.shouldArchiveDayToWeek(currentDate, dayDate)) {
          const yearWeek = this.dateToYearWeek(dayDate);
          if (yearWeek) {
            archivedWeeks.add(yearWeek);
          }
        }
      }

      // Aggregate each completed week and write to weekly memory
      for (const yearWeek of archivedWeeks) {
        const aggregated = this.aggregateDailyToWeekly(yearWeek);
        if (aggregated) {
          this.writeWeeklyMemory(yearWeek, aggregated);
          console.log(`[AgentSoul AutoArchive] Aggregated daily memories to week ${yearWeek}`);
        }
      }

      // Step 2: Archive past weeks to months (after day→week is done)
      const weekDir = path.join(DATA_ROOT, 'memory', 'week');
      if (!fs.existsSync(weekDir)) return;

      const weekFiles = fs.readdirSync(weekDir);
      const archivedMonths = new Set<string>();

      for (const file of weekFiles) {
        if (!file.endsWith('.md')) continue;
        const yearWeek = file.replace('.md', '');
        if (this.shouldArchiveWeekToMonth(yearWeek)) {
          // Extract year and get month by calculating the date of the first day of this week
          // This gives a more accurate month mapping than weekNum // 4
          const [yearStr, weekStr] = yearWeek.split('-');
          const year = parseInt(yearStr, 10);
          const week = parseInt(weekStr, 10);
          // Calculate approximate date of the first day of this week
          // January 1 is day 1 of week 1
          const firstDay = new Date(year, 0, 1 + (week - 1) * 7);
          const month = firstDay.getMonth() + 1;
          const yearMonth = `${year}-${month.toString().padStart(2, '0')}`;
          archivedMonths.add(yearMonth);
        }
      }

      // Aggregate each completed month and write to monthly memory
      for (const yearMonth of archivedMonths) {
        if (this.shouldArchiveWeekToMonth(yearMonth)) {
          const aggregated = this.aggregateWeeklyToMonthly(yearMonth);
          if (aggregated) {
            this.writeMonthlyMemory(yearMonth, aggregated);
            console.log(`[AgentSoul AutoArchive] Aggregated weekly memories to month ${yearMonth}`);
          }
        }
      }

      // Step 3: Archive past months to year (after week→month is done)
      const monthDir = path.join(DATA_ROOT, 'memory', 'month');
      if (!fs.existsSync(monthDir)) return;

      const monthFiles = fs.readdirSync(monthDir);
      const archivedYears = new Set<string>();

      for (const file of monthFiles) {
        if (!file.endsWith('.md')) continue;
        const yearMonth = file.replace('.md', '');
        if (this.shouldArchiveMonthToYear(yearMonth)) {
          const year = yearMonth.split('-')[0];
          archivedYears.add(year);
        }
      }

      // Aggregate each completed year and write to yearly memory
      for (const year of archivedYears) {
        const aggregated = this.aggregateMonthlyToYearly(year);
        if (aggregated) {
          this.writeYearlyMemory(year, aggregated);
          console.log(`[AgentSoul AutoArchive] Aggregated monthly memories to year ${year}`);
        }
      }
    } catch (e) {
      // Don't fail the write if auto-archiving fails - just log and continue
      console.error('[AgentSoul AutoArchive] Error during automatic archiving:', e);
    }
  }

  /**
   * 写入基于时间的记忆（通用方法）
   * @param period - 时间周期类型
   * @param identifier - 标识符
   * @param content - 要写入的内容
   * @returns 写入是否成功
   */
  private writeTimeMemory(period: 'day' | 'week' | 'month' | 'year', identifier: string, content: string): boolean {
    const filePath = this.getTimeMemoryPath(period, identifier);

    const checkedPath = safePath(filePath, DATA_ROOT);
    if (!checkedPath) {
      console.error(`Path traversal detected in write${period}Memory`);
      logWAL(`write${period}Memory`, identifier, filePath, false, { error: 'Path traversal detected' });
      return false;
    }

    const success = writeFile(checkedPath, content);

    // If OpenClaw is detected, sync write to it
    if (success) {
      this.syncWriteToOpenClaw(`memory/${period}/${identifier}.md`, content);

      // Trigger automatic hierarchical archiving after writing a new daily memory
      if (period === 'day') {
        this.triggerAutomaticArchiving(identifier);
      }
    }

    logWAL(`write${period}Memory`, identifier, checkedPath, success, {
      period,
      content_length: content.length,
    });

    return success;
  }

  /**
   * 读取日记忆
   * @param date - 日期字符串
   * @returns 日记忆内容或 null
   */
  readDailyMemory(date: string): string | null {
    return this.readTimeMemory('day', date);
  }

  /**
   * 写入日记忆
   * @param date - 日期字符串
   * @param content - 记忆内容
   * @returns 写入是否成功
   */
  writeDailyMemory(date: string, content: string): boolean {
    return this.writeTimeMemory('day', date, content);
  }

  /**
   * 读取周记忆
   * @param yearWeek - 年-周字符串
   * @returns 周记忆内容或 null
   */
  readWeeklyMemory(yearWeek: string): string | null {
    return this.readTimeMemory('week', yearWeek);
  }

  /**
   * 写入周记忆
   * @param yearWeek - 年-周字符串
   * @param content - 记忆内容
   * @returns 写入是否成功
   */
  writeWeeklyMemory(yearWeek: string, content: string): boolean {
    return this.writeTimeMemory('week', yearWeek, content);
  }

  /**
   * 读取月记忆
   * @param yearMonth - 年-月字符串
   * @returns 月记忆内容或 null
   */
  readMonthlyMemory(yearMonth: string): string | null {
    return this.readTimeMemory('month', yearMonth);
  }

  /**
   * 写入月记忆
   * @param yearMonth - 年-月字符串
   * @param content - 记忆内容
   * @returns 写入是否成功
   */
  writeMonthlyMemory(yearMonth: string, content: string): boolean {
    return this.writeTimeMemory('month', yearMonth, content);
  }

  /**
   * 读取年记忆
   * @param year - 年份字符串
   * @returns 年记忆内容或 null
   */
  readYearlyMemory(year: string): string | null {
    return this.readTimeMemory('year', year);
  }

  /**
   * 写入年记忆
   * @param year - 年份字符串
   * @param content - 记忆内容
   * @returns 写入是否成功
   */
  writeYearlyMemory(year: string, content: string): boolean {
    return this.writeTimeMemory('year', year, content);
  }

  /**
   * 获取主题记忆文件路径
   * @param topic - 主题名称
   * @returns 主题记忆文件的完整路径
   */
  private getTopicMemoryPath(topic: string): string {
    return path.join(DATA_ROOT, 'memory', 'topic', `${sanitizeTopicName(topic)}.md`);
  }

  /**
   * 获取归档主题记忆文件路径
   * @param topic - 主题名称
   * @returns 归档主题记忆文件的完整路径
   */
  private getArchivedTopicPath(topic: string): string {
    return path.join(DATA_ROOT, 'memory', 'topic', 'archive', `${sanitizeTopicName(topic)}.md`);
  }

  /**
   * 读取主题记忆
   * 先尝试读取活跃主题，失败后尝试读取归档主题
   * @param topic - 主题名称
   * @returns 主题记忆内容或 null
   */
  readTopicMemory(topic: string): string | null {
    let filePath = this.getTopicMemoryPath(topic);

    let checkedPath = safePath(filePath, DATA_ROOT);
    if (!checkedPath) {
      console.error('Path traversal detected in readTopicMemory');
      return null;
    }

    let content = readFile(checkedPath);
    if (content === null) {
      filePath = this.getArchivedTopicPath(topic);
      checkedPath = safePath(filePath, DATA_ROOT);
      if (!checkedPath) {
        console.error('Path traversal detected in archived readTopicMemory');
        return null;
      }
      content = readFile(checkedPath);
    }
    return content;
  }

  /**
   * 写入主题记忆
   * @param topic - 主题名称
   * @param content - 记忆内容
   * @returns 写入是否成功
   */
  writeTopicMemory(topic: string, content: string): boolean {
    const filePath = this.getTopicMemoryPath(topic);
    const sanitized = sanitizeTopicName(topic);

    const checkedPath = safePath(filePath, DATA_ROOT);
    if (!checkedPath) {
      console.error('Path traversal detected in writeTopicMemory');
      logWAL('writeTopicMemory', topic, filePath, false, { error: 'Path traversal detected' });
      return false;
    }

    const success = writeFile(checkedPath, content);

    // If OpenClaw is detected, sync write to it
    if (success) {
      this.syncWriteToOpenClaw(`memory/topic/${sanitized}.md`, content);
    }

    logWAL('writeTopicMemory', topic, checkedPath, success, {
      sanitized_name: sanitized,
      content_length: content.length,
    });

    return success;
  }

  /**
   * 列出所有记忆主题
   * @returns 包含主题名称和状态的数组，按名称排序
   */
  listMemoryTopics(): { name: string; status: 'active' | 'archived' }[] {
    const activeDir = path.join(DATA_ROOT, 'memory', 'topic');
    const archiveDir = path.join(DATA_ROOT, 'memory', 'topic', 'archive');

    const results: { name: string; status: 'active' | 'archived' }[] = [];

    // 读取活跃主题目录
    if (fs.existsSync(activeDir)) {
      const files = fs.readdirSync(activeDir);
      for (const file of files) {
        if (file.endsWith('.md') && file !== 'archive') {
          results.push({
            name: file.replace('.md', ''),
            status: 'active',
          });
        }
      }
    }

    // 读取归档主题目录
    if (fs.existsSync(archiveDir)) {
      const files = fs.readdirSync(archiveDir);
      for (const file of files) {
        if (file.endsWith('.md')) {
          results.push({
            name: file.replace('.md', ''),
            status: 'archived',
          });
        }
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 归档主题
   * 将活跃主题移动到归档目录
   * @param topic - 要归档的主题名称
   * @returns 归档是否成功
   */
  archiveTopic(topic: string): boolean {
    const activePath = this.getTopicMemoryPath(topic);
    const archivePath = this.getArchivedTopicPath(topic);
    const sanitized = sanitizeTopicName(topic);

    const checkedActive = safePath(activePath, DATA_ROOT);
    const checkedArchive = safePath(archivePath, DATA_ROOT);
    if (!checkedActive || !checkedArchive) {
      console.error('Path traversal detected in archiveTopic');
      logWAL('archiveTopic', topic, activePath, false, { error: 'Path traversal detected' });
      return false;
    }

    if (!fs.existsSync(checkedActive)) {
      console.error(`Topic ${topic} not found`);
      logWAL('archiveTopic', topic, activePath, false, { error: 'Topic not found' });
      return false;
    }

    try {
      const archiveDir = path.dirname(checkedArchive);
      // 使用 recursive: true 的 mkdir 是幂等的 - 不需要先检查目录是否存在
      fs.mkdirSync(archiveDir, { recursive: true });

      // 如果归档文件已存在，先删除
      if (fs.existsSync(checkedArchive)) {
        fs.unlinkSync(checkedArchive);
      }

      fs.renameSync(checkedActive, checkedArchive);

      // If OpenClaw is detected, sync the archive operation to it
      if (this.openclawDataRoot) {
        const ocActivePath = path.join(this.openclawDataRoot, 'memory', 'topic', `${sanitized}.md`);
        const ocArchivePath = path.join(this.openclawDataRoot, 'memory', 'topic', 'archive', `${sanitized}.md`);
        const checkedOcActive = safePath(ocActivePath, this.openclawDataRoot);
        const checkedOcArchive = safePath(ocArchivePath, this.openclawDataRoot);
        if (checkedOcActive && checkedOcArchive) {
          // Ensure archive directory exists using shared helper
          this.ensureDirAndWrite(checkedOcArchive, this.openclawDataRoot, '');
          if (fs.existsSync(checkedOcActive)) {
            if (fs.existsSync(checkedOcArchive)) {
              fs.unlinkSync(checkedOcArchive);
            }
            fs.renameSync(checkedOcActive, checkedOcArchive);
          }
        }
      }

      logWAL('archiveTopic', topic, activePath, true, {
        archived_to: path.relative(PROJECT_ROOT, archivePath),
      });

      return true;
    } catch (e) {
      console.error('Failed to archive topic:', e);
      logWAL('archiveTopic', topic, activePath, false, {
        error: (e as Error).message,
      });
      return false;
    }
  }

  /**
   * 检测主题记忆冲突
   * @param topic - 主题名称
   * @param newContent - 新内容
   * @returns 冲突信息，如果没有冲突返回 null
   */
  detectConflict(topic: string, newContent: string): MemoryConflict | null {
    const existing = this.readTopicMemory(topic);
    if (existing === null || existing.length === 0) {
      return null; // 不存在，不冲突
    }

    // 冲突检测策略：
    // 1. 如果新内容长度是现有内容的 10x+，可能是误覆盖
    if (newContent.length > existing.length * 10) {
      return {
        topic,
        existing_content: existing.length > 200 ? existing.slice(0, 200) + '...' : existing,
        new_content: newContent.length > 200 ? newContent.slice(0, 200) + '...' : newContent,
        conflict_type: 'size_mismatch',
        resolution: null,
      };
    }

    // 2. 检查时间戳冲突 - 简单启发式检测
    const datePattern = /\d{4}-\d{2}-\d{2}/g;
    const existingDates = existing.match(datePattern);
    const newDates = newContent.match(datePattern);
    if (existingDates && newDates && existingDates[0] !== newDates[0]) {
      return {
        topic,
        existing_content: existing,
        new_content: newContent,
        conflict_type: 'timestamp_mismatch',
        resolution: null,
      };
    }

    return null;
  }

  /**
   * 获取人格配置版本信息
   * @returns 版本信息，包含版本号、时间戳和校验和
   */
  getPersonaVersion(): { version: string; timestamp: string; checksum: string } {
    const configPath = path.join(PROJECT_ROOT, 'config', 'persona.yaml');
    if (!fs.existsSync(configPath)) {
      return {
        version: '0.0.0',
        timestamp: new Date().toISOString(),
        checksum: '',
      };
    }

    const content = fs.readFileSync(configPath);
    const checksum = crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
    const mtime = fs.statSync(configPath).mtime;
    const version = `1.0.${Math.floor(mtime.getTime() / 1000)}`;

    return {
      version,
      timestamp: mtime.toISOString(),
      checksum,
    };
  }

  /**
   * 列出灵魂状态的可用版本快照
   * @returns 版本信息列表
   */
  listSoulStateVersions(): Array<{ version: string; timestamp: string }> {
    const historyDir = path.join(DATA_ROOT, 'soul', 'versions');
    const versions: Array<{ version: string; timestamp: string }> = [];

    if (!fs.existsSync(historyDir)) {
      return versions;
    }

    const files = fs.readdirSync(historyDir);
    for (const file of files) {
      if (file.endsWith('.json')) {
        const match = file.match(/^(\d{8}_\d{6})_v(.+)\.json$/);
        if (match) {
          const [, timestampStr, version] = match;
          const year = timestampStr.slice(0, 4);
          const month = timestampStr.slice(4, 6);
          const day = timestampStr.slice(6, 8);
          const hour = timestampStr.slice(9, 11);
          const minute = timestampStr.slice(11, 13);
          const timestamp = `${year}-${month}-${day}T${hour}:${minute}:00Z`;
          versions.push({ version, timestamp });
        }
      }
    }

    return versions.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * 回滚灵魂状态到指定版本
   * @param version - 目标版本标识
   * @returns 是否回滚成功
   */
  rollbackSoulState(version: string): boolean {
    const historyDir = path.join(DATA_ROOT, 'soul', 'versions');
    if (!fs.existsSync(historyDir)) {
      console.error('No version history found');
      return false;
    }

    let foundPath: string | null = null;
    const files = fs.readdirSync(historyDir);
    for (const file of files) {
      if (file.includes(`_v${version}.json`) || file.endsWith(`_v${version}.json`)) {
        foundPath = path.join(historyDir, file);
        break;
      }
    }

    if (!foundPath || !fs.existsSync(foundPath)) {
      console.error(`Version ${version} not found`);
      return false;
    }

    try {
      const content = fs.readFileSync(foundPath, 'utf8');
      const state = JSON.parse(content) as SoulState;
      return this.writeSoulState(state);
    } catch (e) {
      console.error('Failed to rollback:', e);
      return false;
    }
  }
}
