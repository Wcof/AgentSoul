/**
 * @fileoverview KV-Cache 三级缓存模块
 */

import { readJson, writeJson, resolve, generateId, logWAL } from '../utils.js';
import { KVCacheConfig } from '../config.js';

export interface SessionSnapshot {
  id: string; agent: string; project: string; summary: string; decisions: string[];
  filesChanged: Array<{ path: string; desc?: string }>; todo: string[];
  parentSessionId?: string; createdAt: string; lastAccessed: string;
  accessCount: number; dataSize: number; tier: 'hot' | 'warm' | 'cold';
}

export interface SaveParams {
  summary: string; decisions?: string[]; filesChanged?: Array<{ path: string; desc?: string }>;
  todo?: string[]; parentSessionId?: string;
}

export interface LoadParams { budget?: number; }

export interface SearchResults {
  count: number;
  results: Array<{ id: string; project: string; summary: string; createdAt: string; relevance: number }>;
}

export class SoulKVCache {
  private readonly cacheDir: string;
  private readonly config: KVCacheConfig;

  constructor(dataDir: string, config: KVCacheConfig) {
    this.cacheDir = resolve(dataDir, 'kv-cache', 'snapshots');
    this.config = config;
  }

  private getSnapshotPath(project: string, id: string): string { return resolve(this.cacheDir, project, `${id}.json`); }
  private getListPath(project: string): string { return resolve(this.cacheDir, project, '_index.json'); }

  private loadIndex(project: string): Map<string, Omit<SessionSnapshot, 'summary' | 'decisions' | 'filesChanged' | 'todo'>> {
    const data = readJson(this.getListPath(project));
    if (data && Array.isArray(data)) {
      const index = new Map<string, Omit<SessionSnapshot, 'summary' | 'decisions' | 'filesChanged' | 'todo'>>();
      for (const item of data as SessionSnapshot[]) {
        index.set(item.id, { id: item.id, agent: item.agent, project: item.project,
          createdAt: item.createdAt, lastAccessed: item.lastAccessed, accessCount: item.accessCount,
          dataSize: item.dataSize, tier: item.tier });
      }
      return index;
    }
    return new Map();
  }

  private saveIndex(project: string, index: Map<string, Omit<SessionSnapshot, 'summary' | 'decisions' | 'filesChanged' | 'todo'>>): boolean {
    const result = writeJson(this.getListPath(project), Array.from(index.values()));
    if (result) {
      logWAL('kv_cache_index_write', `project:${project}`, { entryCount: index.size });
    }
    return result;
  }

  private determineTier(createdAt: string): 'hot' | 'warm' | 'cold' {
    const ageMs = Date.now() - new Date(createdAt).getTime();
    const hotMs = this.config.hotDays * 24 * 60 * 60 * 1000;
    const warmMs = this.config.warmDays * 24 * 60 * 60 * 1000;
    if (ageMs < hotMs) return 'hot';
    if (ageMs < warmMs) return 'warm';
    return 'cold';
  }

  async save(agent: string, project: string, params: SaveParams): Promise<string> {
    const id = generateId();
    const now = new Date().toISOString();
    const dataSize = Buffer.byteLength(JSON.stringify({ summary: params.summary, decisions: params.decisions, filesChanged: params.filesChanged, todo: params.todo }), 'utf-8');
    const snapshot: SessionSnapshot = {
      id, agent, project, summary: params.summary || '', decisions: params.decisions || [],
      filesChanged: params.filesChanged || [], todo: params.todo || [], parentSessionId: params.parentSessionId,
      createdAt: now, lastAccessed: now, accessCount: 1, dataSize, tier: this.determineTier(now)
    };
    writeJson(this.getSnapshotPath(project, id), snapshot);
    const index = this.loadIndex(project);
    index.set(id, { id, agent, project, createdAt: now, lastAccessed: now, accessCount: 1, dataSize, tier: snapshot.tier });
    if (index.size > this.config.maxSnapshots) {
      const sorted = Array.from(index.entries()).sort((a, b) => a[1].createdAt.localeCompare(b[1].createdAt));
      for (const [id] of sorted.slice(0, sorted.length - this.config.maxSnapshots)) index.delete(id);
    }
    this.saveIndex(project, index);
    logWAL('kv_cache_save', `project:${project}:snapshot:${id}`, { agent, tier: snapshot.tier });
    return id;
  }

  async load(project: string, params: LoadParams = {}): Promise<{ snapshots: SessionSnapshot[]; totalSize: number; tokenEstimate: number }> {
    const index = this.loadIndex(project);
    const snapshots: SessionSnapshot[] = [];
    let totalSize = 0;
    for (const meta of Array.from(index.values()).sort((a, b) => b.lastAccessed.localeCompare(a.lastAccessed))) {
      const data = readJson(this.getSnapshotPath(project, meta.id));
      if (data) { snapshots.push(data as SessionSnapshot); totalSize += meta.dataSize; }
    }
    return { snapshots, totalSize, tokenEstimate: Math.floor(totalSize / 4) };
  }

  async search(query: string, project: string, limit: number = 10): Promise<SearchResults> {
    const index = this.loadIndex(project);
    const results: Array<{ id: string; project: string; summary: string; createdAt: string; relevance: number }> = [];
    const q = query.toLowerCase();
    for (const [id, meta] of index.entries()) {
      const data = readJson(this.getSnapshotPath(project, id));
      if (data && typeof data === 'object' && 'summary' in data) {
        const summary = (data as SessionSnapshot).summary.toLowerCase();
        if (summary.includes(q)) results.push({ id, project: meta.project, summary: (data as SessionSnapshot).summary, createdAt: meta.createdAt, relevance: summary.split(q).length - 1 });
      }
    }
    results.sort((a, b) => b.relevance - a.relevance);
    return { count: results.length, results: results.slice(0, limit) };
  }

  async listSnapshots(project: string, limit: number = 50): Promise<Array<{ id: string; createdAt: string; tier: string; dataSize: number }>> {
    return Array.from(this.loadIndex(project).values())
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
      .map(m => ({ id: m.id, createdAt: m.createdAt, tier: m.tier, dataSize: m.dataSize }));
  }

  async gc(project: string): Promise<{ scanned: number; removed: number; freedBytes: number }> {
    const index = this.loadIndex(project);
    const now = Date.now();
    let removed = 0, freedBytes = 0;
    for (const [id, meta] of index.entries()) {
      const ageDays = (now - new Date(meta.createdAt).getTime()) / (24 * 60 * 60 * 1000);
      if (meta.tier === 'cold' && Math.exp(-ageDays / 30) < this.config.gcThreshold) {
        index.delete(id); removed++; freedBytes += meta.dataSize;
      }
    }
    if (removed > 0) this.saveIndex(project, index);
    return { scanned: index.size + removed, removed, freedBytes };
  }

  async backendInfo(project: string): Promise<{ totalSnapshots: number; totalSize: number; hotCount: number; warmCount: number; coldCount: number; sqliteEnabled: boolean }> {
    const index = this.loadIndex(project);
    let hotCount = 0, warmCount = 0, coldCount = 0, totalSize = 0;
    for (const meta of index.values()) {
      totalSize += meta.dataSize;
      if (meta.tier === 'hot') hotCount++; else if (meta.tier === 'warm') warmCount++; else coldCount++;
    }
    return { totalSnapshots: index.size, totalSize, hotCount, warmCount, coldCount, sqliteEnabled: this.config.useSqliteBackend };
  }
}
