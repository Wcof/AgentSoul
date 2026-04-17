/**
 * @fileoverview Project path configuration
 * @description Defines the PROJECT_ROOT based on the location of the AgentSoul project
 */

import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Find the project root directory by looking for config/persona.yaml
 * Going upwards from the current directory
 */
function findProjectRoot(): string {
  let currentDir = __dirname;
  const maxSteps = 10;

  // Keep going up until we find it or hit max steps
  // Adding maxSteps prevents infinite loop if we don't find it
  for (let i = 0; i < maxSteps && currentDir !== '/'; i++) {
    // config/persona.yaml is the definitive AgentSoul root marker
    const checkPath = path.join(currentDir, 'config', 'persona.yaml');
    if (fs.existsSync(checkPath)) {
      return currentDir;
    }
    // Check package.json as a backup match by name
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        // Only match root package.json (agentsoul = root, agentsoul-mcp = mcp_server subpackage)
        // agentsoul-mcp shouldn't be accepted as the root, continue searching upward
        if (pkg.name === 'agentsoul') {
          return currentDir;
        }
      } catch (e) {
        // ignore parsing errors
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback 1: direct path calculation based on where we are compiled
  // Regardless of source or compiled, going up two directories from .../mcp_server/X/lib gets us to AgentSoul:
  // - Source:  .../AgentSoul/mcp_server/src/lib   → .../AgentSoul
  // - Compiled: .../AgentSoul/mcp_server/dist/lib → .../AgentSoul
  const candidateRoot = path.dirname(path.dirname(__dirname));
  const candidateConfig = path.join(candidateRoot, 'config', 'persona.yaml');
  if (fs.existsSync(candidateConfig)) {
    return candidateRoot;
  }

  // Fallback 2: try the parent of mcp_server from where we are (cwd might be AgentSoul/mcp_server)
  const cwdCandidateRoot = path.dirname(process.cwd());
  const cwdCandidateConfig = path.join(cwdCandidateRoot, 'config', 'persona.yaml');
  if (fs.existsSync(cwdCandidateConfig)) {
    return cwdCandidateRoot;
  }

  // Final fallback: working directory
  console.error(`[AgentSoul] 警告：在所有搜索位置都找不到 config/persona.yaml`);
  console.error(`[AgentSoul] 回退到工作目录：${process.cwd()}`);
  return process.cwd();
}

/** Project root directory absolute path */
export const PROJECT_ROOT = findProjectRoot();

/** Data root directory */
export const DATA_ROOT = path.join(PROJECT_ROOT, 'data');

/** Agents directory for N2 Browser integration */
export function getAgentsDir(): string {
  return path.join(DATA_ROOT, 'agents');
}

export default {
  PROJECT_ROOT,
  DATA_ROOT,
};
