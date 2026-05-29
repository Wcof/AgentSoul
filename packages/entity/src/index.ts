// 实体记忆模块 — person/hardware/project/concept/place/service
// 使用 SQLite 持久化，符合 ADR-0001: Runtime State Owned by Database
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { EntityType, EntityFact, Entity, FactConfidence } from "@agentsoul/domain";
import { initializeV2Database, EntityRepository } from "@agentsoul/persistence";

export type { EntityType, EntityFact, Entity, FactConfidence };

export interface WriteFactInput {
  attribute: string;
  value: string;
  confidence: FactConfidence;
  source: string;
}

export interface EntityStoreOptions {
  dbPath: string;
}

export interface EntityStore {
  createEntity(name: string, type: EntityType): Entity;
  getEntity(id: string): Entity | null;
  findByName(name: string): Entity[];
  findByType(type: EntityType): Entity[];
  upsertFact(entityId: string, input: WriteFactInput): EntityFact;
  deleteEntity(id: string): void;
  listAll(): Entity[];
  close(): void;
}

export function createEntityStore(options: EntityStoreOptions): EntityStore {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);
  const repo = new EntityRepository(db);

  return {
    createEntity(name, type) {
      const id = `ent-${randomUUID().slice(0, 8)}`;
      const now = new Date().toISOString();

      repo.createEntity(id, name, type, now);

      return { id, name, type, facts: [], createdAt: now };
    },

    getEntity(id) {
      const row = repo.getEntity(id);

      if (!row) return null;

      const facts = repo.getFacts(id);

      return {
        id: row.id,
        name: row.name,
        type: row.entity_type as EntityType,
        facts: facts.map((f: any) => ({
          attribute: f.attribute,
          value: f.value,
          confidence: f.confidence as FactConfidence,
          source: f.source,
          updatedAt: f.updated_at,
        })),
        createdAt: row.created_at,
      };
    },

    findByName(name) {
      const rows = repo.findByName(name);
      return rows.map((r: any) => this.getEntity(r.id)!);
    },

    findByType(type) {
      const rows = repo.findByType(type);
      return rows.map((r: any) => this.getEntity(r.id)!);
    },

    upsertFact(entityId, input) {
      const entity = this.getEntity(entityId);
      if (!entity) throw new Error(`Entity not found: ${entityId}`);

      const now = new Date().toISOString();
      const factId = `fact-${randomUUID().slice(0, 8)}`;

      repo.upsertFact(factId, entityId, input.attribute, input.value, input.confidence, input.source, now);

      return {
        attribute: input.attribute,
        value: input.value,
        confidence: input.confidence,
        source: input.source,
        updatedAt: now,
      };
    },

    deleteEntity(id) {
      repo.deleteEntity(id);
    },

    listAll() {
      const rows = repo.listAll();
      return rows.map((r: any) => this.getEntity(r.id)!);
    },

    close() {
      db.close();
    },
  };
}
