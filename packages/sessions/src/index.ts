import Database from "better-sqlite3";
import { readFileSync } from "node:fs";
import type { ApprovalDecisionKind, ClientAuthorizationMode, WorkSession } from "@agentsoul/domain";
import { initializeV2Database } from "@agentsoul/persistence";
import type { ControlledEntryPoint, ScopedTrustGrant } from "@agentsoul/safety";
import { decideSafetyPolicy } from "@agentsoul/safety";

export interface CreateSessionSourceScannerOptions {
  dbPath: string;
}

export interface ScanJsonlSessionSourceInput {
  source: string;
  sourcePath: string;
  client: string;
}

export interface ScanJsonlSessionSourceResult {
  scanned: number;
  created: number;
  skippedMalformed: number;
}

export interface ScannedWorkSession extends WorkSession {
  sessionId?: string;
  evidenceSummary: string;
  client: string;
  sourcePath: string;
}

export interface RecordWorkSessionInput {
  id: string;
  source: string;
  client: string;
  projectPath: string;
  sessionId?: string;
  lastActiveAt: string;
  evidenceSummary: string;
  searchable: boolean;
  resumable: boolean;
  resumeCommand?: string;
  sourcePath?: string;
}

export interface SearchWorkSessionsInput {
  projectPath?: string;
  source?: string;
  client?: string;
  keyword?: string;
  activeFrom?: string;
  activeTo?: string;
}

export interface WorkSessionSearchResult extends ScannedWorkSession {
  availableActions: Array<"resume">;
}

export interface SessionSourceScanner {
  scanJsonlSessionSource(input: ScanJsonlSessionSourceInput): ScanJsonlSessionSourceResult;
  recordWorkSession(input: RecordWorkSessionInput): ScannedWorkSession;
  listWorkSessions(): ScannedWorkSession[];
  searchWorkSessions(input: SearchWorkSessionsInput): WorkSessionSearchResult[];
  close(): void;
}

export interface CreateSessionLauncherOptions {
  scanner: Pick<SessionSourceScanner, "listWorkSessions">;
  controlledEntryPoint: ControlledEntryPoint;
  clientAuthorizationMode: ClientAuthorizationMode;
  approvalSurfaceAvailable: boolean;
  scopedTrustGrants?: ScopedTrustGrant[];
  now: string;
  executeTerminalCommand(command: string): void;
}

export interface LaunchWorkSessionInput {
  workSessionId: string;
  approvalDecisionKind?: Extract<ApprovalDecisionKind, "allowed" | "denied">;
}

export type LaunchWorkSessionResult =
  | {
      status: "launched";
      command: string;
      trustGrantId?: string;
      approvalDecisionKind?: Extract<ApprovalDecisionKind, "allowed">;
    }
  | {
      status: "approval-required";
      approvalRequestId: string;
      command: string;
    }
  | {
      status: "denied";
      reason: "approval-denied" | "safety-policy-denied";
    }
  | {
      status: "not-launchable";
      reason: "not-found" | "non-resumable";
    };

export interface SessionLauncher {
  launchWorkSession(input: LaunchWorkSessionInput): LaunchWorkSessionResult;
}

interface SessionJson {
  client: string;
  sessionId?: string;
  sourcePath: string;
  evidenceSummary: string;
  resumeCommand?: string;
  sourceEvidence: Record<string, unknown>;
}

interface WorkSessionRow {
  id: string;
  source: string;
  project_path: string;
  searchable: 0 | 1;
  resumable: 0 | 1;
  session_json: string;
  last_active_at: string;
}

export function createSessionSourceScanner(
  options: CreateSessionSourceScannerOptions,
): SessionSourceScanner {
  initializeV2Database(options.dbPath);
  const db = new Database(options.dbPath);

  return {
    scanJsonlSessionSource(input) {
      return scanJsonlSessionSource(db, input);
    },
    recordWorkSession(input) {
      upsertWorkSession(db, {
        id: input.id,
        source: input.source,
        projectPath: input.projectPath,
        searchable: input.searchable,
        resumable: input.resumable,
        lastActiveAt: input.lastActiveAt,
        sessionJson: {
          client: input.client,
          sessionId: input.sessionId,
          sourcePath: input.sourcePath ?? "",
          evidenceSummary: input.evidenceSummary,
          resumeCommand: input.resumeCommand,
          sourceEvidence: {},
        },
      });

      const session = listWorkSessions(db).find((workSession) => workSession.id === input.id);

      if (!session) {
        throw new Error(`Work Session was not recorded: ${input.id}`);
      }

      return session;
    },
    listWorkSessions() {
      return listWorkSessions(db);
    },
    searchWorkSessions(input) {
      return searchWorkSessions(db, input);
    },
    close() {
      db.close();
    },
  };
}

export function createSessionLauncher(options: CreateSessionLauncherOptions): SessionLauncher {
  return {
    launchWorkSession(input) {
      const session = options.scanner
        .listWorkSessions()
        .find((workSession) => workSession.id === input.workSessionId);

      if (!session) {
        return {
          status: "not-launchable",
          reason: "not-found",
        };
      }

      if (!session.resumable || !session.resumeCommand) {
        return {
          status: "not-launchable",
          reason: "non-resumable",
        };
      }

      const safetyDecision = decideSafetyPolicy({
        action: {
          kind: "launch-session",
          target: session.resumeCommand,
        },
        controlledEntryPoint: options.controlledEntryPoint,
        clientAuthorizationMode: options.clientAuthorizationMode,
        approvalSurfaceAvailable: options.approvalSurfaceAvailable,
        scopedTrustGrants: options.scopedTrustGrants,
        scope: {
          projectPath: session.projectPath,
          clientId: session.client,
        },
        now: options.now,
      });

      if (safetyDecision.outcome === "allow") {
        options.executeTerminalCommand(session.resumeCommand);
        return {
          status: "launched",
          command: session.resumeCommand,
          trustGrantId: safetyDecision.trustGrantId,
        };
      }

      if (safetyDecision.outcome === "deny") {
        return {
          status: "denied",
          reason: "safety-policy-denied",
        };
      }

      if (safetyDecision.outcome !== "approval-required" || !safetyDecision.approvalRequest) {
        return {
          status: "denied",
          reason: "safety-policy-denied",
        };
      }

      if (!input.approvalDecisionKind) {
        return {
          status: "approval-required",
          approvalRequestId: safetyDecision.approvalRequest.id,
          command: session.resumeCommand,
        };
      }

      if (input.approvalDecisionKind === "denied") {
        return {
          status: "denied",
          reason: "approval-denied",
        };
      }

      options.executeTerminalCommand(session.resumeCommand);
      return {
        status: "launched",
        command: session.resumeCommand,
        approvalDecisionKind: "allowed",
      };
    },
  };
}

function scanJsonlSessionSource(
  db: Database.Database,
  input: ScanJsonlSessionSourceInput,
): ScanJsonlSessionSourceResult {
  const lines = readFileSync(input.sourcePath, "utf8").split(/\r?\n/);
  let scanned = 0;
  let created = 0;
  let skippedMalformed = 0;

  const transaction = db.transaction(() => {
    for (const line of lines) {
      if (line.trim().length === 0) {
        continue;
      }

      scanned += 1;
      const parsed = parseJsonLine(line);

      if (!parsed) {
        skippedMalformed += 1;
        continue;
      }

      const normalized = normalizeSessionSourceEntry(parsed, input);

      if (!normalized) {
        skippedMalformed += 1;
        continue;
      }

      const result = upsertWorkSession(db, {
        id: normalized.id,
        source: input.source,
        projectPath: normalized.projectPath,
        searchable: true,
        resumable: false,
        sessionJson: normalized.sessionJson,
        lastActiveAt: normalized.lastActiveAt,
      });

      if (result.changes > 0) {
        created += 1;
      }
    }
  });

  transaction();

  return {
    scanned,
    created,
    skippedMalformed,
  };
}

function upsertWorkSession(
  db: Database.Database,
  input: {
    id: string;
    source: string;
    projectPath: string;
    searchable: boolean;
    resumable: boolean;
    sessionJson: SessionJson;
    lastActiveAt: string;
  },
): Database.RunResult {
  return db
    .prepare(
      `INSERT INTO work_sessions (id, source, project_path, searchable, resumable, session_json, last_active_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         source = excluded.source,
         project_path = excluded.project_path,
         searchable = excluded.searchable,
         resumable = excluded.resumable,
         session_json = excluded.session_json,
         last_active_at = excluded.last_active_at`,
    )
    .run(
      input.id,
      input.source,
      input.projectPath,
      input.searchable ? 1 : 0,
      input.resumable ? 1 : 0,
      JSON.stringify(input.sessionJson),
      input.lastActiveAt,
    );
}

function listWorkSessions(db: Database.Database): ScannedWorkSession[] {
  const rows = db
    .prepare(
      `SELECT id, source, project_path, searchable, resumable, session_json, last_active_at
       FROM work_sessions
       ORDER BY last_active_at ASC, id ASC`,
    )
    .all() as WorkSessionRow[];

  return rows.map((row) => {
    const sessionJson = parseSessionJson(row.session_json);

    return {
      id: row.id,
      source: row.source,
      projectPath: row.project_path,
      searchable: row.searchable === 1,
      resumable: row.resumable === 1,
      lastActiveAt: row.last_active_at,
      sessionId: sessionJson.sessionId,
      evidenceSummary: sessionJson.evidenceSummary,
      client: sessionJson.client,
      sourcePath: sessionJson.sourcePath,
      resumeCommand: row.resumable === 1 ? sessionJson.resumeCommand : undefined,
    };
  });
}

function searchWorkSessions(
  db: Database.Database,
  input: SearchWorkSessionsInput,
): WorkSessionSearchResult[] {
  const keyword = input.keyword?.toLocaleLowerCase();

  return listWorkSessions(db)
    .filter((session) => session.searchable)
    .filter((session) => !input.projectPath || session.projectPath === input.projectPath)
    .filter((session) => !input.source || session.source === input.source)
    .filter((session) => !input.client || session.client === input.client)
    .filter((session) => !input.activeFrom || session.lastActiveAt >= input.activeFrom)
    .filter((session) => !input.activeTo || session.lastActiveAt <= input.activeTo)
    .filter((session) => {
      if (!keyword) {
        return true;
      }

      return [
        session.id,
        session.source,
        session.client,
        session.projectPath,
        session.sessionId,
        session.evidenceSummary,
      ]
        .filter((value): value is string => typeof value === "string")
        .some((value) => value.toLocaleLowerCase().includes(keyword));
    })
    .sort((left, right) => right.lastActiveAt.localeCompare(left.lastActiveAt))
    .map((session) => ({
      ...session,
      availableActions: session.resumable && session.resumeCommand ? ["resume"] : [],
      resumeCommand: session.resumable ? session.resumeCommand : undefined,
    }));
}

function parseJsonLine(line: string): Record<string, unknown> | undefined {
  try {
    const parsed = JSON.parse(line) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function normalizeSessionSourceEntry(
  entry: Record<string, unknown>,
  input: ScanJsonlSessionSourceInput,
):
  | {
      id: string;
      projectPath: string;
      lastActiveAt: string;
      sessionJson: SessionJson;
    }
  | undefined {
  const sessionId = firstString(
    entry.sessionId,
    entry.session_id,
    entry.conversationId,
    entry.conversation_id,
    entry.threadId,
    entry.thread_id,
    entry.id,
  );
  const projectPath = firstString(
    entry.cwd,
    entry.projectPath,
    entry.project_path,
    entry.workspacePath,
    entry.workspace_path,
    entry.workspace,
    entry.repositoryPath,
    entry.repository_path,
  );
  const lastActiveAt = firstString(
    entry.timestamp,
    entry.lastActiveAt,
    entry.last_active_at,
    entry.updatedAt,
    entry.updated_at,
    entry.createdAt,
    entry.created_at,
    entry.time,
  );
  const evidenceSummary = firstString(
    entry.message,
    entry.text,
    entry.summary,
    entry.prompt,
    firstTextFromNestedEvidence(entry.message),
    firstTextFromNestedEvidence(entry.events),
    firstTextFromNestedEvidence(entry.transcript),
    firstTextFromNestedEvidence(entry.messages),
  );

  if (!sessionId || !projectPath || !lastActiveAt || !evidenceSummary) {
    return undefined;
  }

  return {
    id: `${input.source}:${sessionId}`,
    projectPath,
    lastActiveAt,
    sessionJson: {
      client: input.client,
      sessionId,
      sourcePath: input.sourcePath,
      evidenceSummary,
      sourceEvidence: entry,
    },
  };
}

function parseSessionJson(value: string): SessionJson {
  const parsed = JSON.parse(value) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("Invalid Work Session JSON");
  }

  return {
    client: String(parsed.client ?? ""),
    sessionId: typeof parsed.sessionId === "string" ? parsed.sessionId : undefined,
    sourcePath: String(parsed.sourcePath ?? ""),
    evidenceSummary: String(parsed.evidenceSummary ?? ""),
    resumeCommand: typeof parsed.resumeCommand === "string" ? parsed.resumeCommand : undefined,
    sourceEvidence: isRecord(parsed.sourceEvidence) ? parsed.sourceEvidence : {},
  };
}

function firstString(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.length > 0);
}

function firstTextFromNestedEvidence(value: unknown): string | undefined {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const text = firstTextFromNestedEvidence(item);
      if (text) {
        return text;
      }
    }
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  return firstString(
    value.content,
    value.text,
    value.message,
    value.summary,
    value.prompt,
    firstTextFromNestedEvidence(value.content),
    firstTextFromNestedEvidence(value.message),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
