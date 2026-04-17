/**
 * @fileoverview Core Memory - Persistent per-agent facts
 * @description Core memory stores key-value facts about the agent that are automatically loaded at boot
 */

import fs from 'fs';
import path from 'path';
import { safePath, logWAL } from './utils.js';
import { DATA_ROOT } from './paths.js';

/**
 * Core memory entry structure
 */
export interface CoreMemoryEntry {
  /** The key (fact identifier) */
  key: string;
  /** The value (fact content) */
  value: string;
  /** Timestamp when created */
  created_at: number;
  /** Timestamp when last updated */
  updated_at: number;
}

/**
 * Core memory storage for one agent
 */
interface AgentCoreMemory {
  entries: Record<string, CoreMemoryEntry>;
  version: number;
}

/**
 * Default empty core memory - created once at module load
 */
const DEFAULT_EMPTY_STORAGE: AgentCoreMemory = {
  entries: {},
  version: 1,
};

/**
 * Get a copy of the default empty storage
 */
function getEmptyStorage(): AgentCoreMemory {
  return { ...DEFAULT_EMPTY_STORAGE, entries: {} };
}

/**
 * Core Memory class - per-agent persistent facts
 */
export class CoreMemory {
  private baseDir: string;

  /**
   * Constructor
   * @param dataDir - Base data directory
   */
  constructor(dataDir: string) {
    this.baseDir = path.join(dataDir, 'core-memory');
    this.ensureDirectory();
  }

  /**
   * Ensure the storage directory exists
   */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
  }

  /**
   * Get the storage file path for an agent
   */
  private getStoragePath(agentName: string): string {
    return path.join(this.baseDir, `${agentName}.json`);
  }

  /**
   * Read storage from disk
   */
  private readStorage(agentName: string): AgentCoreMemory {
    const checkedPath = safePath(this.getStoragePath(agentName), this.baseDir);
    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return getEmptyStorage();
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      return JSON.parse(content) as AgentCoreMemory;
    } catch (e) {
      console.error(`Error reading core memory for ${agentName}:`, e);
      return getEmptyStorage();
    }
  }

  /**
   * Write storage to disk
   */
  private writeStorage(agentName: string, storage: AgentCoreMemory): boolean {
    const checkedPath = safePath(this.getStoragePath(agentName), this.baseDir);
    if (!checkedPath) {
      console.error('Path traversal detected in core memory');
      logWAL('core_memory_write', agentName, this.getStoragePath(agentName), false, { error: 'Path traversal detected' });
      return false;
    }

    try {
      const content = JSON.stringify(storage, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      const success = true;
      logWAL('core_memory_write', agentName, checkedPath, success, {
        entry_count: Object.keys(storage.entries).length,
      });
      return success;
    } catch (e) {
      console.error(`Error writing core memory for ${agentName}:`, e);
      logWAL('core_memory_write', agentName, checkedPath, false, {
        error: (e as Error).message,
      });
      return false;
    }
  }

  /**
   * Read all core memory entries for an agent
   * @param agentName - Agent name
   * @returns Object with all key-value entries
   */
  read(agentName: string = 'default'): Record<string, string> {
    const storage = this.readStorage(agentName);
    const result: Record<string, string> = {};
    for (const [key, entry] of Object.entries(storage.entries)) {
      result[key] = entry.value;
    }
    return result;
  }

  /**
   * Write a fact to core memory
   * @param agentName - Agent name
   * @param key - Fact key
   * @param value - Fact value
   * @returns True if successful
   */
  write(agentName: string = 'default', key: string, value: string): boolean {
    const storage = this.readStorage(agentName);
    const now = Date.now();

    if (storage.entries[key]) {
      // Update existing entry
      storage.entries[key] = {
        ...storage.entries[key],
        value,
        updated_at: now,
      };
    } else {
      // Create new entry
      storage.entries[key] = {
        key,
        value,
        created_at: now,
        updated_at: now,
      };
    }

    return this.writeStorage(agentName, storage);
  }

  /**
   * Delete a fact from core memory
   * @param agentName - Agent name
   * @param key - Key to delete
   * @returns True if deleted, false if not found
   */
  remove(agentName: string = 'default', key: string): boolean {
    const storage = this.readStorage(agentName);

    if (!storage.entries[key]) {
      return false;
    }

    delete storage.entries[key];
    return this.writeStorage(agentName, storage);
  }

  /**
   * List all keys in core memory for an agent
   * @param agentName - Agent name
   * @returns Array of keys sorted alphabetically
   */
  keys(agentName: string = 'default'): string[] {
    const storage = this.readStorage(agentName);
    return Object.keys(storage.entries).sort();
  }

  /**
   * Get the number of entries for an agent
   * @param agentName - Agent name
   * @returns Count of entries
   */
  count(agentName: string = 'default'): number {
    const storage = this.readStorage(agentName);
    return Object.keys(storage.entries).length;
  }

  /**
   * Clear all entries for an agent
   * @param agentName - Agent name
   * @returns True if cleared
   */
  clear(agentName: string = 'default'): boolean {
    const storage = getEmptyStorage();
    return this.writeStorage(agentName, storage);
  }
}

export default CoreMemory;
