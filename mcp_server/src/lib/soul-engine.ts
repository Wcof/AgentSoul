/**
 * @fileoverview Soul Engine 模块
 */

import { readJson, writeJson, resolve, generateId, logWAL } from './utils.js';

export interface BoardState {
  summary: string;
  decisions: Array<{ date: string; by: string; what: string; why: string }>;
  labels: string[];
}

export interface FileOwnership {
  filePath: string; owner: string; claimedAt: string; intent: string;
}

export interface LedgerEntry {
  id: string; project: string; agent: string; task: string; files: string[];
  timestamp: string; status: 'active' | 'completed' | 'abandoned';
}

export interface Board {
  state: BoardState;
  fileOwnership: FileOwnership[];
  activeWork: Array<{ agent: string; task: string; files: string[]; updatedAt: string }>;
}

export interface FileClaimResult {
  success: boolean; message: string; file?: FileOwnership;
}

export class SoulEngine {
  private readonly dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = resolve(dataDir, 'soul-board');
  }

  private getBoardPath(project: string): string { return resolve(this.dataDir, `${project}.json`); }
  private getLedgerPath(project: string): string { return resolve(this.dataDir, `${project}-ledger.json`); }

  private loadBoard(project: string): Board {
    const data = readJson(this.getBoardPath(project));
    if (data && typeof data === 'object') return data as Board;
    return { state: { summary: '', decisions: [], labels: [] }, fileOwnership: [], activeWork: [] };
  }

  private saveBoard(project: string, board: Board): boolean {
    const result = writeJson(this.getBoardPath(project), board);
    if (result) {
      logWAL('soul_board_write', `project:${project}`, { operation: 'save_board' });
    }
    return result;
  }

  readBoard(project: string): Board { return this.loadBoard(project); }
  writeBoard(project: string, board: Board): boolean { return this.saveBoard(project, board); }

  claimFile(project: string, filePath: string, agent: string, intent: string): FileClaimResult {
    const board = this.loadBoard(project);
    const now = new Date().toISOString();
    const existing = board.fileOwnership.find(f => f.filePath === filePath);
    if (existing && existing.owner !== agent) {
      return { success: false, message: `File "${filePath}" already claimed by ${existing.owner}` };
    }
    const ownership: FileOwnership = { filePath, owner: agent, claimedAt: now, intent };
    const index = board.fileOwnership.findIndex(f => f.filePath === filePath);
    if (index >= 0) board.fileOwnership[index] = ownership;
    else board.fileOwnership.push(ownership);
    board.state.summary = `File "${filePath}" claimed by ${agent}: ${intent}`;
    return { success: this.saveBoard(project, board), message: existing ? `Reclaimed "${filePath}"` : `Claimed "${filePath}"`, file: ownership };
  }

  releaseFiles(project: string, agent: string): boolean {
    const board = this.loadBoard(project);
    const before = board.fileOwnership.length;
    board.fileOwnership = board.fileOwnership.filter(f => f.owner !== agent);
    board.activeWork = board.activeWork.filter(w => w.agent !== agent);
    return this.saveBoard(project, board) && (before > board.fileOwnership.length);
  }

  setActiveWork(project: string, agent: string, task: string, files: string[]): boolean {
    const board = this.loadBoard(project);
    const now = new Date().toISOString();
    const existingIndex = board.activeWork.findIndex(w => w.agent === agent);
    const work = { agent, task, files, updatedAt: now };
    if (existingIndex >= 0) board.activeWork[existingIndex] = work;
    else board.activeWork.push(work);
    return this.saveBoard(project, board);
  }

  listLedgerEntries(project: string, startDate?: string, endDate?: string): LedgerEntry[] {
    const data = readJson(this.getLedgerPath(project));
    if (!data || !Array.isArray(data)) return [];
    let entries = data as LedgerEntry[];
    if (startDate) entries = entries.filter(e => e.timestamp >= startDate);
    if (endDate) entries = entries.filter(e => e.timestamp <= endDate);
    return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  readLedgerEntry(project: string, entryId: string): LedgerEntry | null {
    return this.listLedgerEntries(project).find(e => e.id === entryId) || null;
  }

  addLabels(project: string, labels: string[]): number {
    const board = this.loadBoard(project);
    const existing = new Set(board.state.labels);
    let added = 0;
    for (const label of labels) { if (!existing.has(label)) { board.state.labels.push(label); existing.add(label); added++; } }
    if (added > 0) this.saveBoard(project, board);
    return added;
  }

  removeLabels(project: string, labels: string[]): number {
    const board = this.loadBoard(project);
    const toRemove = new Set(labels);
    const before = board.state.labels.length;
    board.state.labels = board.state.labels.filter(l => !toRemove.has(l));
    if (before > board.state.labels.length) this.saveBoard(project, board);
    return before - board.state.labels.length;
  }

  listLabels(project: string): string[] { return this.loadBoard(project).state.labels; }

  searchDecisionsByLabels(project: string, labels: string[]): Array<{ date: string; by: string; what: string; why: string; matchedLabels: string[] }> {
    const board = this.loadBoard(project);
    const labelSet = new Set(labels.map(l => l.toLowerCase()));
    const results: Array<{ date: string; by: string; what: string; why: string; matchedLabels: string[] }> = [];
    for (const decision of board.state.decisions) {
      const matchedLabels = decision.what.toLowerCase().split(/\s+/).filter(word => labelSet.has(word));
      if (matchedLabels.length > 0) results.push({ ...decision, matchedLabels });
    }
    return results;
  }
}
