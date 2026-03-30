/**
 * @fileoverview Soul Board & Ledger - Project State Management
 * @description Soul Board keeps project state, decisions, and work tracking.
 * Ledger provides immutable work session logging for multi-agent collaboration safety.
 */

import fs from 'fs';
import path from 'path';
import { safePath } from './utils.js';

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
    return path.join(this.baseDir, `${projectId.replace(/\//g, '_')}.json`);
  }

  /**
   * Get ledger directory for a project
   */
  private getLedgerDir(projectId: string): string {
    return path.join(this.baseDir, 'ledger', projectId.replace(/\//g, '_'));
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
      return false;
    }

    try {
      board.updated_at = new Date().toISOString();
      const content = JSON.stringify(board, null, 2);
      fs.writeFileSync(checkedPath, content, 'utf-8');
      return true;
    } catch (e) {
      console.error(`Error writing board for ${projectId}:`, e);
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
      } catch (e) {
        console.error(`Error writing ledger entry:`, e);
      }
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
}

export default SoulEngine;
