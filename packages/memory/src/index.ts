// 分层记忆模块 — day/week/month/year/topic
// 使用 SQLite 持久化，符合 ADR-0001: Runtime State Owned by Database
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { MemoryLayer, MemoryPriority, MemoryEntry } from "@agentsoul/domain";
import { initializeV2Database, MemoryRepository } from "@agentsoul/persistence";

export type { MemoryLayer, MemoryPriority, MemoryEntry };

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
}

export interface MemoryStore {
  write(input: WriteMemoryInput): MemoryEntry;
  get(id: string): MemoryEntry | null;
  query(options: QueryMemoryOptions): MemoryEntry[];
  update(id: string, patch: Partial<Pick<MemoryEntry, "content" | "priority" | "tags">>): void;
  delete(id: string): void;
  listLayers(): MemoryLayer[];
  close(): void;
}

const PRIORITY_ORDER: Record<MemoryPriority, number> = {
  low: 0,
  medium: 1,
  high: 2,
};

export function createMemoryStore(options: MemoryStoreOptions): MemoryStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);
  const repo = new MemoryRepository(db);

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
    },

    delete(id) {
      repo.delete(id);
    },

    listLayers() {
      const layers = repo.listLayers();
      return layers.map((r) => r as MemoryLayer);
    },

    close() {
      db.close();
    },
  };
}
