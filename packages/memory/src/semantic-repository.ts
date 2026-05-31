import Database from "better-sqlite3";

export class SemanticRepository {
  constructor(private db: Database.Database) {}

  addEntry(id: string, sourceType: string, sourceId: string, vectorBlob: Buffer, modelId: string, createdAt: string): void {
    this.db.prepare(
      `INSERT INTO semantic_vectors (id, source_type, source_id, vector_blob, model_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, sourceType, sourceId, vectorBlob, modelId, createdAt);
  }

  listAll(): any[] {
    return this.db.prepare(
      `SELECT id, source_type, source_id, vector_blob FROM semantic_vectors`
    ).all();
  }

  listDeduplicate(): any[] {
    return this.db.prepare(
      `SELECT source_id, vector_blob FROM semantic_vectors`
    ).all();
  }

  removeEntry(id: string): void {
    this.db.prepare(`DELETE FROM semantic_vectors WHERE id = ?`).run(id);
  }

  size(): number {
    const row = this.db.prepare(`SELECT COUNT(*) as count FROM semantic_vectors`).get() as { count: number };
    return row.count;
  }
}
