import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import type { ClientAuthorizationMode, ExportManifest, ExportKind, ProviderProfile } from "@agentsoul/domain";
import { initializeV2Database } from "@agentsoul/persistence";
import type { ScopedTrustGrant } from "@agentsoul/safety";

export const USER_MANAGED_EXPORT_FORMAT_VERSION = "agentsoul-export-v1";
export const USER_MANAGED_EXPORT_SCHEMA_VERSION = 1;

export interface PortableDataExport {
  exportKind: "portable-data";
  formatVersion: typeof USER_MANAGED_EXPORT_FORMAT_VERSION;
  schemaVersion: typeof USER_MANAGED_EXPORT_SCHEMA_VERSION;
  createdAt: string;
  sensitiveDataIncluded: false;
  companion: unknown;
  growthEvents: unknown[];
  providerProfiles: PortableProviderProfile[];
  skillPacks: unknown[];
  projectSkillActivations: unknown[];
  managedRuleFiles: unknown[];
  workSessions: PortableWorkSession[];
  trafficMetadataSummaries: PortableTrafficMetadataSummary[];
  exclusions: string[];
}

export interface PortableProviderProfile
  extends Omit<ProviderProfile, "credentialRef"> {
  credentialRef?: never;
  adapterSettingsIncluded: false;
}

export interface PortableWorkSession {
  id: string;
  source: string;
  projectPath: string;
  searchable: boolean;
  resumable: boolean;
  lastActiveAt: string;
  client?: string;
  sessionId?: string;
  resumeCommand?: string;
  evidenceSummary?: string;
}

export interface PortableTrafficMetadataSummary {
  id: string;
  gatewayEventId: string;
  trafficMetadata: unknown;
  estimatedCost: number;
  outcome: string;
  evidenceHash?: string;
  occurredAt: string;
}

export type SensitiveExportResult =
  | {
      status: "approval-required";
      approvalRequestId: string;
      actionRiskClass: "critical";
    }
  | {
      status: "denied";
      reason: "safety-policy-denied" | "approval-denied";
    }
  | {
      status: "exported";
      exportKind: "sensitive-export";
      formatVersion: typeof USER_MANAGED_EXPORT_FORMAT_VERSION;
      schemaVersion: typeof USER_MANAGED_EXPORT_SCHEMA_VERSION;
      createdAt: string;
      sensitiveDataIncluded: true;
      payload: unknown;
      approvalDecisionKind: "allowed";
      trustGrantId?: string;
    };

export interface SensitiveExportInput {
  payload: unknown;
  clientAuthorizationMode: ClientAuthorizationMode;
  approvalSurfaceAvailable: boolean;
  now: string;
  projectPath?: string;
  clientId?: string;
  scopedTrustGrants?: ScopedTrustGrant[];
  approvalDecisionKind?: "allowed" | "denied";
}

export interface UserManagedExportService {
  createPortableDataExport(): PortableDataExport;
  createSensitiveExport(input: SensitiveExportInput): SensitiveExportResult;
  createExportManifest(kind: ExportKind): ExportManifest;
  close(): void;
}

export function createUserManagedExportService(options: {
  dbPath: string;
  clock?: () => Date;
  decideSafetyPolicy: (options: {
    action: { kind: "export-secret"; target: string };
    controlledEntryPoint: any;
    clientAuthorizationMode: any;
    approvalSurfaceAvailable: boolean;
    scopedTrustGrants?: any[];
    scope: { projectPath?: string; clientId?: string };
    now: string;
  }) => any;
}): UserManagedExportService {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);
  const clock = options.clock ?? (() => new Date());

  return {
    createPortableDataExport() {
      const portable = createPortableDataExport(db, clock().toISOString());
      recordExport(db, portable.exportKind, portable, portable.createdAt);
      return portable;
    },
    createSensitiveExport(input) {
      const sensitive = createSensitiveExport(input, options.decideSafetyPolicy);
      if (sensitive.status === "exported") {
        recordExport(db, sensitive.exportKind, sensitive, sensitive.createdAt);
      }
      return sensitive;
    },
    createExportManifest(kind: ExportKind): ExportManifest {
      return createExportManifest(kind, clock().toISOString());
    },
    close() {
      db.close();
    },
  };
}

export function createPortableDataExport(
  db: Database.Database,
  createdAt: string,
): PortableDataExport {
  return {
    exportKind: "portable-data",
    formatVersion: USER_MANAGED_EXPORT_FORMAT_VERSION,
    schemaVersion: USER_MANAGED_EXPORT_SCHEMA_VERSION,
    createdAt,
    sensitiveDataIncluded: false,
    companion: readCompanionState(db),
    growthEvents: readJsonColumn(db, "growth_events", "event_json", "occurred_at"),
    providerProfiles: readProviderProfiles(db).map(toPortableProviderProfile),
    skillPacks: readJsonColumn(db, "skill_packs", "skill_json", "installed_at"),
    projectSkillActivations: readProjectSkillActivations(db),
    managedRuleFiles: readManagedRuleFiles(db),
    workSessions: readWorkSessions(db),
    trafficMetadataSummaries: readTrafficMetadataSummaries(db),
    exclusions: [
      "Credentials",
      "captured request/response bodies",
      "raw indexed evidence",
      "private client auth files",
    ],
  };
}

export function createSensitiveExport(
  input: SensitiveExportInput,
  decideSafetyPolicyFn: (options: any) => any,
): SensitiveExportResult {
  const decision = decideSafetyPolicyFn({
    action: {
      kind: "export-secret",
      target: "Sensitive Export",
    },
    controlledEntryPoint: "mcp-server",
    clientAuthorizationMode: input.clientAuthorizationMode,
    approvalSurfaceAvailable: input.approvalSurfaceAvailable,
    scopedTrustGrants: input.scopedTrustGrants,
    scope: {
      projectPath: input.projectPath,
      clientId: input.clientId,
    },
    now: input.now,
  });

  if (decision.outcome === "deny") {
    return {
      status: "denied",
      reason: "safety-policy-denied",
    };
  }

  if (decision.outcome === "allow") {
    return {
      status: "exported",
      exportKind: "sensitive-export",
      formatVersion: USER_MANAGED_EXPORT_FORMAT_VERSION,
      schemaVersion: USER_MANAGED_EXPORT_SCHEMA_VERSION,
      createdAt: input.now,
      sensitiveDataIncluded: true,
      payload: input.payload,
      approvalDecisionKind: "allowed",
      trustGrantId: decision.trustGrantId,
    };
  }

  if (decision.outcome !== "approval-required" || !decision.approvalRequest) {
    return {
      status: "denied",
      reason: "safety-policy-denied",
    };
  }

  if (!input.approvalDecisionKind) {
    return {
      status: "approval-required",
      approvalRequestId: decision.approvalRequest.id,
      actionRiskClass: "critical",
    };
  }

  if (input.approvalDecisionKind === "denied") {
    return {
      status: "denied",
      reason: "approval-denied",
    };
  }

  return {
    status: "exported",
    exportKind: "sensitive-export",
    formatVersion: USER_MANAGED_EXPORT_FORMAT_VERSION,
    schemaVersion: USER_MANAGED_EXPORT_SCHEMA_VERSION,
    createdAt: input.now,
    sensitiveDataIncluded: true,
    payload: input.payload,
    approvalDecisionKind: "allowed",
  };
}

function readCompanionState(db: Database.Database): unknown {
  const row = db
    .prepare("SELECT state_json FROM companion_state ORDER BY updated_at DESC LIMIT 1")
    .get() as { state_json: string } | undefined;

  return row ? JSON.parse(row.state_json) : null;
}

function readJsonColumn(
  db: Database.Database,
  table: string,
  column: string,
  orderColumn: string,
): unknown[] {
  const rows = db
    .prepare(`SELECT ${column} AS json FROM ${table} ORDER BY ${orderColumn} ASC`)
    .all() as Array<{ json: string }>;

  return rows.map((row) => JSON.parse(row.json));
}

function readProviderProfiles(db: Database.Database): ProviderProfile[] {
  return readJsonColumn(db, "provider_profiles", "profile_json", "id") as ProviderProfile[];
}

function toPortableProviderProfile(profile: ProviderProfile): PortableProviderProfile {
  return {
    id: profile.id,
    name: profile.name,
    activationMode: profile.activationMode,
    clientProtocol: profile.clientProtocol,
    providerProtocol: profile.providerProtocol,
    targetModel: profile.targetModel,
    endpoint: profile.endpoint,
    adapterSettingsIncluded: false,
  };
}

function readProjectSkillActivations(db: Database.Database): unknown[] {
  return db
    .prepare(
      `SELECT id, project_path AS projectPath, skill_pack_id AS skillPackId, enabled, updated_at AS updatedAt
       FROM project_skill_activations
       ORDER BY project_path ASC, skill_pack_id ASC`,
    )
    .all()
    .map((row) => ({
      ...(row as Record<string, unknown>),
      enabled: (row as { enabled: number }).enabled === 1,
    }));
}

function readManagedRuleFiles(db: Database.Database): unknown[] {
  return db
    .prepare(
      `SELECT id, project_path AS projectPath, target_path AS targetPath, source_path AS sourcePath,
              skill_pack_id AS skillPackId, deployment_method AS deploymentMethod,
              content_hash AS contentHash, created_at AS createdAt
       FROM managed_rule_files
       ORDER BY project_path ASC, target_path ASC`,
    )
    .all();
}

function readWorkSessions(db: Database.Database): PortableWorkSession[] {
  const rows = db
    .prepare(
      `SELECT id, source, project_path, searchable, resumable, session_json, last_active_at
       FROM work_sessions
       ORDER BY last_active_at ASC, id ASC`,
    )
    .all() as Array<{
    id: string;
    source: string;
    project_path: string;
    searchable: 0 | 1;
    resumable: 0 | 1;
    session_json: string;
    last_active_at: string;
  }>;

  return rows.map((row) => {
    const session = JSON.parse(row.session_json) as {
      client?: string;
      sessionId?: string;
      evidenceSummary?: string;
      resumeCommand?: string;
    };

    return {
      id: row.id,
      source: row.source,
      projectPath: row.project_path,
      searchable: row.searchable === 1,
      resumable: row.resumable === 1,
      lastActiveAt: row.last_active_at,
      client: session.client,
      sessionId: session.sessionId,
      resumeCommand: session.resumeCommand,
      evidenceSummary: session.evidenceSummary,
    };
  });
}

function readTrafficMetadataSummaries(
  db: Database.Database,
): PortableTrafficMetadataSummary[] {
  const rows = db
    .prepare(
      `SELECT id, gateway_event_id, traffic_metadata_json, estimated_cost, outcome, evidence_hash, occurred_at
       FROM audit_records
       ORDER BY occurred_at ASC, id ASC`,
    )
    .all() as Array<{
    id: string;
    gateway_event_id: string;
    traffic_metadata_json: string;
    estimated_cost: number;
    outcome: string;
    evidence_hash: string | null;
    occurred_at: string;
  }>;

  return rows.map((row) => ({
    id: row.id,
    gatewayEventId: row.gateway_event_id,
    trafficMetadata: JSON.parse(row.traffic_metadata_json),
    estimatedCost: row.estimated_cost,
    outcome: row.outcome,
    evidenceHash: row.evidence_hash ?? undefined,
    occurredAt: row.occurred_at,
  }));
}

function recordExport(
  db: Database.Database,
  exportKind: string,
  exportJson: unknown,
  createdAt: string,
): void {
  db.prepare(
    `INSERT INTO export_records (id, export_kind, export_json, created_at)
     VALUES (?, ?, ?, ?)`,
  ).run(randomUUID(), exportKind, JSON.stringify(exportJson), createdAt);
}

export function createExportManifest(kind: ExportKind, createdAt: string): ExportManifest {
  const portableSections = [
    "companion",
    "growthEvents",
    "providerProfiles",
    "skillPacks",
    "projectSkillActivations",
    "managedRuleFiles",
    "workSessions",
    "trafficMetadataSummaries",
  ];

  const sensitiveSections = [
    "credentials",
    "capturedBodies",
    "rawEvidence",
    "privateAuthFiles",
  ];

  if (kind === "portable") {
    return {
      kind,
      includedSections: portableSections,
      excludedSections: sensitiveSections,
      createdAt,
    };
  }

  return {
    kind,
    includedSections: [...portableSections, ...sensitiveSections],
    excludedSections: [],
    createdAt,
  };
}
