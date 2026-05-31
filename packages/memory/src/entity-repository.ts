import Database from "better-sqlite3";

export class EntityRepository {
  constructor(private db: Database.Database) {}

  createEntity(id: string, name: string, type: string, createdAt: string): void {
    this.db.prepare(
      `INSERT INTO entity_memory (id, name, entity_type, created_at) VALUES (?, ?, ?, ?)`
    ).run(id, name, type, createdAt);
  }

  getEntity(id: string): any {
    return this.db.prepare(
      `SELECT id, name, entity_type, created_at FROM entity_memory WHERE id = ?`
    ).get(id);
  }

  getFacts(entityId: string): any[] {
    return this.db.prepare(
      `SELECT attribute, value, confidence, source, updated_at FROM entity_facts WHERE entity_id = ?`
    ).all(entityId);
  }

  findByName(name: string): any[] {
    return this.db.prepare(
      `SELECT id FROM entity_memory WHERE LOWER(name) LIKE LOWER(?)`
    ).all(`%${name}%`);
  }

  findByType(type: string): any[] {
    return this.db.prepare(
      `SELECT id FROM entity_memory WHERE entity_type = ?`
    ).all(type);
  }

  upsertFact(factId: string, entityId: string, attribute: string, value: string, confidence: string, source: string, updatedAt: string): void {
    this.db.prepare(
      `INSERT INTO entity_facts (id, entity_id, attribute, value, confidence, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(entity_id, attribute) DO UPDATE SET
         value = excluded.value,
         confidence = excluded.confidence,
         source = excluded.source,
         updated_at = excluded.updated_at`
    ).run(factId, entityId, attribute, value, confidence, source, updatedAt);
  }

  deleteEntity(id: string): void {
    this.db.prepare(`DELETE FROM entity_facts WHERE entity_id = ?`).run(id);
    this.db.prepare(`DELETE FROM entity_memory WHERE id = ?`).run(id);
  }

  listAll(): any[] {
    return this.db.prepare(`SELECT id FROM entity_memory`).all();
  }
}
