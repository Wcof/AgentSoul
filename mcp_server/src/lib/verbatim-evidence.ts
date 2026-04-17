/**
 * @fileoverview Verbatim Evidence Layer - Store original text fragments with metadata
 * @description Preserves original text fragments for traceability.
 * Provides text-based search for MVP - semantic search with vector DB can be added later as an optional enhancement.
 */

import fs from 'fs';
import path from 'path';
import { safePath, writeJson, logWAL } from './utils.js';
import { PROJECT_ROOT, DATA_ROOT } from './paths.js';

/**
 * Security level enum - follows AgentSoul security model
 */
export type SecurityLevel = 'PUBLIC' | 'PROTECTED' | 'SEALED';

/**
 * A single verbatim evidence fragment
 */
export interface VerbatimFragment {
  /** Unique fragment ID */
  id: string;
  /** Original unchanged verbatim text */
  text: string;
  /** Source where this fragment came from (e.g., "conversation:2026-04-10", "topic:agent-architecture") */
  source: string;
  /** Creation date (YYYY-MM-DD) */
  date: string;
  /** Security level - follows AgentSoul 3-level security model */
  security_level: SecurityLevel;
  /** Optional topic name this fragment belongs to */
  topic?: string;
  /** Optional entity name this fragment is about */
  entity?: string;
  /** Optional tags for categorization */
  tags?: string[];
  /** Timestamp when added (unix ms) */
  created_at: number;
}

/**
 * Verbatim Evidence Storage - stores original text fragments with metadata
 * Provides simple text search for MVP
 */
export class VerbatimEvidence {
  private baseDir: string;

  /**
   * Constructor
   * @param dataDir - Base data directory
   */
  constructor(dataDir: string = DATA_ROOT) {
    this.baseDir = path.join(dataDir, 'verbatim');
    this.ensureDirectory();
  }

  /**
   * Ensure the base directory exists
   */
  private ensureDirectory(): void {
    fs.mkdirSync(this.baseDir, { recursive: true });
  }

  /**
   * Get the file path for a fragment
   */
  private getFragmentPath(id: string): string {
    // Use first character as subdirectory to avoid too many files in one directory
    const subdir = id[0];
    return path.join(this.baseDir, subdir, `${id}.json`);
  }

  /**
   * Add a new verbatim fragment
   * @param fragment - The fragment to add (id will be generated if not provided)
   * @returns The fragment ID
   */
  add(fragment: Omit<VerbatimFragment, 'id' | 'created_at'>): string {
    const now = Date.now();
    const id = `${now}-${Math.random().toString(36).slice(2, 8)}`;
    const fullFragment: VerbatimFragment = {
      ...fragment,
      id,
      created_at: now,
    };

    const filePath = this.getFragmentPath(id);
    const checkedPath = safePath(filePath, this.baseDir);
    if (!checkedPath) {
      console.error('[VerbatimEvidence] Path traversal detected');
      logWAL('verbatim_add', id, filePath, false, { error: 'Path traversal detected' });
      return '';
    }

    const success = writeJson(checkedPath, fullFragment);
    if (success) {
      logWAL('verbatim_add', id, checkedPath, true, {
        security_level: fullFragment.security_level,
        source: fullFragment.source,
        text_length: fullFragment.text.length,
      });
      return id;
    } else {
      logWAL('verbatim_add', id, checkedPath, false, { error: 'Failed to write fragment' });
      return '';
    }
  }

  /**
   * Get a fragment by ID
   * @param id - Fragment ID
   * @returns The fragment or null if not found
   */
  get(id: string): VerbatimFragment | null {
    const filePath = this.getFragmentPath(id);
    const checkedPath = safePath(filePath, this.baseDir);
    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      return JSON.parse(content) as VerbatimFragment;
    } catch (e) {
      console.error('[VerbatimEvidence] Failed to read fragment:', e);
      return null;
    }
  }

  /**
   * Delete a fragment
   * @param id - Fragment ID
   * @returns True if deleted successfully
   */
  delete(id: string): boolean {
    const filePath = this.getFragmentPath(id);
    const checkedPath = safePath(filePath, this.baseDir);
    if (!checkedPath || !fs.existsSync(checkedPath)) {
      logWAL('verbatim_delete', id, filePath, false, { error: 'Fragment not found' });
      return false;
    }

    try {
      fs.unlinkSync(checkedPath);
      logWAL('verbatim_delete', id, checkedPath, true);
      return true;
    } catch (e) {
      console.error('[VerbatimEvidence] Failed to delete fragment:', e);
      logWAL('verbatim_delete', id, checkedPath, false, { error: (e as Error).message });
      return false;
    }
  }

  /**
   * Search for fragments containing the query text
   * @param query - The search query (lowercase text match)
   * @param options - Search options for filtering
   * @returns Array of matching fragments
   */
  search(
    query: string,
    options: {
      topic?: string;
      entity?: string;
      dateBefore?: string;
      dateAfter?: string;
      securityLevel?: SecurityLevel;
      limit?: number;
    } = {}
  ): VerbatimFragment[] {
    const results: VerbatimFragment[] = [];
    const queryLower = query.toLowerCase();

    // Walk through all subdirectories and files
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return;

      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          walk(filePath);
        } else if (file.endsWith('.json')) {
          try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const fragment = JSON.parse(content) as VerbatimFragment;

            // Apply filters
            if (options.topic && fragment.topic !== options.topic) continue;
            if (options.entity && fragment.entity !== options.entity) continue;
            if (options.dateBefore && fragment.date > options.dateBefore) continue;
            if (options.dateAfter && fragment.date < options.dateAfter) continue;
            if (options.securityLevel && fragment.security_level !== options.securityLevel) continue;

            // Check if query matches text or any metadata
            const matches =
              fragment.text.toLowerCase().includes(queryLower) ||
              fragment.source.toLowerCase().includes(queryLower) ||
              (fragment.topic && fragment.topic.toLowerCase().includes(queryLower)) ||
              (fragment.entity && fragment.entity.toLowerCase().includes(queryLower)) ||
              (fragment.tags && fragment.tags.some(t => t.toLowerCase().includes(queryLower)));

            if (matches) {
              results.push(fragment);
            }
          } catch (e) {
            console.error('[VerbatimEvidence] Error reading fragment during search:', e);
          }
        }
      }
    };

    walk(this.baseDir);

    // Sort by created_at descending (most recent first)
    results.sort((a, b) => b.created_at - a.created_at);

    // Apply limit
    if (options.limit && results.length > options.limit) {
      return results.slice(0, options.limit);
    }

    return results;
  }

  /**
   * Count total fragments in storage
   * @returns Total count
   */
  count(): number {
    let count = 0;
    const walk = (dir: string) => {
      if (!fs.existsSync(dir)) return 0;
      let localCount = 0;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          localCount += walk(filePath);
        } else if (file.endsWith('.json')) {
          localCount++;
        }
      }
      return localCount;
    };
    return walk(this.baseDir);
  }
}

export default VerbatimEvidence;
