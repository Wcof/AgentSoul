import Database from "better-sqlite3";

export class SessionRepository {
  constructor(private db: Database.Database) {}

  upsertWorkSession(id: string, source: string, projectPath: string, searchable: number, resumable: number, sessionJson: string, lastActiveAt: string): any {
    return this.db.prepare(
      `INSERT INTO work_sessions (id, source, project_path, searchable, resumable, session_json, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source = excluded.source,
         project_path = excluded.project_path,
         searchable = excluded.searchable,
         resumable = excluded.resumable,
         session_json = excluded.session_json,
         last_active_at = excluded.last_active_at`,
    ).run(id, source, projectPath, searchable, resumable, sessionJson, lastActiveAt);
  }

  listWorkSessions(): any[] {
    return this.db.prepare(
      `SELECT id, source, project_path, searchable, resumable, session_json, last_active_at
       FROM work_sessions
       ORDER BY last_active_at DESC, id ASC`,
    ).all();
  }

  getWorkSession(id: string): any {
    return this.db.prepare(
      `SELECT id, source, project_path, searchable, resumable, session_json, last_active_at
       FROM work_sessions WHERE id = ?`,
    ).get(id);
  }

  deleteWorkSession(id: string): boolean {
    const result = this.db.prepare("DELETE FROM work_sessions WHERE id = ?").run(id);
    return result.changes > 0;
  }

  runTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
