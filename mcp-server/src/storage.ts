/**
 * @fileoverview AgentSoul MCP - 存储工具模块
 * @description 提供数据持久化功能，包括人格配置读取、灵魂状态管理、时间记忆和主题记忆的读写操作
 */

import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { safePath, readFile } from './lib/utils.js';
import { PROJECT_ROOT } from './lib/paths.js';
import { SoulState, PersonaConfig } from './types.js';

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

/** 数据根目录路径 */
const DATA_ROOT = path.join(PROJECT_ROOT, 'data');

/**
 * 存储管理器类
 * 负责 AgentSoul 所有数据的持久化操作，包括人格配置、灵魂状态和各种记忆
 */
export class StorageManager {
  /**
   * 构造函数
   * @param projectRoot - 可选的项目根目录，用于向后兼容
   */
  constructor(projectRoot?: string) {
    // 保留构造函数用于向后兼容性 - 如果提供则覆盖，否则使用 paths 中的 PROJECT_ROOT
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
      return {
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

    /**
     * 将值转换为字符串数组
     * 支持数组、逗号分隔字符串和单个字符串格式
     * @param v - 输入值
     * @returns 标准化的字符串数组
     */
    const toList = (v: unknown): string[] => {
      if (Array.isArray(v)) return (v as string[]).filter(x => typeof x === 'string' && x.trim());
      if (typeof v === 'string') {
        if (v.includes(',')) {
          return v.split(',').map(x => x.trim()).filter(x => x);
        }
        return v.trim() ? [v.trim()] : [];
      }
      return [];
    };

    /**
     * 安全地获取对象属性值
     * @param obj - 目标对象
     * @param key - 属性键
     * @param defaultValue - 默认值
     * @returns 属性值或默认值
     */
    const safeGet = <T>(obj: Record<string, unknown> | undefined, key: string, defaultValue: T): T => {
      if (!obj || typeof obj !== 'object') return defaultValue;
      const val = obj[key];
      return val === undefined || val === null ? defaultValue : val as T;
    };

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
      return {
        pleasure: 0.3,
        arousal: 0.2,
        dominance: 0.3,
        last_updated: null,
        history: [],
      };
    }

    const content = readFile(checkedPath);
    if (content === null) {
      // 返回默认基准状态
      return {
        pleasure: 0.3,
        arousal: 0.2,
        dominance: 0.3,
        last_updated: null,
        history: [],
      };
    }

    try {
      return JSON.parse(content) as SoulState;
    } catch (e) {
      return {
        pleasure: 0.3,
        arousal: 0.2,
        dominance: 0.3,
        last_updated: null,
        history: [],
      };
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

    const dir = path.dirname(checkedPath);

    try {
      // 使用 recursive: true 的 mkdir 是幂等的 - 不需要先检查目录是否存在
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(checkedPath, JSON.stringify(state, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write soul state:', e);
      return false;
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

    const dir = path.dirname(checkedPath);

    try {
      // 使用 recursive: true 的 mkdir 是幂等的 - 不需要先检查目录是否存在
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(checkedPath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error(`Failed to write ${period} memory:`, e);
      return false;
    }
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
    return path.join(DATA_ROOT, 'memory', 'topic', `${topic.replace(/\//g, '_')}.md`);
  }

  /**
   * 获取归档主题记忆文件路径
   * @param topic - 主题名称
   * @returns 归档主题记忆文件的完整路径
   */
  private getArchivedTopicPath(topic: string): string {
    return path.join(DATA_ROOT, 'memory', 'topic', 'archive', `${topic.replace(/\//g, '_')}.md`);
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

    const checkedPath = safePath(filePath, DATA_ROOT);
    if (!checkedPath) {
      console.error('Path traversal detected in writeTopicMemory');
      return false;
    }

    const dir = path.dirname(checkedPath);

    try {
      // 使用 recursive: true 的 mkdir 是幂等的 - 不需要先检查目录是否存在
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(checkedPath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write topic memory:', e);
      return false;
    }
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
      return true;
    } catch (e) {
      console.error('Failed to archive topic:', e);
      return false;
    }
  }
}
