// 分层记忆模块 — day/week/month/year/topic
// 使用 SQLite 持久化，符合 ADR-0001: Runtime State Owned by Database
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { MemoryLayer, MemoryPriority, MemoryEntry } from "@agentsoul/domain";
import {
  advanceMasterModelObservation,
  recordMasterModelObservation,
} from "@agentsoul/companion/soul";
import type { MasterModel, MasterModelLearningStage } from "@agentsoul/companion/soul";
import { initializeV2Database } from "@agentsoul/persistence";
import { MemoryRepository } from "./memory-repository.js";

export type { MemoryLayer, MemoryPriority, MemoryEntry };
export type { MasterModel, MasterModelLearningStage };

export interface WriteMemoryInput {
  layer: MemoryLayer;
  content: string;
  priority: MemoryPriority;
  tags: string[];
}

export interface QueryMemoryOptions {
  layer?: MemoryLayer;
  minPriority?: MemoryPriority;
  tags?: string[];
}

export interface MemoryStoreOptions {
  dbPath: string;
  semanticIndex?: {
    addEntry(sourceType: string, sourceId: string, text: string): unknown;
  };
}

export interface MemoryIndexingFailure {
  memoryId: string;
  message: string;
  occurredAt: string;
}

export interface MemoryStore {
  write(input: WriteMemoryInput): MemoryEntry;
  get(id: string): MemoryEntry | null;
  query(options: QueryMemoryOptions): MemoryEntry[];
  update(id: string, patch: Partial<Pick<MemoryEntry, "content" | "priority" | "tags">>): void;
  delete(id: string): void;
  listLayers(): MemoryLayer[];
  getLastIndexingFailure(): MemoryIndexingFailure | undefined;
  close(): void;
}

export type MasterModelCommand =
  | { kind: "record"; claim: string; evidence: string[]; confidence: number }
  | { kind: "advance"; observationId: string; stage: MasterModelLearningStage }
  | { kind: "forget"; observationId: string };

const PRIORITY_ORDER: Record<MemoryPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function createMemoryStore(options: MemoryStoreOptions): MemoryStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);
  const repo = new MemoryRepository(db);
  let lastIndexingFailure: MemoryIndexingFailure | undefined;

  return {
    write(input) {
      const id = `mem-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();
      const entry: MemoryEntry = {
        id,
        layer: input.layer,
        content: input.content,
        priority: input.priority,
        tags: [...input.tags],
        createdAt: now,
        updatedAt: now,
      };

      repo.insert(id, input.layer, input.content, input.priority, JSON.stringify(input.tags), now, now);
      try {
        options.semanticIndex?.addEntry("memory", id, input.content);
      } catch (error) {
        lastIndexingFailure = {
          memoryId: id,
          message: error instanceof Error ? error.message : String(error),
          occurredAt: new Date().toISOString(),
        };
      }

      return { ...entry };
    },

    get(id) {
      const row = repo.get(id);

      if (!row) return null;

      return {
        id: row.id,
        layer: row.layer as MemoryLayer,
        content: row.content,
        priority: row.priority as MemoryPriority,
        tags: JSON.parse(row.tags),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    },

    query(options) {
      const rows = repo.query(options.layer);

      let results: MemoryEntry[] = rows.map((row) => ({
        id: row.id,
        layer: row.layer as MemoryLayer,
        content: row.content,
        priority: row.priority as MemoryPriority,
        tags: JSON.parse(row.tags),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      if (options.minPriority) {
        const minLevel = PRIORITY_ORDER[options.minPriority];
        results = results.filter((e) => PRIORITY_ORDER[e.priority] >= minLevel);
      }

      if (options.tags && options.tags.length > 0) {
        results = results.filter((e) =>
          options.tags!.some((tag) => e.tags.includes(tag)),
        );
      }

      return results;
    },

    update(id, patch) {
      const existing = this.get(id);
      if (!existing) return;

      const now = new Date().toISOString();
      const content = patch.content ?? existing.content;
      const priority = patch.priority ?? existing.priority;
      const tags = patch.tags ? JSON.stringify(patch.tags) : JSON.stringify(existing.tags);

      repo.update(id, content, priority, tags, now);
      if (patch.content !== undefined && patch.content !== existing.content) {
        try {
          options.semanticIndex?.addEntry("memory", id, content);
        } catch (error) {
          lastIndexingFailure = {
            memoryId: id,
            message: error instanceof Error ? error.message : String(error),
            occurredAt: new Date().toISOString(),
          };
        }
      }
    },

    delete(id) {
      repo.delete(id);
    },

    listLayers() {
      const layers = repo.listLayers();
      return layers.map((r) => r as MemoryLayer);
    },

    getLastIndexingFailure() {
      return lastIndexingFailure ? { ...lastIndexingFailure } : undefined;
    },

    close() {
      db.close();
    },
  };
}

export function applyMasterModelCommand(masterModel: MasterModel, command: MasterModelCommand): MasterModel {
  if (command.kind === "record") {
    return recordMasterModelObservation(masterModel, {
      source: "manual",
      claim: command.claim,
      evidence: command.evidence,
      confidence: command.confidence,
    });
  }

  if (command.kind === "advance") {
    return advanceMasterModelObservation(masterModel, command.observationId, command.stage);
  }

  return forgetMasterModelObservation(masterModel, command.observationId);
}

function forgetMasterModelObservation(masterModel: MasterModel, observationId: string): MasterModel {
  const withoutTarget = (items: MasterModel["learningState"]["observations"]) => items.filter((item) => item.id !== observationId);
  return {
    ...masterModel,
    learningState: {
      observations: withoutTarget(masterModel.learningState?.observations ?? []),
      hypotheses: withoutTarget(masterModel.learningState?.hypotheses ?? []),
      verifiedFacts: withoutTarget(masterModel.learningState?.verifiedFacts ?? []),
      solidifiedFacts: withoutTarget(masterModel.learningState?.solidifiedFacts ?? []),
    },
  };
}

// Re-export entity and semantic stores
export { createEntityStore } from "./entity.js";
export type { EntityType, EntityFact, Entity, FactConfidence, WriteFactInput, EntityStoreOptions, EntityStore } from "./entity.js";

export { createSemanticStore, createMockEmbedding } from "./semantic.js";
export type { SemanticMatch, DeduplicationResult, EmbeddingProvider, SemanticStoreOptions, SemanticStore } from "./semantic.js";

// ─── Repositories (moved from persistence) ───
export { MemoryRepository } from "./memory-repository.js";
export { EntityRepository } from "./entity-repository.js";
export { SemanticRepository } from "./semantic-repository.js";
