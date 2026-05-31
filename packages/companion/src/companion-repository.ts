import Database from "better-sqlite3";

export class CompanionStateRepository {
  constructor(private db: Database.Database) {}

  ensureDefault(id: string, defaultStateJson: string): void {
    const existing = this.db.prepare("SELECT id FROM companion_state WHERE id = ?").get(id);
    if (!existing) {
      this.write(id, defaultStateJson);
    }
  }

  read(id: string): string | null {
    const row = this.db.prepare("SELECT state_json FROM companion_state WHERE id = ?").get(id) as { state_json: string } | undefined;
    return row?.state_json ?? null;
  }

  write(id: string, stateJson: string): void {
    this.db.prepare(
      `INSERT INTO companion_state (id, state_json, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         state_json = excluded.state_json,
         updated_at = excluded.updated_at`,
    ).run(id, stateJson);
  }

  writeGrowthEvent(id: string, companionId: string, sourceType: string, sourceId: string | null, eventJson: string, growthRuleVersion: string, occurredAt: string): void {
    this.db.prepare(
      `INSERT INTO growth_events (id, companion_id, source_type, source_id, event_json, growth_rule_version, occurred_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, companionId, sourceType, sourceId, eventJson, growthRuleVersion, occurredAt);
  }

  listGrowthEvents(): string[] {
    const rows = this.db.prepare("SELECT event_json FROM growth_events ORDER BY rowid ASC").all() as Array<{ event_json: string }>;
    return rows.map(r => r.event_json);
  }

  runTransaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }
}
