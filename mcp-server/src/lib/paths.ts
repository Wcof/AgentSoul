/**
 * @fileoverview Project path configuration
 * @description Defines the PROJECT_ROOT based on the location of the AgentSoul project
 */

import path from 'path';
import fs from 'fs';

/**
 * Find the project root directory by looking for package.json or config/persona.yaml
 * Going upwards from the current directory
 */
function findProjectRoot(): string {
  let currentDir = path.dirname(__dirname);

  // Go up until we find AgentSoul root marker
  while (currentDir !== '/' && currentDir !== '.') {
    // Check for config/persona.yaml which is the root marker
    const checkPath = path.join(currentDir, 'config', 'persona.yaml');
    if (fs.existsSync(checkPath)) {
      return currentDir;
    }
    // Check for package.json at the root
    const packagePath = path.join(currentDir, 'package.json');
    if (fs.existsSync(path.join(currentDir, 'package.json'))) {
      const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      if (pkg.name === 'agentsoul' || pkg.name === 'agentsoul-mcp') {
        return currentDir;
      }
    }
    currentDir = path.dirname(currentDir);
  }

  // If not found, use process.cwd() and hope for the best
  return process.cwd();
}

/** Project root directory absolute path */
export const PROJECT_ROOT = findProjectRoot();

/** Data root directory */
export const DATA_ROOT = path.join(PROJECT_ROOT, 'data');

export default {
  PROJECT_ROOT,
  DATA_ROOT,
};
