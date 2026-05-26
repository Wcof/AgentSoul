/**
 * @fileoverview 路径工具模块
 */

import { fileURLToPath } from 'url';
import { dirname, resolve, relative, isAbsolute } from 'path';

export const PROJECT_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..', '..', '..'
);

export function resolvePath(relativePath: string): string {
  return resolve(PROJECT_ROOT, relativePath);
}

export function relativeToRoot(absolutePath: string): string {
  return relative(PROJECT_ROOT, absolutePath);
}

export function safeJoin(basePath: string, subPath: string): string | null {
  const baseResolved = resolve(basePath);
  const targetResolved = resolve(basePath, subPath);
  const relativePath = relative(baseResolved, targetResolved);
  if (relativePath.startsWith('..') || isAbsolute(relativePath)) {
    return null;
  }
  return targetResolved;
}

export function ensureWithinRoot(filePath: string): string | null {
  const resolved = resolve(filePath);
  const rel = relative(PROJECT_ROOT, resolved);
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return null;
  }
  return resolved;
}
