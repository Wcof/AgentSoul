/**
 * @fileoverview 核心记忆模块
 */

import { readJson, writeJson, resolve } from './utils.js';
import config from './config.js';

export interface CoreMemoryData {
  agentName: string;
  entries: Record<string, string>;
  updatedAt: string;
  version: number;
}

export interface CoreMemoryResult {
  success: boolean;
  message: string;
  data?: unknown;
}

export class CoreMemory {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = resolve(dataDir, 'core-memory');
  }

  private getMemoryPath(agentName: string): string {
    const safeAgentName = agentName.replace(/[^a-zA-Z0-9_-]/g, '_');
    return resolve(this.dataDir, `${safeAgentName}.json`);
  }

  read(agentName: string): CoreMemoryData {
    const path = this.getMemoryPath(agentName);
    const data = readJson(path);
    if (data && typeof data === 'object' && 'entries' in data) return data as CoreMemoryData;
    return { agentName, entries: {}, updatedAt: new Date().toISOString(), version: 1 };
  }

  write(agentName: string, key: string, value: string): CoreMemoryResult {
    try {
      const current = this.read(agentName);
      current.entries[key] = value;
      current.updatedAt = new Date().toISOString();
      current.version++;
      if (writeJson(this.getMemoryPath(agentName), current)) {
        return { success: true, message: `Successfully wrote key "${key}"`, data: { key, value } };
      }
      return { success: false, message: 'Failed to write memory' };
    } catch (error) {
      return { success: false, message: `Error: ${error instanceof Error ? error.message : String(error)}` };
    }
  }

  remove(agentName: string, key: string): boolean {
    const current = this.read(agentName);
    if (!(key in current.entries)) return false;
    delete current.entries[key];
    current.updatedAt = new Date().toISOString();
    current.version++;
    return writeJson(this.getMemoryPath(agentName), current);
  }

  keys(agentName: string): string[] {
    return Object.keys(this.read(agentName).entries);
  }

  clear(agentName: string): boolean {
    return writeJson(this.getMemoryPath(agentName), {
      agentName, entries: {}, updatedAt: new Date().toISOString(), version: 1
    });
  }
}
