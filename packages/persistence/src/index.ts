import Database from "better-sqlite3";

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
`;
