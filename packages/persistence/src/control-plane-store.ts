import Database from "better-sqlite3";

export interface McpServerRecord {
  id: string;
  name: string;
  command: string;
  args?: string[];
  env?: Record<string, string>;
  status: "running" | "stopped";
  toolCount?: number;
  lastStartedAt?: string;
}

export interface BackupRecord {
  id: string;
  name: string;
  snapshotJson: string;
  createdAt: string;
  isAuto?: boolean;
}

export interface AppSettingsRecord {
  autoFailover: boolean;
  failoverThreshold: number;
  circuitBreakerTimeout: number;
  mcpAutoStart: boolean;
  workspaceDir: string;
  [key: string]: unknown;
}

export interface PromptRecord {
  id: string;
  name: string;
  nameZh?: string;
  content: string;
  category?: string;
  tags?: string[];
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SkillsStateRecord {
  projectPath: string;
  installedSkillPacks: Array<{
    id: string;
    name: string;
    source: string;
    installedAt: string;
  }>;
  projectActivations: Array<{
    skillPackId: string;
    enabled: boolean;
    source: "project" | "global-default";
  }>;
  workspaceRuleDeployments: Array<{
    skillPackId: string;
    status: "not-deployed" | "deployed" | "approval-required";
    managedRuleFiles: Array<{
      targetPath: string;
      method: "symlink" | "copy";
    }>;
  }>;
}

export interface SafetyApprovalRequest {
  id: string;
  title: string;
  message: string;
  actionRiskClass: string;
  createdAt: string;
  status: string;
}

export interface SafetyRiskNotice {
  id: string;
  message: string;
  observedAt: string;
  clientAuthorizationMode: string;
}

export interface SafetyTrustGrant {
  id: string;
  actionKinds: string[];
  projectPath?: string;
  clientId?: string;
  maxRiskClass: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface ControlPlaneStore {
  mcpServers: {
    list(): McpServerRecord[];
    save(server: McpServerRecord): void;
    delete(id: string): boolean;
  };
  backups: {
    list(): BackupRecord[];
    create(input: { id: string; name: string; snapshotJson: string; isAuto?: boolean }): void;
    delete(id: string): boolean;
  };
  settings: {
    load(): AppSettingsRecord | null;
    save(settings: AppSettingsRecord): void;
  };
  prompts: {
    list(): PromptRecord[];
    save(prompt: PromptRecord): void;
    delete(id: string): boolean;
  };
  skillsState: {
    load(): SkillsStateRecord | null;
    save(state: SkillsStateRecord): void;
  };
  safety: {
    approvalRequests: {
      list(): SafetyApprovalRequest[];
      save(req: SafetyApprovalRequest): void;
      updateStatus(id: string, status: string): boolean;
      delete(id: string): boolean;
    };
    riskNotices: {
      list(): SafetyRiskNotice[];
      save(notice: SafetyRiskNotice): void;
      delete(id: string): boolean;
    };
    trustGrants: {
      list(): SafetyTrustGrant[];
      save(grant: SafetyTrustGrant): void;
      revoke(id: string): boolean;
      delete(id: string): boolean;
    };
  };
  close(): void;
}

export function createControlPlaneStore(dbPath: string): ControlPlaneStore {
  const db = new Database(dbPath);

  db.exec(`
    CREATE TABLE IF NOT EXISTS desktop_mcp_servers (
      id TEXT PRIMARY KEY,
      server_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_backups (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      snapshot_json TEXT NOT NULL,
      is_auto INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_app_settings (
      id TEXT PRIMARY KEY,
      settings_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_prompts (
      id TEXT PRIMARY KEY,
      prompt_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_skills_state (
      id TEXT PRIMARY KEY,
      state_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_approval_requests (
      id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Approval Required',
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_risk_notices (
      id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS desktop_trust_grants (
      id TEXT PRIMARY KEY,
      record_json TEXT NOT NULL,
      revoked INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  return {
    mcpServers: {
      list(): McpServerRecord[] {
        const rows = db
          .prepare("SELECT server_json FROM desktop_mcp_servers ORDER BY updated_at DESC")
          .all() as Array<{ server_json: string }>;
        return rows.map((r) => JSON.parse(r.server_json) as McpServerRecord);
      },

      save(server: McpServerRecord): void {
        db.prepare(
          `INSERT INTO desktop_mcp_servers (id, server_json, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             server_json = excluded.server_json,
             updated_at = excluded.updated_at`,
        ).run(server.id, JSON.stringify(server));
      },

      delete(id: string): boolean {
        const result = db.prepare("DELETE FROM desktop_mcp_servers WHERE id = ?").run(id);
        return result.changes > 0;
      },
    },

    backups: {
      list(): BackupRecord[] {
        const rows = db
          .prepare("SELECT id, name, snapshot_json, is_auto, created_at FROM desktop_backups ORDER BY created_at DESC")
          .all() as Array<{ id: string; name: string; snapshot_json: string; is_auto: number; created_at: string }>;
        return rows.map((r) => ({
          id: r.id,
          name: r.name,
          snapshotJson: r.snapshot_json,
          isAuto: r.is_auto === 1,
          createdAt: r.created_at,
        }));
      },

      create(input: { id: string; name: string; snapshotJson: string; isAuto?: boolean }): void {
        db.prepare(
          `INSERT INTO desktop_backups (id, name, snapshot_json, is_auto, created_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
        ).run(input.id, input.name, input.snapshotJson, input.isAuto ? 1 : 0);
      },

      delete(id: string): boolean {
        const result = db.prepare("DELETE FROM desktop_backups WHERE id = ?").run(id);
        return result.changes > 0;
      },
    },

    settings: {
      load(): AppSettingsRecord | null {
        const row = db
          .prepare("SELECT settings_json FROM desktop_app_settings WHERE id = 'default'")
          .get() as { settings_json: string } | undefined;
        if (!row) return null;
        return JSON.parse(row.settings_json) as AppSettingsRecord;
      },

      save(settings: AppSettingsRecord): void {
        db.prepare(
          `INSERT INTO desktop_app_settings (id, settings_json, updated_at)
           VALUES ('default', ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             settings_json = excluded.settings_json,
             updated_at = excluded.updated_at`,
        ).run(JSON.stringify(settings));
      },
    },

    prompts: {
      list(): PromptRecord[] {
        const rows = db
          .prepare("SELECT prompt_json FROM desktop_prompts ORDER BY updated_at DESC")
          .all() as Array<{ prompt_json: string }>;
        return rows.map((r) => JSON.parse(r.prompt_json) as PromptRecord);
      },
      save(prompt: PromptRecord): void {
        db.prepare(
          `INSERT INTO desktop_prompts (id, prompt_json, updated_at)
           VALUES (?, ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             prompt_json = excluded.prompt_json,
             updated_at = excluded.updated_at`,
        ).run(prompt.id, JSON.stringify(prompt));
      },
      delete(id: string): boolean {
        const result = db.prepare("DELETE FROM desktop_prompts WHERE id = ?").run(id);
        return result.changes > 0;
      },
    },

    skillsState: {
      load(): SkillsStateRecord | null {
        const row = db
          .prepare("SELECT state_json FROM desktop_skills_state WHERE id = 'default'")
          .get() as { state_json: string } | undefined;
        if (!row) return null;
        return JSON.parse(row.state_json) as SkillsStateRecord;
      },
      save(state: SkillsStateRecord): void {
        db.prepare(
          `INSERT INTO desktop_skills_state (id, state_json, updated_at)
           VALUES ('default', ?, datetime('now'))
           ON CONFLICT(id) DO UPDATE SET
             state_json = excluded.state_json,
             updated_at = excluded.updated_at`,
        ).run(JSON.stringify(state));
      },
    },

    safety: {
      approvalRequests: {
        list(): SafetyApprovalRequest[] {
          const rows = db
            .prepare("SELECT record_json, status FROM desktop_approval_requests ORDER BY created_at DESC")
            .all() as Array<{ record_json: string; status: string }>;
          return rows.map((r) => ({ ...JSON.parse(r.record_json), status: r.status } as SafetyApprovalRequest));
        },
        save(req: SafetyApprovalRequest): void {
          db.prepare(
            `INSERT INTO desktop_approval_requests (id, record_json, status, created_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, status = excluded.status`,
          ).run(req.id, JSON.stringify(req), req.status);
        },
        updateStatus(id: string, status: string): boolean {
          const result = db.prepare("UPDATE desktop_approval_requests SET status = ? WHERE id = ?").run(status, id);
          return result.changes > 0;
        },
        delete(id: string): boolean {
          const result = db.prepare("DELETE FROM desktop_approval_requests WHERE id = ?").run(id);
          return result.changes > 0;
        },
      },
      riskNotices: {
        list(): SafetyRiskNotice[] {
          const rows = db
            .prepare("SELECT record_json FROM desktop_risk_notices ORDER BY created_at DESC")
            .all() as Array<{ record_json: string }>;
          return rows.map((r) => JSON.parse(r.record_json) as SafetyRiskNotice);
        },
        save(notice: SafetyRiskNotice): void {
          db.prepare(
            `INSERT INTO desktop_risk_notices (id, record_json, created_at)
             VALUES (?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json`,
          ).run(notice.id, JSON.stringify(notice));
        },
        delete(id: string): boolean {
          const result = db.prepare("DELETE FROM desktop_risk_notices WHERE id = ?").run(id);
          return result.changes > 0;
        },
      },
      trustGrants: {
        list(): SafetyTrustGrant[] {
          const rows = db
            .prepare("SELECT record_json, revoked FROM desktop_trust_grants ORDER BY created_at DESC")
            .all() as Array<{ record_json: string; revoked: number }>;
          return rows.map((r) => {
            const grant = JSON.parse(r.record_json) as SafetyTrustGrant;
            if (r.revoked) grant.revokedAt = grant.revokedAt || new Date().toISOString();
            return grant;
          });
        },
        save(grant: SafetyTrustGrant): void {
          db.prepare(
            `INSERT INTO desktop_trust_grants (id, record_json, revoked, created_at)
             VALUES (?, ?, ?, datetime('now'))
             ON CONFLICT(id) DO UPDATE SET record_json = excluded.record_json, revoked = excluded.revoked`,
          ).run(grant.id, JSON.stringify(grant), grant.revokedAt ? 1 : 0);
        },
        revoke(id: string): boolean {
          const result = db.prepare("UPDATE desktop_trust_grants SET revoked = 1 WHERE id = ?").run(id);
          return result.changes > 0;
        },
        delete(id: string): boolean {
          const result = db.prepare("DELETE FROM desktop_trust_grants WHERE id = ?").run(id);
          return result.changes > 0;
        },
      },
    },

    close(): void {
      db.close();
    },
  };
}
