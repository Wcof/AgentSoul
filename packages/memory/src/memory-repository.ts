import Database from "better-sqlite3";

export class MemoryRepository {
  constructor(private db: Database.Database) {}

  insert(id: string, layer: string, content: string, priority: string, tagsJson: string, createdAt: string, updatedAt: string): void {
    this.db.prepare(
      `INSERT INTO memory_entries (id, layer, content, priority, tags, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, layer, content, priority, tagsJson, createdAt, updatedAt);
  }

  get(id: string): any {
    return this.db.prepare(
      `SELECT id, layer, content, priority, tags, created_at, updated_at
       FROM memory_entries WHERE id = ?`
    ).get(id);
  }

  query(layer?: string): any[] {
    let sql = `SELECT id, layer, content, priority, tags, created_at, updated_at FROM memory_entries WHERE 1=1`;
    const params: any[] = [];
    if (layer) {
      sql += ` AND layer = ?`;
      params.push(layer);
    }
    return this.db.prepare(sql).all(...params);
  }

  update(id: string, content: string, priority: string, tagsJson: string, updatedAt: string): void {
    this.db.prepare(
      `UPDATE memory_entries SET content = ?, priority = ?, tags = ?, updated_at = ? WHERE id = ?`
    ).run(content, priority, tagsJson, updatedAt, id);
  }

  delete(id: string): void {
    this.db.prepare(`DELETE FROM memory_entries WHERE id = ?`).run(id);
  }

  listLayers(): string[] {
    const rows = this.db.prepare(`SELECT DISTINCT layer FROM memory_entries`).all() as Array<{ layer: string }>;
    return rows.map(r => r.layer);
  }
}
