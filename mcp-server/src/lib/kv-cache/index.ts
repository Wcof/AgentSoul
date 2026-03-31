/**
 * @fileoverview 3-Tier KV-Cache with Ebbinghaus Forgetting Curve GC
 * @description Session cache with automatic Hot/Warm/Cold tiering and garbage collection
 * Based on Ebbinghaus forgetting curve - items that haven't been accessed get archived/removed.
 */

import fs from 'fs';
import path from 'path';
import { safePath } from '../utils.js';

// ============================================================================
// Types
// ============================================================================

/**
 * A cached session snapshot
 */

// ============================================================================
// Module-level constants (created once at module load)
// ============================================================================

/**
 * Tier names array - created once at module load
 */
const TIERS: Tier[] = ['hot', 'warm', 'cold'];

/**
 * Ebbinghaus forgetting curve constant c = 1.25 for typical forgetting
 */
const EBBINGHAUS_C = 1.25;

// ============================================================================
// Types
// ============================================================================
export interface CacheSnapshot {
  /** Unique snapshot ID */
  id: string;
  /** Project identifier */
  project_id: string;
  /** Session creation timestamp */
  created_at: number;
  /** Last access timestamp */
  accessed_at: number;
  /** Number of times accessed */
  access_count: number;
  /** Approximate token count */
  token_count: number;
  /** The actual cached content */
  content: string;
  /** Metadata tags for search */
  tags: string[];
  /** Additional metadata for structured session data */
  metadata?: {
    summary?: string;
    decisions?: string[];
    filesChanged?: Array<{path: string; desc?: string}>;
    todo?: string[];
    parentSessionId?: string;
  };
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hot_count: number;
  warm_count: number;
  cold_count: number;
  total_count: number;
  total_tokens: number;
  total_size_bytes: number;
}

/**
 * Tier information
 */
type Tier = 'hot' | 'warm' | 'cold';

/**
 * Cache index - metadata about all snapshots
 */
interface CacheIndex {
  snapshots: Record<string, Omit<CacheSnapshot, 'content'>>;
}

// ============================================================================
// SoulKVCache Class
// ============================================================================

/**
 * 3-Tier KV Cache with Ebbinghaus forgetting
 */
export class SoulKVCache {
  private baseDir: string;

  /**
   * Constructor
   * @param dataDir - Base data directory
   * @param kvCacheDir - Optional specific KV cache directory (for backward compatibility)
   */
  constructor(dataDir: string, kvCacheDir?: string) {
    this.baseDir = kvCacheDir || path.join(dataDir, 'kv-cache');
    this.ensureDirectories();
  }

  // ============================================================================
  // Path Management
  // ============================================================================

  private getSnapshotPath(tier: Tier, snapshotId: string): string {
    return path.join(this.baseDir, tier, `${snapshotId}.json`);
  }

  private getIndexPath(): string {
    return path.join(this.baseDir, 'index.json');
  }

  private ensureDirectories(): void {
    for (const tier of TIERS) {
      const dir = path.join(this.baseDir, tier);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  // ============================================================================
  // Index Management
  // ============================================================================

  /**
   * Cache index - metadata about all snapshots
   */
  private readIndex(): CacheIndex {
    const indexPath = this.getIndexPath();
    const checkedPath = safePath(indexPath, this.baseDir);

    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return { snapshots: {} };
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      return JSON.parse(content) as CacheIndex;
    } catch (e) {
      console.error('Error reading cache index:', e);
      return { snapshots: {} };
    }
  }

  private writeIndex(index: CacheIndex): boolean {
    const indexPath = this.getIndexPath();
    const checkedPath = safePath(indexPath, this.baseDir);

    if (!checkedPath) {
      console.error('Path traversal detected in cache index');
      return false;
    }

    try {
      const content = JSON.stringify(index, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error('Error writing cache index:', e);
      return false;
    }
  }

  // ============================================================================
  // Snapshot I/O
  // ============================================================================

  private readSnapshot(snapshotId: string, tier: Tier): CacheSnapshot | null {
    const snapshotPath = this.getSnapshotPath(tier, snapshotId);
    const checkedPath = safePath(snapshotPath, this.baseDir);

    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      return JSON.parse(content) as CacheSnapshot;
    } catch (e) {
      console.error(`Error reading snapshot ${snapshotId}:`, e);
      return null;
    }
  }

  private writeSnapshot(snapshot: CacheSnapshot, tier: Tier): boolean {
    const snapshotPath = this.getSnapshotPath(tier, snapshot.id);
    const checkedPath = safePath(snapshotPath, this.baseDir);

    if (!checkedPath) {
      console.error('Path traversal detected in snapshot write');
      return false;
    }

    try {
      const content = JSON.stringify(snapshot, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error(`Error writing snapshot ${snapshot.id}:`, e);
      return false;
    }
  }

  private deleteSnapshot(snapshotId: string, tier: Tier): boolean {
    const snapshotPath = this.getSnapshotPath(tier, snapshotId);
    const checkedPath = safePath(snapshotPath, this.baseDir);

    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return false;
    }

    try {
      fs.unlinkSync(checkedPath);
      return true;
    } catch (e) {
      console.error(`Error deleting snapshot ${snapshotId}:`, e);
      return false;
    }
  }

  private moveSnapshot(snapshotId: string, fromTier: Tier, toTier: Tier): boolean {
    const snapshot = this.readSnapshot(snapshotId, fromTier);
    if (!snapshot) return false;

    if (this.writeSnapshot(snapshot, toTier)) {
      this.deleteSnapshot(snapshotId, fromTier);
      return true;
    }
    return false;
  }

  // ============================================================================
  // Tier Assignment based on Ebbinghaus forgetting
  // ============================================================================

  /**
   * Calculate which tier a snapshot should be in based on access pattern
   * - Hot: accessed in last 24 hours OR accessed more than 3 times
   * - Warm: accessed in last 7 days OR accessed at least once
   * - Cold: not accessed in more than 7 days
   */
  private calculateTier(snapshot: Omit<CacheSnapshot, 'content'>): Tier {
    const now = Date.now();
    const ageMs = now - snapshot.accessed_at;
    const ageHours = ageMs / (1000 * 60 * 60);

    if (ageHours < 24 || snapshot.access_count > 3) {
      return 'hot';
    } else if (ageHours < 24 * 7) {
      return 'warm';
    } else {
      return 'cold';
    }
  }

  /**
   * Ebbinghaus forgetting curve retention at time t (days)
   * R = 1 / ((1 - c) * t + c) where c = 1.25 for typical forgetting
   */
  private ebbinghausRetention(days: number): number {
    return 1 / ((1 - EBBINGHAUS_C) * days + EBBINGHAUS_C);
  }

  // ============================================================================
  // Public API
  // ============================================================================

  /**
   * Save a new session snapshot to cache
   */
  save(agent: string, projectId: string, contentOrMetadata: {
    summary: string;
    decisions?: string[];
    filesChanged?: Array<{path: string; desc?: string}>;
    todo?: string[];
    parentSessionId?: string;
  }): string {
    const index = this.readIndex();
    const now = Date.now();
    const contentStr = JSON.stringify(contentOrMetadata);
    const tokenCount = Math.ceil(contentStr.length / 4); // Approximate tokens

    const snapshot: CacheSnapshot = {
      id: `${now}-${Math.random().toString(36).slice(2, 8)}`,
      project_id: projectId,
      created_at: now,
      accessed_at: now,
      access_count: 1,
      token_count: tokenCount,
      content: contentStr,
      tags: [agent],
      metadata: contentOrMetadata,
    };

    const tier = this.calculateTier(snapshot);
    const metadata: Omit<CacheSnapshot, 'content'> = {
      id: snapshot.id,
      project_id: snapshot.project_id,
      created_at: snapshot.created_at,
      accessed_at: snapshot.accessed_at,
      access_count: snapshot.access_count,
      token_count: snapshot.token_count,
      tags: snapshot.tags,
      metadata: snapshot.metadata,
    };

    index.snapshots[snapshot.id] = metadata;
    this.writeIndex(index);
    this.writeSnapshot(snapshot, tier);

    return snapshot.id;
  }

  /**
   * Load the most recent snapshot for a project
   * Automatically moves to the correct tier based on access
   */
  load(projectId: string, options?: { budget?: number }): CacheSnapshot | null {
    const maxTokens = options?.budget || 100000;
    const index = this.readIndex();

    // Find all snapshots for this project, sorted by created_at descending
    const projectSnapshots = Object.values(index.snapshots)
      .filter(s => s.project_id === projectId)
      .sort((a, b) => b.created_at - a.created_at);

    if (projectSnapshots.length === 0) {
      return null;
    }

    // Find the most recent that fits within token limit
    let selected = null;
    for (const candidate of projectSnapshots) {
      if (candidate.token_count <= maxTokens) {
        selected = candidate;
        break;
      }
    }

    if (!selected) {
      selected = projectSnapshots[0]; // Take the most recent even if over
    }

    // Read the actual snapshot
    const oldTier = this.calculateTier(selected);
    const snapshot = this.readSnapshot(selected.id, oldTier);
    if (!snapshot) {
      return null;
    }

    // Update access metadata
    snapshot.accessed_at = Date.now();
    snapshot.access_count++;

    // Recalculate tier and maybe move
    const newTier = this.calculateTier(snapshot);
    const metadata = index.snapshots[snapshot.id];
    metadata.accessed_at = snapshot.accessed_at;
    metadata.access_count = snapshot.access_count;

    if (oldTier !== newTier) {
      this.moveSnapshot(snapshot.id, oldTier, newTier);
    } else {
      this.writeSnapshot(snapshot, newTier);
    }

    this.writeIndex(index);
    return snapshot;
  }

  /**
   * Search snapshots by keyword in content or tags
   */
  search(keyword: string, projectId: string, limit?: number): CacheSnapshot[] {
    const index = this.readIndex();
    const results: CacheSnapshot[] = [];
    const lowerKeyword = keyword.toLowerCase();

    for (const metadata of Object.values(index.snapshots)) {
      if (metadata.project_id !== projectId) continue;

      // Check tags first
      if (metadata.tags.some(t => t.toLowerCase().includes(lowerKeyword))) {
        const tier = this.calculateTier(metadata);
        const snapshot = this.readSnapshot(metadata.id, tier);
        if (snapshot) results.push(snapshot);
        continue;
      }

      // Check content if tag doesn't match
      const tier = this.calculateTier(metadata);
      const snapshot = this.readSnapshot(metadata.id, tier);
      if (snapshot && snapshot.content.toLowerCase().includes(lowerKeyword)) {
        results.push(snapshot);
      }
    }

    // Sort by most recently accessed
    const sorted = results.sort((a, b) => b.accessed_at - a.accessed_at);

    // Apply limit if provided
    if (limit && sorted.length > limit) {
      return sorted.slice(0, limit);
    }

    return sorted;
  }

  /**
   * List all snapshots for a project (alias for list)
   */
  listSnapshots(projectId: string, limit?: number): Array<Omit<CacheSnapshot, 'content'>> {
    const index = this.readIndex();
    const result = Object.values(index.snapshots)
      .filter(s => s.project_id === projectId)
      .sort((a, b) => b.created_at - a.created_at);

    // Apply limit if provided
    if (limit && result.length > limit) {
      return result.slice(0, limit);
    }

    return result;
  }

  /**
   * List all snapshots for a project
   */
  list(projectId: string): Array<Omit<CacheSnapshot, 'content'>> {
    return this.listSnapshots(projectId);
  }

  /**
   * Run garbage collection based on Ebbinghaus forgetting curve
   * Removes snapshots that have retention probability below threshold
   * @param retentionThreshold - minimum retention to keep (default: 0.1 = 10%)
   * @returns Number of snapshots deleted
   */
  gc(_projectId?: string, retentionThreshold: number = 0.1): number {
    // projectId parameter ignored - GC is global for all projects
    const index = this.readIndex();
    const now = Date.now();
    let deleted = 0;

    for (const [snapshotId, metadata] of Object.entries(index.snapshots)) {
      const daysSinceAccess = (now - metadata.accessed_at) / (1000 * 60 * 60 * 24);
      const retention = this.ebbinghausRetention(daysSinceAccess);

      if (retention < retentionThreshold) {
        // Delete from disk
        const tier = this.calculateTier(metadata);
        this.deleteSnapshot(snapshotId, tier);
        // Delete from index
        delete index.snapshots[snapshotId];
        deleted++;
      }
    }

    this.writeIndex(index);
    return deleted;
  }

  /**
   * Get cache statistics (alias for stats)
   */
  backendInfo(_projectId?: string): CacheStats {
    return this.stats();
  }

  /**
   * Get cache statistics
   */
  stats(): CacheStats {
    const index = this.readIndex();
    const stats: CacheStats = {
      hot_count: 0,
      warm_count: 0,
      cold_count: 0,
      total_count: 0,
      total_tokens: 0,
      total_size_bytes: 0,
    };

    for (const metadata of Object.values(index.snapshots)) {
      const tier = this.calculateTier(metadata);
      switch (tier) {
        case 'hot': stats.hot_count++; break;
        case 'warm': stats.warm_count++; break;
        case 'cold': stats.cold_count++; break;
      }
      stats.total_count++;
      stats.total_tokens += metadata.token_count;

      // Add file size
      const snapshotPath = this.getSnapshotPath(tier, metadata.id);
      try {
        if (fs.existsSync(snapshotPath)) {
          stats.total_size_bytes += fs.statSync(snapshotPath).size;
        }
      } catch (e) {
        // ignore
      }
    }

    return stats;
  }

  /**
   * Delete a specific snapshot
   */
  delete(snapshotId: string): boolean {
    const index = this.readIndex();
    const metadata = index.snapshots[snapshotId];

    if (!metadata) {
      return false;
    }

    const tier = this.calculateTier(metadata);
    this.deleteSnapshot(snapshotId, tier);
    delete index.snapshots[snapshotId];
    this.writeIndex(index);

    return true;
  }
}

export default SoulKVCache;
