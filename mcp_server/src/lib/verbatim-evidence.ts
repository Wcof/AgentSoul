/**
 * @fileoverview Verbatim Evidence Layer - 逐字证据层
 * @description 存储原始对话片段，按安全级别分类管理。
 * 使用首字母分库策略避免单目录文件过多，支持路径遍历防护。
 */

import { readJson, writeJson, resolve, generateId, safePath } from './utils.js';
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { join as pathJoin, dirname } from 'path';

export type SecurityLevel = 'PUBLIC' | 'PROTECTED' | 'SEALED';

export interface VerbatimFragment {
  id: string; text: string; source: string; date: string; security_level: SecurityLevel;
  topic?: string; entity?: string; tags: string[]; created_at: string;
}

export interface AddFragmentParams {
  text: string; source: string; date: string; security_level: SecurityLevel;
  topic?: string; entity?: string; tags?: string[];
}

export interface SearchParams {
  topic?: string; entity?: string; dateBefore?: string; dateAfter?: string;
  securityLevel?: SecurityLevel; limit?: number;
}

/**
 * Apply security filtering to a fragment based on access authorization.
 * - SEALED content is never returned (redacted)
 * - PROTECTED content is masked by default, requires explicit authorization
 * - PUBLIC content is always visible
 */
export function applySecurityFilter(
  fragment: VerbatimFragment,
  options: { include_protected_text?: boolean; can_view_protected?: boolean } = {}
): VerbatimFragment & { text_available: boolean } {
  const { include_protected_text = false, can_view_protected = false } = options;

  if (fragment.security_level === 'SEALED') {
    // SEALED content is never returned
    return { ...fragment, text: '[REDACTED - SEALED]', text_available: false };
  }

  if (fragment.security_level === 'PROTECTED') {
    // PROTECTED content requires double authorization: include_protected_text AND can_view_protected
    if (include_protected_text && can_view_protected) {
      return { ...fragment, text_available: true };
    }
    return { ...fragment, text: '[REDACTED - PROTECTED]', text_available: false };
  }

  // PUBLIC content is always available
  return { ...fragment, text_available: true };
}

export class VerbatimEvidence {
  private readonly baseDir: string;

  constructor() {
    this.baseDir = resolve('data', 'verbatim-evidence');
  }

  /**
   * Get the shard directory for a fragment based on its ID's first character.
   * This distributes fragments across subdirectories to avoid too many files in one directory.
   */
  private getShardDir(id: string): string {
    const subdir = id[0];
    return path.join(this.baseDir, subdir);
  }

  /**
   * Get the file path for a fragment, using sharding.
   * Validates against path traversal attacks.
   */
  private getFragmentPath(id: string): string | null {
    // Path traversal detection
    const safeBase = safePath(this.baseDir);
    if (!safeBase) return null;

    const subdir = id[0];
    const shardDir = pathJoin(safeBase, subdir);
    const fragmentPath = pathJoin(shardDir, `${id}.json`);

    // Verify the resolved path is still within baseDir
    const safeFragment = safePath(fragmentPath, safeBase);
    if (!safeFragment) {
      throw new Error('Path traversal detected');
    }

    return safeFragment;
  }

  private loadFragment(id: string): VerbatimFragment | null {
    const fragmentPath = this.getFragmentPath(id);
    if (!fragmentPath || !existsSync(fragmentPath)) return null;
    const data = readJson(fragmentPath);
    if (data && typeof data === 'object' && 'id' in data) return data as VerbatimFragment;
    return null;
  }

  private saveFragment(fragment: VerbatimFragment): boolean {
    const fragmentPath = this.getFragmentPath(fragment.id);
    if (!fragmentPath) return false;

    const dir = dirname(fragmentPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    return writeJson(fragmentPath, fragment);
  }

  /**
   * Load all fragments across all shard directories.
   */
  private loadAllFragments(): VerbatimFragment[] {
    const fragments: VerbatimFragment[] = [];
    const safeBase = safePath(this.baseDir);
    if (!safeBase || !existsSync(safeBase)) return fragments;

    try {
      const entries = readdirSync(safeBase, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          const shardDir = pathJoin(safeBase, entry.name);
          const files = readdirSync(shardDir);
          for (const file of files) {
            if (file.endsWith('.json')) {
              const data = readJson(pathJoin(shardDir, file));
              if (data && typeof data === 'object' && 'id' in data) {
                fragments.push(data as VerbatimFragment);
              }
            }
          }
        }
      }
    } catch (error) {
      // Return empty on error
    }

    // Also check the legacy flat file for backward compatibility
    const legacyPath = pathJoin(safeBase, 'fragments.json');
    if (existsSync(legacyPath)) {
      const data = readJson(legacyPath);
      if (data && Array.isArray(data)) {
        fragments.push(...(data as VerbatimFragment[]));
      } else if (data && typeof data === 'object' && 'fragments' in data) {
        fragments.push(...(data as { fragments: VerbatimFragment[] }).fragments);
      }
    }

    return fragments;
  }

  add(params: AddFragmentParams): string | null {
    const id = generateId();
    const now = new Date().toISOString();
    const fragment: VerbatimFragment = {
      id, text: params.text, source: params.source, date: params.date,
      security_level: params.security_level, topic: params.topic, entity: params.entity,
      tags: params.tags || [], created_at: now,
    };

    if (this.saveFragment(fragment)) return id;
    return null;
  }

  get(id: string, options: { include_protected_text?: boolean; can_view_protected?: boolean } = {}): VerbatimFragment & { text_available: boolean } | null {
    const fragment = this.loadFragment(id);
    if (!fragment) return null;
    return applySecurityFilter(fragment, options);
  }

  search(query: string, params: SearchParams = {}, options: { include_protected_text?: boolean; can_view_protected?: boolean } = {}): Array<VerbatimFragment & { text_available: boolean }> {
    let fragments = this.loadAllFragments();
    if (query.trim()) {
      const q = query.toLowerCase();
      fragments = fragments.filter(f => f.text.toLowerCase().includes(q) || f.source.toLowerCase().includes(q) || f.tags.some(t => t.toLowerCase().includes(q)));
    }
    if (params.topic) fragments = fragments.filter(f => f.topic === params.topic);
    if (params.entity) fragments = fragments.filter(f => f.entity === params.entity);
    if (params.dateBefore) fragments = fragments.filter(f => f.date <= params.dateBefore!);
    if (params.dateAfter) fragments = fragments.filter(f => f.date >= params.dateAfter!);
    if (params.securityLevel) fragments = fragments.filter(f => f.security_level === params.securityLevel);
    return fragments.slice(0, params.limit || 10).map(f => applySecurityFilter(f, options));
  }

  delete(id: string): boolean {
    const fragmentPath = this.getFragmentPath(id);
    if (!fragmentPath || !existsSync(fragmentPath)) return false;
    try {
      const { unlinkSync } = require('fs');
      unlinkSync(fragmentPath);
      return true;
    } catch {
      return false;
    }
  }

  count(): number {
    return this.loadAllFragments().length;
  }

  listIds(): string[] { return this.loadAllFragments().map(f => f.id); }

  getSecurityStats(): Record<SecurityLevel, number> {
    const fragments = this.loadAllFragments();
    return { PUBLIC: fragments.filter(f => f.security_level === 'PUBLIC').length,
      PROTECTED: fragments.filter(f => f.security_level === 'PROTECTED').length,
      SEALED: fragments.filter(f => f.security_level === 'SEALED').length };
  }
}
