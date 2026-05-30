import Database from "better-sqlite3";

export * from "./control-plane-store";

export const V2_SCHEMA_VERSION = 1;

export const REQUIRED_V2_TABLES = [
  "schema_version",
  "companion_state",
  "growth_events",
  "audit_records",
  "provider_profiles",
  "safety_records",
  "skill_packs",
  "project_skill_activations",
  "managed_rule_files",
  "work_sessions",
  "export_records",
  "mcp_memory_records",
  "memory_entries",
] as const;

export type V2TableName = (typeof REQUIRED_V2_TABLES)[number];

export interface InitializedV2Database {
  path: string;
  schemaVersion: number;
  tables: V2TableName[];
}

export function initializeV2Database(path: string): InitializedV2Database {
  const db = new Database(path);

  try {
    db.pragma("journal_mode = WAL");
    db.exec(schemaSql);
    db.prepare(
      "INSERT OR IGNORE INTO schema_version (version, applied_at) VALUES (?, datetime('now'))",
    ).run(V2_SCHEMA_VERSION);

    return {
      path,
      schemaVersion: getCurrentSchemaVersion(db),
      tables: listV2Tables(db),
    };
  } finally {
    db.close();
  }
}

export function inspectV2Database(path: string): InitializedV2Database {
  const db = new Database(path, { readonly: true, fileMustExist: true });

  try {
    return {
      path,
      schemaVersion: getCurrentSchemaVersion(db),
      tables: listV2Tables(db),
    };
  } finally {
    db.close();
  }
}

function getCurrentSchemaVersion(db: Database.Database): number {
  const row = db.prepare("SELECT MAX(version) AS version FROM schema_version").get() as
    | { version: number | null }
    | undefined;

  return row?.version ?? 0;
}

function listV2Tables(db: Database.Database): V2TableName[] {
  const rows = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as Array<{ name: string }>;
  const existing = new Set(rows.map((row) => row.name));

  return REQUIRED_V2_TABLES.filter((table) => existing.has(table));
}

const schemaSql = `
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS companion_state (
  id TEXT PRIMARY KEY,
  state_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS growth_events (
  id TEXT PRIMARY KEY,
  companion_id TEXT NOT NULL,
  source_type TEXT NOT NULL,
  source_id TEXT,
  event_json TEXT NOT NULL,
  growth_rule_version TEXT NOT NULL,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audit_records (
  id TEXT PRIMARY KEY,
  gateway_event_id TEXT NOT NULL,
  traffic_metadata_json TEXT NOT NULL,
  estimated_cost REAL NOT NULL,
  outcome TEXT NOT NULL,
  evidence_hash TEXT,
  occurred_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS provider_profiles (
  id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS safety_records (
  id TEXT PRIMARY KEY,
  record_type TEXT NOT NULL,
  record_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skill_packs (
  id TEXT PRIMARY KEY,
  skill_json TEXT NOT NULL,
  installed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS project_skill_activations (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  skill_pack_id TEXT NOT NULL,
  enabled INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_path, skill_pack_id)
);

CREATE TABLE IF NOT EXISTS managed_rule_files (
  id TEXT PRIMARY KEY,
  project_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  source_path TEXT NOT NULL,
  skill_pack_id TEXT NOT NULL,
  deployment_method TEXT NOT NULL,
  content_hash TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(project_path, target_path)
);

CREATE TABLE IF NOT EXISTS work_sessions (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  project_path TEXT NOT NULL,
  searchable INTEGER NOT NULL,
  resumable INTEGER NOT NULL,
  session_json TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_records (
  id TEXT PRIMARY KEY,
  export_kind TEXT NOT NULL,
  export_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS mcp_memory_records (
  id TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL,
  memory_key TEXT NOT NULL,
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL,
  UNIQUE(memory_type, memory_key)
);

CREATE TABLE IF NOT EXISTS memory_entries (
  id TEXT PRIMARY KEY,
  layer TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium',
  tags TEXT NOT NULL DEFAULT '[]',
  embedding_ref TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entity_memory (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(name, entity_type)
);

CREATE TABLE IF NOT EXISTS entity_facts (
  id TEXT PRIMARY KEY,
  entity_id TEXT NOT NULL,
  attribute TEXT NOT NULL,
  value TEXT NOT NULL,
  confidence TEXT NOT NULL DEFAULT 'medium',
  source TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  FOREIGN KEY (entity_id) REFERENCES entity_memory(id),
  UNIQUE(entity_id, attribute)
);

CREATE TABLE IF NOT EXISTS semantic_vectors (
  id TEXT PRIMARY KEY,
  source_type TEXT NOT NULL,
  source_id TEXT NOT NULL,
  vector_blob BLOB,
  model_id TEXT NOT NULL DEFAULT 'local',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS health_snapshots (
  id TEXT PRIMARY KEY,
  component TEXT NOT NULL,
  status TEXT NOT NULL,
  message TEXT NOT NULL DEFAULT '',
  score INTEGER NOT NULL DEFAULT 0,
  checked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS config_versions (
  id TEXT PRIMARY KEY,
  config_json TEXT NOT NULL,
  applied_at TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user'
);

CREATE TABLE IF NOT EXISTS emotion_snapshots (
  id TEXT PRIMARY KEY,
  pleasure REAL NOT NULL,
  arousal REAL NOT NULL,
  dominance REAL NOT NULL,
  energy REAL NOT NULL,
  emotion_label TEXT NOT NULL,
  trigger TEXT NOT NULL DEFAULT '',
  recorded_at TEXT NOT NULL
);

`;

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

export class SkillRepository {
  constructor(private db: Database.Database) {}

  upsertSkillPack(id: string, skillJson: string, installedAt: string): void {
    this.db.prepare(
      `INSERT INTO skill_packs (id, skill_json, installed_at)
       VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         skill_json = excluded.skill_json,
         installed_at = excluded.installed_at`
    ).run(id, skillJson, installedAt);
  }

  getSkillPack(id: string): any {
    return this.db.prepare(`SELECT skill_json FROM skill_packs WHERE id = ?`).get(id);
  }

  listSkillPacks(): any[] {
    return this.db.prepare(`SELECT skill_json FROM skill_packs`).all();
  }

  upsertActivation(id: string, projectPath: string, skillPackId: string, enabled: number, updatedAt: string): void {
    this.db.prepare(
      `INSERT INTO project_skill_activations (id, project_path, skill_pack_id, enabled, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_path, skill_pack_id) DO UPDATE SET
         enabled = excluded.enabled,
         updated_at = excluded.updated_at`
    ).run(id, projectPath, skillPackId, enabled, updatedAt);
  }

  listActivations(): any[] {
    return this.db.prepare(`SELECT project_path, skill_pack_id, enabled FROM project_skill_activations`).all();
  }

  upsertManagedRuleFile(id: string, projectPath: string, targetPath: string, sourcePath: string, skillPackId: string, deploymentMethod: string, contentHash: string | null, createdAt: string): void {
    this.db.prepare(
      `INSERT INTO managed_rule_files (id, project_path, target_path, source_path, skill_pack_id, deployment_method, content_hash, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(project_path, target_path) DO UPDATE SET
         source_path = excluded.source_path,
         skill_pack_id = excluded.skill_pack_id,
         deployment_method = excluded.deployment_method,
         content_hash = excluded.content_hash,
         created_at = excluded.created_at`
    ).run(id, projectPath, targetPath, sourcePath, skillPackId, deploymentMethod, contentHash, createdAt);
  }

  listManagedRuleFiles(): any[] {
    return this.db.prepare(
      `SELECT project_path, target_path, source_path, skill_pack_id, deployment_method, content_hash, created_at
       FROM managed_rule_files`
    ).all();
  }

  deleteManagedRuleFile(projectPath: string, targetPath: string): void {
    this.db.prepare(
      `DELETE FROM managed_rule_files WHERE project_path = ? AND target_path = ?`
    ).run(projectPath, targetPath);
  }
}

export class McpMemoryRepository {
  constructor(private db: Database.Database) {}

  getMemoryRecord(memoryType: string, memoryKey: string): { content: string } | undefined {
    return this.db
      .prepare(
        "SELECT content FROM mcp_memory_records WHERE memory_type = ? AND memory_key = ?",
      )
      .get(memoryType, memoryKey) as { content: string } | undefined;
  }

  upsertMemoryRecord(id: string, memoryType: string, memoryKey: string, content: string): void {
    this.db.prepare(
      `INSERT INTO mcp_memory_records (id, memory_type, memory_key, content, status, updated_at)
       VALUES (?, ?, ?, ?, 'active', datetime('now'))
       ON CONFLICT(memory_type, memory_key) DO UPDATE SET
         content = excluded.content,
         status = excluded.status,
         updated_at = excluded.updated_at`,
    ).run(id, memoryType, memoryKey, content);
  }

  listTopics(): Array<{ memory_key: string; status: string; updated_at: string }> {
    return this.db
      .prepare(
        `SELECT memory_key, status, updated_at
         FROM mcp_memory_records
         WHERE memory_type = 'topic'
         ORDER BY memory_key ASC`,
      )
      .all() as Array<{ memory_key: string; status: string; updated_at: string }>;
  }
}


