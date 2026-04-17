/**
 * @fileoverview Soul Board & Ledger - Project State Management
 * @description Soul Board keeps project state, decisions, and work tracking.
 * Ledger provides immutable work session logging for multi-agent collaboration safety.
 */

import fs from 'fs';
import path from 'path';
import { safePath } from './utils.js';
import { PROJECT_ROOT, DATA_ROOT } from './paths.js';

/**
 * Write-Ahead Log (WAL) - Log all write operations for auditing
 */
function logWAL(
  operation: string,
  identifier: string,
  targetPath: string,
  success: boolean,
  metadata?: Record<string, unknown>
): void {
  try {
    const walDir = path.join(DATA_ROOT, 'wal');
    fs.mkdirSync(walDir, { recursive: true });
    const walPath = path.join(walDir, 'write_log.jsonl');

    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      identifier,
      targetPath: path.relative(PROJECT_ROOT, targetPath),
      success,
      metadata: metadata || {},
    };

    const line = JSON.stringify(entry) + '\n';
    fs.appendFileSync(walPath, line, 'utf8');
  } catch (e) {
    // Don't fail the write if WAL logging fails - just log the error
    console.error('[AgentSoulBoard WAL] Failed to write to WAL:', e);
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Project decision recorded on the board
 */
export interface BoardDecision {
  date: string;
  by: string;
  what: string;
  why: string;
  labels?: string[];
}

/**
 * File claim - tracks which agent is working on which file
 */
export interface FileClaim {
  file_path: string;
  agent: string;
  claimed_at: number;
  intent: string;
}

/**
 * Active work item - what the agent is currently working on
 */
export interface ActiveWork {
  agent: string;
  task: string;
  started_at: string;
  files?: string[];
}

/**
 * Soul Board - complete project state
 */
export interface SoulBoard {
  project: string;
  state: {
    summary: string;
    labels: string[];
    decisions: BoardDecision[];
    claims: FileClaim[];
    active_work: ActiveWork[];
  };
  created_at: string;
  updated_at: string;
}

/**
 * Ledger entry - immutable work session record
 */
export interface LedgerEntry {
  id: string;
  timestamp: string;
  project: string;
  agent: string;
  action: 'claim' | 'release' | 'start' | 'decision' | 'complete';
  description: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Precompiled constants - created once at module load
// ============================================================================

/**
 * Precompiled regex for replacing slashes in project IDs
 */
const SLASH_PATTERN = /\//g;

// ============================================================================
// SoulEngine Class
// ============================================================================

/**
 * Soul Engine - Project state management with board and ledger
 */
export class SoulEngine {
  private baseDir: string;

  /**
   * Constructor
   * @param dataDir - Base data directory
   */
  constructor(dataDir: string) {
    this.baseDir = path.join(dataDir, 'soul-board');
    this.ensureDirectory();
  }

  /**
   * Ensure base directory exists
   */
  private ensureDirectory(): void {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    const ledgerDir = path.join(this.baseDir, 'ledger');
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }
  }

  /**
   * Get board file path
   */
  private getBoardPath(projectId: string): string {
    return path.join(this.baseDir, `${projectId.replace(SLASH_PATTERN, '_')}.json`);
  }

  /**
   * Get ledger directory for a project
   */
  private getLedgerDir(projectId: string): string {
    return path.join(this.baseDir, 'ledger', projectId.replace(SLASH_PATTERN, '_'));
  }

  /**
   * Create an empty board
   */
  private createEmptyBoard(projectId: string): SoulBoard {
    const now = new Date().toISOString();
    return {
      project: projectId,
      state: {
        summary: '',
        labels: [],
        decisions: [],
        claims: [],
        active_work: [],
      },
      created_at: now,
      updated_at: now,
    };
  }

  /**
   * Read the board for a project
   */
  readBoard(projectId: string): SoulBoard {
    const boardPath = this.getBoardPath(projectId);
    const checkedPath = safePath(boardPath, this.baseDir);

    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return this.createEmptyBoard(projectId);
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      return JSON.parse(content) as SoulBoard;
    } catch (e) {
      console.error(`Error reading board for ${projectId}:`, e);
      return this.createEmptyBoard(projectId);
    }
  }

  /**
   * Write the board to disk
   */
  writeBoard(projectId: string, board: SoulBoard): boolean {
    const boardPath = this.getBoardPath(projectId);
    const checkedPath = safePath(boardPath, this.baseDir);

    if (!checkedPath) {
      console.error('Path traversal detected in writeBoard');
      logWAL('soul_board_write', projectId, boardPath, false, { error: 'Path traversal detected' });
      return false;
    }

    try {
      board.updated_at = new Date().toISOString();
      const content = JSON.stringify(board, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      const success = true;
      logWAL('soul_board_write', projectId, checkedPath, success, {
        decision_count: board.state.decisions.length,
        claim_count: board.state.claims.length,
      });
      return success;
    } catch (e) {
      console.error(`Error writing board for ${projectId}:`, e);
      logWAL('soul_board_write', projectId, checkedPath, false, {
        error: (e as Error).message,
      });
      return false;
    }
  }

  /**
   * Claim a file for exclusive work
   */
  claimFile(projectId: string, filePath: string, agent: string, intent: string): {
    success: boolean;
    claimed_by?: string;
    message: string;
  } {
    const board = this.readBoard(projectId);

    // Check if already claimed by someone else
    const existingClaim = board.state.claims.find(
      c => c.file_path === filePath && c.agent !== agent,
    );

    if (existingClaim) {
      return {
        success: false,
        claimed_by: existingClaim.agent,
        message: `File already claimed by ${existingClaim.agent}: ${existingClaim.intent}`,
      };
    }

    // Remove any existing claim by this agent
    board.state.claims = board.state.claims.filter(
      c => !(c.file_path === filePath && c.agent === agent),
    );

    // Add new claim
    const claim: FileClaim = {
      file_path: filePath,
      agent,
      claimed_at: Date.now(),
      intent,
    };
    board.state.claims.push(claim);

    // Write to ledger
    this.appendLedger(projectId, agent, 'claim', `Claimed ${filePath}: ${intent}`);

    this.writeBoard(projectId, board);
    return {
      success: true,
      message: 'File claimed successfully',
    };
  }

  /**
   * Release all files claimed by an agent
   */
  releaseFiles(projectId: string, agent: string): number {
    const board = this.readBoard(projectId);
    let released = 0;

    board.state.claims = board.state.claims.filter(c => {
      if (c.agent === agent) {
        released++;
        return false;
      }
      return true;
    });

    // Write to ledger
    this.appendLedger(projectId, agent, 'release', `Released ${released} file(s)`);

    this.writeBoard(projectId, board);
    return released;
  }

  /**
   * Set current active work for an agent
   */
  setActiveWork(projectId: string, agent: string, task: string, files?: string[]): void {
    const board = this.readBoard(projectId);

    // Remove any existing active work for this agent
    board.state.active_work = board.state.active_work.filter(w => w.agent !== agent);

    // Add new active work
    const activeWork: ActiveWork = {
      agent,
      task,
      started_at: new Date().toISOString(),
      files,
    };
    board.state.active_work.push(activeWork);

    this.writeBoard(projectId, board);
  }

  /**
   * Append an entry to the ledger
   */
  appendLedger(
    projectId: string,
    agent: string,
    action: LedgerEntry['action'],
    description: string,
    metadata?: Record<string, unknown>,
  ): LedgerEntry {
    const ledgerDir = this.getLedgerDir(projectId);
    if (!fs.existsSync(ledgerDir)) {
      fs.mkdirSync(ledgerDir, { recursive: true });
    }

    const entry: LedgerEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
      timestamp: new Date().toISOString(),
      project: projectId,
      agent,
      action,
      description,
      metadata,
    };

    const entryPath = path.join(ledgerDir, `${entry.id}.json`);
    const checkedPath = safePath(entryPath, this.baseDir);

    if (checkedPath) {
      try {
        const content = JSON.stringify(entry, null, 2);
        fs.writeFileSync(checkedPath, content, 'utf-8');
        logWAL('ledger_append', entry.id, checkedPath, true, {
          project: projectId,
          action,
          agent,
        });
      } catch (e) {
        console.error(`Error writing ledger entry:`, e);
        logWAL('ledger_append', entry.id, checkedPath, false, {
          project: projectId,
          error: (e as Error).message,
        });
      }
    } else {
      logWAL('ledger_append', entry.id, entryPath, false, {
        project: projectId,
        error: 'Path traversal detected',
      });
    }

    return entry;
  }

  /**
   * List ledger entries with optional date filtering
   */
  listLedgerEntries(projectId: string, startDate?: string, endDate?: string): LedgerEntry[] {
    const ledgerDir = this.getLedgerDir(projectId);
    const checkedDir = safePath(ledgerDir, this.baseDir);

    if (!checkedDir || !fs.existsSync(checkedDir)) {
      return [];
    }

    const entries: LedgerEntry[] = [];

    try {
      const files = fs.readdirSync(checkedDir);
      for (const file of files) {
        if (!file.endsWith('.json')) continue;
        const entryPath = path.join(checkedDir, file);
        try {
          const content = fs.readFileSync(entryPath, 'utf-8');
          const entry = JSON.parse(content) as LedgerEntry;

          // Apply date filters if provided
          if (startDate && entry.timestamp < startDate) continue;
          if (endDate && entry.timestamp > endDate) continue;

          entries.push(entry);
        } catch (e) {
          console.error(`Error reading ledger entry ${file}:`, e);
        }
      }
    } catch (e) {
      console.error(`Error listing ledger for ${projectId}:`, e);
    }

    // Sort by timestamp ascending (oldest first)
    return entries.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  /**
   * Read a specific ledger entry
   */
  readLedgerEntry(projectId: string, entryId: string): LedgerEntry | null {
    const ledgerDir = this.getLedgerDir(projectId);
    const entryPath = path.join(ledgerDir, `${entryId}.json`);
    const checkedPath = safePath(entryPath, this.baseDir);

    if (!checkedPath || !fs.existsSync(checkedPath)) {
      return null;
    }

    try {
      const content = fs.readFileSync(checkedPath, 'utf-8');
      return JSON.parse(content) as LedgerEntry;
    } catch (e) {
      console.error(`Error reading ledger entry ${entryId}:`, e);
      return null;
    }
  }

  /**
   * Add labels to the project
   * @param projectId Project identifier
   * @param labels Array of labels to add
   * @returns Number of labels added (excluding duplicates)
   */
  addLabels(projectId: string, labels: string[]): number {
    const board = this.readBoard(projectId);
    let added = 0;

    for (const label of labels) {
      if (!board.state.labels.includes(label)) {
        board.state.labels.push(label);
        added++;
      }
    }

    if (added > 0) {
      this.writeBoard(projectId, board);
      this.appendLedger(projectId, 'system', 'decision', `Added ${added} label(s): ${labels.join(', ')}`);
    }

    return added;
  }

  /**
   * Remove labels from the project
   * @param projectId Project identifier
   * @param labels Array of labels to remove
   * @returns Number of labels removed
   */
  removeLabels(projectId: string, labels: string[]): number {
    const board = this.readBoard(projectId);
    const originalCount = board.state.labels.length;

    board.state.labels = board.state.labels.filter(label => !labels.includes(label));
    const removed = originalCount - board.state.labels.length;

    if (removed > 0) {
      this.writeBoard(projectId, board);
      this.appendLedger(projectId, 'system', 'decision', `Removed ${removed} label(s): ${labels.join(', ')}`);
    }

    return removed;
  }

  /**
   * List all labels for the project
   * @param projectId Project identifier
   * @returns Array of all labels
   */
  listLabels(projectId: string): string[] {
    const board = this.readBoard(projectId);
    return [...board.state.labels];
  }

  /**
   * Search decisions by labels
   * @param projectId Project identifier
   * @param labels Array of labels to search for (decisions matching any label will be included)
   * @returns Matching decisions
   */
  searchDecisionsByLabels(projectId: string, labels: string[]): BoardDecision[] {
    const board = this.readBoard(projectId);

    if (labels.length === 0) {
      return [...board.state.decisions];
    }

    return board.state.decisions.filter(decision => {
      if (!decision.labels || decision.labels.length === 0) {
        return false;
      }
      // Return true if decision has any of the requested labels
      return decision.labels.some(label => labels.includes(label));
    });
  }
}

export default SoulEngine;
