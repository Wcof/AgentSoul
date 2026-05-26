/**
 * @fileoverview 通用工具函数
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync, renameSync, unlinkSync, readdirSync, appendFileSync } from 'fs';
import { dirname, resolve as resolvePath, join as pathJoin } from 'path';
import { PROJECT_ROOT } from './paths.js';

export function resolve(...parts: string[]): string {
  return resolvePath(PROJECT_ROOT, ...parts);
}

export function safePath(filePath: string, rootPath: string = PROJECT_ROOT): string | null {
  const resolved = resolvePath(filePath);
  if (!resolved.startsWith(rootPath)) return null;
  return resolved;
}

export function readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): string | null {
  try {
    const safeFile = safePath(filePath);
    if (!safeFile || !existsSync(safeFile)) return null;
    return readFileSync(safeFile, { encoding });
  } catch (error) { return null; }
}

export function writeFile(filePath: string, content: string, maxRetries: number = 3): boolean {
  const safeFile = safePath(filePath);
  if (!safeFile) return false;
  const parentDir = dirname(safeFile);
  if (!existsSync(parentDir)) mkdirSync(parentDir, { recursive: true });
  const tempPath = `${safeFile}.tmp.${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      writeFileSync(tempPath, content, { encoding: 'utf-8' });
      renameSync(tempPath, safeFile);
      return true;
    } catch (error) {
      try { unlinkSync(tempPath); } catch (e) { }
      if (attempt === maxRetries) return false;
    }
  }
  return false;
}

export function readJson(filePath: string): unknown | null {
  const content = readFile(filePath);
  if (!content) return null;
  try { return JSON.parse(content); } catch (error) { return null; }
}

export function writeJson(filePath: string, data: unknown, maxRetries: number = 3): boolean {
  return writeFile(filePath, JSON.stringify(data, null, 2), maxRetries);
}

export function safeGet<T>(obj: unknown, key: string, defaultValue: T): T {
  if (obj && typeof obj === 'object' && key in (obj as Record<string, unknown>)) {
    const value = (obj as Record<string, unknown>)[key];
    return value as T;
  }
  return defaultValue;
}

export function toList<T>(value: T | T[] | undefined | null, defaultValue: T[] = []): T[] {
  if (value === undefined || value === null) return defaultValue;
  if (Array.isArray(value)) return value;
  return [value];
}

export function sanitizeTopicName(topic: string): string {
  return topic.replace(/[^a-zA-Z0-9_\-\u4e00-\u9fff]/g, '_').slice(0, 100);
}

/**
 * Write-Ahead Log (WAL) function
 * Appends a log entry to the WAL file before each write operation for crash recovery.
 * @param operation - The operation type (e.g., 'write_time_memory', 'entity_storage_write')
 * @param target - The target file or resource path
 * @param details - Additional details about the operation
 */
export function logWAL(operation: string, target: string, details: Record<string, unknown> = {}): void {
  const walDir = resolve('data', 'wal');
  if (!existsSync(walDir)) mkdirSync(walDir, { recursive: true });
  const walPath = pathJoin(walDir, 'write_log.jsonl');

  const entry = {
    timestamp: new Date().toISOString(),
    operation,
    target,
    ...details,
  };

  try {
    appendFileSync(walPath, JSON.stringify(entry) + '\n', { encoding: 'utf-8' });
  } catch (error) {
    // WAL failure should not block the main operation
    // Just log to stderr for debugging
    if (process.env.AGENTSOUL_DEBUG === '1') {
      console.error('[AgentSoul WAL] Failed to write WAL entry:', error);
    }
  }
}

export function cleanupEmptyDirs(dirPath: string): boolean {
  try {
    if (!existsSync(dirPath)) return true;
    const entries = readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolvePath(dirPath, entry.name);
      if (entry.isDirectory()) cleanupEmptyDirs(fullPath);
    }
    const remaining = readdirSync(dirPath);
    if (remaining.length === 0) rmSync(dirPath, { recursive: true, force: true });
    return true;
  } catch (error) { return false; }
}

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

export function isEmpty(obj: unknown): boolean {
  if (obj === null || obj === undefined) return true;
  if (Array.isArray(obj)) return obj.length === 0;
  if (typeof obj === 'object') return Object.keys(obj).length === 0;
  return false;
}
