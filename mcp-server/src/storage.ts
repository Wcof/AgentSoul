// AgentSoul MCP - Storage utilities

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { SoulState, PersonaConfig } from './types.js';

export class StorageManager {
  private projectRoot: string;

  constructor(projectRoot?: string) {
    if (projectRoot) {
      this.projectRoot = projectRoot;
    } else {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      this.projectRoot = path.resolve(__dirname, '../../..');
    }
  }

  /**
   * Validate that the resolved path stays within project data directory
   * to prevent path traversal attacks
   */
  private validateDataPath(requestedPath: string): boolean {
    const dataRoot = path.join(this.projectRoot, 'data');
    const resolved = path.resolve(requestedPath);
    return resolved.startsWith(dataRoot);
  }

  // Read persona configuration
  readPersonaConfig(): PersonaConfig {
    const configPath = path.join(this.projectRoot, 'config', 'persona.yaml');

    if (!fs.existsSync(configPath)) {
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

    const content = fs.readFileSync(configPath, 'utf-8');
    const raw = yaml.load(content) as Record<string, any>;

    // Handle different config formats
    let aiData: any;
    let masterData: any;

    if (raw.agent) {
      aiData = raw.agent;
      masterData = raw.master || {};
    } else if (raw.persona && raw.persona.ai) {
      aiData = raw.persona.ai;
      masterData = raw.persona.master || {};
    } else if (raw.ai) {
      aiData = raw.ai;
      masterData = raw.master || {};
    } else {
      aiData = { name: 'Agent' };
      masterData = {};
    }

    const toList = (v: any): string[] => {
      if (Array.isArray(v)) return v.filter(x => typeof x === 'string' && x.trim());
      if (typeof v === 'string') {
        if (v.includes(',')) {
          return v.split(',').map(x => x.trim()).filter(x => x);
        }
        return v.trim() ? [v.trim()] : [];
      }
      return [];
    };

    const safeGet = (obj: any, key: string, defaultValue: any): any => {
      if (!obj || typeof obj !== 'object') return defaultValue;
      const val = obj[key];
      return val === undefined || val === null ? defaultValue : val;
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

  // Read base rule file
  readBaseRule(filename: string): string | null {
    const rulePath = path.join(this.projectRoot, 'src', filename);
    if (!fs.existsSync(rulePath)) {
      return null;
    }
    return fs.readFileSync(rulePath, 'utf-8');
  }

  // Get soul state path
  private getSoulStatePath(): string {
    return path.join(this.projectRoot, 'data', 'soul', 'soul_variable', 'state_vector.json');
  }

  // Read current soul state
  readSoulState(): SoulState {
    const statePath = this.getSoulStatePath();

    if (!this.validateDataPath(statePath)) {
      console.error('Path traversal detected in readSoulState');
      return {
        pleasure: 0.3,
        arousal: 0.2,
        dominance: 0.3,
        last_updated: null,
        history: [],
      };
    }

    if (!fs.existsSync(statePath)) {
      // Return default baseline
      return {
        pleasure: 0.3,
        arousal: 0.2,
        dominance: 0.3,
        last_updated: null,
        history: [],
      };
    }

    try {
      const content = fs.readFileSync(statePath, 'utf-8');
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

  // Write soul state
  writeSoulState(state: SoulState): boolean {
    const statePath = this.getSoulStatePath();

    if (!this.validateDataPath(statePath)) {
      console.error('Path traversal detected in writeSoulState');
      return false;
    }

    const dir = path.dirname(statePath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write soul state:', e);
      return false;
    }
  }

  // Generic time-based memory path getter
  private getTimeMemoryPath(period: 'day' | 'week' | 'month' | 'year', identifier: string): string {
    return path.join(this.projectRoot, 'data', 'memory', period, `${identifier}.md`);
  }

  // Read time-based memory (generic)
  private readTimeMemory(period: 'day' | 'week' | 'month' | 'year', identifier: string): string | null {
    const filePath = this.getTimeMemoryPath(period, identifier);

    if (!this.validateDataPath(filePath)) {
      console.error(`Path traversal detected in read${period}Memory`);
      return null;
    }

    if (!fs.existsSync(filePath)) {
      return null;
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  // Write time-based memory (generic)
  private writeTimeMemory(period: 'day' | 'week' | 'month' | 'year', identifier: string, content: string): boolean {
    const filePath = this.getTimeMemoryPath(period, identifier);

    if (!this.validateDataPath(filePath)) {
      console.error(`Path traversal detected in write${period}Memory`);
      return false;
    }

    const dir = path.dirname(filePath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error(`Failed to write ${period} memory:`, e);
      return false;
    }
  }

  // Daily memory specific methods (public API preserved)
  readDailyMemory(date: string): string | null {
    return this.readTimeMemory('day', date);
  }

  writeDailyMemory(date: string, content: string): boolean {
    return this.writeTimeMemory('day', date, content);
  }

  // Weekly memory
  readWeeklyMemory(yearWeek: string): string | null {
    return this.readTimeMemory('week', yearWeek);
  }

  writeWeeklyMemory(yearWeek: string, content: string): boolean {
    return this.writeTimeMemory('week', yearWeek, content);
  }

  // Monthly memory
  readMonthlyMemory(yearMonth: string): string | null {
    return this.readTimeMemory('month', yearMonth);
  }

  writeMonthlyMemory(yearMonth: string, content: string): boolean {
    return this.writeTimeMemory('month', yearMonth, content);
  }

  // Yearly memory
  readYearlyMemory(year: string): string | null {
    return this.readTimeMemory('year', year);
  }

  writeYearlyMemory(year: string, content: string): boolean {
    return this.writeTimeMemory('year', year, content);
  }

  // Get topic memory path
  private getTopicMemoryPath(topic: string): string {
    return path.join(this.projectRoot, 'data', 'memory', 'topic', `${topic.replace(/\//g, '_')}.md`);
  }

  // Get archived topic path
  private getArchivedTopicPath(topic: string): string {
    return path.join(this.projectRoot, 'data', 'memory', 'topic', 'archive', `${topic.replace(/\//g, '_')}.md`);
  }

  // Read topic memory
  readTopicMemory(topic: string): string | null {
    let filePath = this.getTopicMemoryPath(topic);

    if (!this.validateDataPath(filePath)) {
      console.error('Path traversal detected in readTopicMemory');
      return null;
    }

    if (!fs.existsSync(filePath)) {
      filePath = this.getArchivedTopicPath(topic);
      if (!this.validateDataPath(filePath)) {
        console.error('Path traversal detected in archived readTopicMemory');
        return null;
      }
      if (!fs.existsSync(filePath)) {
        return null;
      }
    }
    return fs.readFileSync(filePath, 'utf-8');
  }

  // Write topic memory
  writeTopicMemory(topic: string, content: string): boolean {
    const filePath = this.getTopicMemoryPath(topic);

    if (!this.validateDataPath(filePath)) {
      console.error('Path traversal detected in writeTopicMemory');
      return false;
    }

    const dir = path.dirname(filePath);

    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error('Failed to write topic memory:', e);
      return false;
    }
  }

  // List all memory topics
  listMemoryTopics(): { name: string; status: 'active' | 'archived' }[] {
    const activeDir = path.join(this.projectRoot, 'data', 'memory', 'topic');
    const archiveDir = path.join(this.projectRoot, 'data', 'memory', 'topic', 'archive');

    const results: { name: string; status: 'active' | 'archived' }[] = [];

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

  // Archive topic
  archiveTopic(topic: string): boolean {
    const activePath = this.getTopicMemoryPath(topic);
    const archivePath = this.getArchivedTopicPath(topic);

    if (!this.validateDataPath(activePath) || !this.validateDataPath(archivePath)) {
      console.error('Path traversal detected in archiveTopic');
      return false;
    }

    if (!fs.existsSync(activePath)) {
      console.error(`Topic ${topic} not found`);
      return false;
    }

    try {
      const archiveDir = path.dirname(archivePath);
      if (!fs.existsSync(archiveDir)) {
        fs.mkdirSync(archiveDir, { recursive: true });
      }

      if (fs.existsSync(archivePath)) {
        fs.unlinkSync(archivePath);
      }

      fs.renameSync(activePath, archivePath);
      return true;
    } catch (e) {
      console.error('Failed to archive topic:', e);
      return false;
    }
  }
}
