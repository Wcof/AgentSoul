/**
 * @fileoverview AgentSoul MCP - 存储工具模块
 * @description 提供数据持久化功能，包括人格配置读取、灵魂状态管理、时间记忆和主题记忆的读写操作
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import crypto from 'crypto';
import { safePath, readFile, writeFile, sanitizeTopicName, safeGet, toList } from './lib/utils.js';
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

// Import shared utilities from utils - already imported at top, duplicate import removed

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
      return false;
    }

    const success = writeFile(checkedPath, content);

    // If OpenClaw is detected, sync write to it
    if (success) {
      this.syncWriteToOpenClaw(`memory/${period}/${identifier}.md`, content);
    }

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
      return false;
    }

    const success = writeFile(checkedPath, content);

    // If OpenClaw is detected, sync write to it
    if (success) {
      this.syncWriteToOpenClaw(`memory/topic/${sanitized}.md`, content);
    }

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
      return false;
    }

    if (!fs.existsSync(checkedActive)) {
      console.error(`Topic ${topic} not found`);
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

      return true;
    } catch (e) {
      console.error('Failed to archive topic:', e);
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
