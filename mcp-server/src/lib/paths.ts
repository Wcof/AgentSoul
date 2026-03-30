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

  console.error(`[AgentSoul paths] Starting search from __dirname: ${currentDir}`);

  // Keep going up until we find it or hit max steps
  // Adding maxSteps prevents infinite loop if we don't find it
  for (let i = 0; i < maxSteps && currentDir !== '/'; i++) {
    // config/persona.yaml is the definitive AgentSoul root marker
    const checkPath = path.join(currentDir, 'config', 'persona.yaml');
    console.error(`[AgentSoul paths] Checking ${checkPath}`);
    if (fs.existsSync(checkPath)) {
      console.error(`[AgentSoul paths] Found config/persona.yaml at ${currentDir}`);
      return currentDir;
    }
    // Check package.json as a backup match by name
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(packagePath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
        // Only match root package.json (agentsoul = root, agentsoul-mcp = mcp-server subpackage)
        // agentsoul-mcp shouldn't be accepted as the root, continue searching upward
        if (pkg.name === 'agentsoul') {
          console.error(`[AgentSoul] Found package.json match for ${pkg.name} at ${currentDir}`);
          return currentDir;
        }
      } catch (e) {
        // ignore parsing errors
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback 1: direct path calculation based on where we are compiled
  // Regardless of source or compiled, going up two directories from .../mcp-server/X/lib gets us to AgentSoul:
  // - Source:  .../AgentSoul/mcp-server/src/lib   → .../AgentSoul
  // - Compiled: .../AgentSoul/mcp-server/dist/lib → .../AgentSoul
  const candidateRoot = path.dirname(path.dirname(__dirname));
  const candidateConfig = path.join(candidateRoot, 'config', 'persona.yaml');
  console.error(`[AgentSoul paths] Fallback 1 candidate: ${candidateRoot}, checking ${candidateConfig}`);
  if (fs.existsSync(candidateConfig)) {
    console.error(`[AgentSoul paths] Found config in fallback 1: ${candidateConfig}`);
    return candidateRoot;
  }

  // Fallback 2: try the parent of mcp-server from where we are (cwd might be AgentSoul/mcp-server)
  const cwdCandidateRoot = path.dirname(process.cwd());
  const cwdCandidateConfig = path.join(cwdCandidateRoot, 'config', 'persona.yaml');
  console.error(`[AgentSoul paths] Fallback 2 candidate: ${cwdCandidateRoot}, checking ${cwdCandidateConfig}`);
  if (fs.existsSync(cwdCandidateConfig)) {
    console.error(`[AgentSoul paths] Found config in fallback 2: ${cwdCandidateConfig}`);
    return cwdCandidateRoot;
  }

  // Final fallback: working directory
  console.error(`[AgentSoul] WARNING: Could not find config/persona.yaml in any searched locations.`);
  console.error(`[AgentSoul] Falling back to working directory: ${process.cwd()}`);
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
