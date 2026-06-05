import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import { createUserManagedExportService } from "@agentsoul/export";
import { createProviderProfileService } from "@agentsoul/provider";
import { createCompanionRuntime } from "@agentsoul/companion";

describe("User-managed Export", () => {
  it("exports Portable Data and excludes credentials, bodies, raw evidence, and private auth files", () => {
    withDatabase((dbPath) => {
      seedPortableData(dbPath);
      const service = createUserManagedExportService({
        dbPath,
        clock: () => new Date("2026-05-29T10:00:00.000Z"),
        decideSafetyPolicy: decideExportSafetyPolicy,
      });

      try {
        const portable = service.createPortableDataExport();
        const serialized = JSON.stringify(portable);

        expect(portable.exportKind).toBe("portable-data");
        expect(portable.formatVersion).toBe("agentsoul-export-v1");
        expect(portable.schemaVersion).toBe(1);
        expect(portable.sensitiveDataIncluded).toBe(false);
        expect(portable.createdAt).toBe("2026-05-29T10:00:00.000Z");

        expect(portable.companion).toBeTruthy();
        expect(portable.growthEvents.length).toBe(1);
        expect(portable.providerProfiles[0]?.id).toBe("anthropic-main");
        expect(portable.providerProfiles[0]?.name).toBe("Anthropic Main");
        expect("credentialRef" in (portable.providerProfiles[0] ?? {})).toBe(false);
        expect(portable.providerProfiles[0]?.adapterSettingsIncluded).toBe(false);
        expect((portable.skillPacks[0] as { name?: string } | undefined)?.name).toBe("TDD");
        expect((portable.projectSkillActivations[0] as { enabled?: boolean } | undefined)?.enabled).toBe(true);
        expect(portable.workSessions[0]?.id).toBe("work-session-1");
        expect("resumeCommand" in (portable.workSessions[0] ?? {})).toBe(false);
        expect("evidenceSummary" in (portable.workSessions[0] ?? {})).toBe(false);
        expect((
            portable.trafficMetadataSummaries[0]?.trafficMetadata as
              | { inputTokens?: number }
              | undefined
          )?.inputTokens).toBe(1200);
        expect(portable.exclusions).toEqual([
          "Credentials",
          "captured request/response bodies",
          "raw indexed evidence",
          "private client auth files",
        ]);

        expect(serialized).not.toMatch(/sk-anthropic-secret/);
        expect(serialized).not.toMatch(/credential:anthropic-main/);
        expect(serialized).not.toMatch(/captured request body/);
        expect(serialized).not.toMatch(/raw indexed evidence text/);
        expect(serialized).not.toMatch(/Discussed export boundary/);
        expect(serialized).not.toMatch(/claude -r session-1/);
        expect(serialized).not.toMatch(new RegExp("\\.claude/auth"));
      } finally {
        service.close();
      }
    });
  });

  it("requires explicit high-risk confirmation before creating a Sensitive Export", () => {
    withDatabase((dbPath) => {
      const service = createUserManagedExportService({ dbPath, decideSafetyPolicy: decideExportSafetyPolicy });

      try {
        const pending = service.createSensitiveExport({
          payload: {
            credential: "sk-anthropic-secret",
            capturedBody: "captured request body",
          },
          clientAuthorizationMode: "normal",
          approvalSurfaceAvailable: true,
          now: "2026-05-29T10:05:00.000Z",
          projectPath: "/workspace/app",
          clientId: "claude-code",
        });

        expect(pending.status).toBe("approval-required");
        if (pending.status !== "approval-required") {
          throw new Error("Expected approval-required");
        }
        expect(pending.actionRiskClass).toBe("critical");
        expect(pending.approvalRequestId).toMatch(/^approval:export-secret:/);

        const denied = service.createSensitiveExport({
          payload: { credential: "sk-anthropic-secret" },
          clientAuthorizationMode: "normal",
          approvalSurfaceAvailable: true,
          now: "2026-05-29T10:05:00.000Z",
          approvalDecisionKind: "denied",
        });
        expect(denied).toEqual({
          status: "denied",
          reason: "approval-denied",
        });

        const exported = service.createSensitiveExport({
          payload: { credential: "sk-anthropic-secret" },
          clientAuthorizationMode: "normal",
          approvalSurfaceAvailable: true,
          now: "2026-05-29T10:06:00.000Z",
          approvalDecisionKind: "allowed",
        });

        expect(exported.status).toBe("exported");
        if (exported.status !== "exported") {
          throw new Error("Expected exported");
        }
        expect(exported.exportKind).toBe("sensitive-export");
        expect(exported.formatVersion).toBe("agentsoul-export-v1");
        expect(exported.schemaVersion).toBe(1);
        expect(exported.sensitiveDataIncluded).toBe(true);
        expect(exported.payload).toEqual({ credential: "sk-anthropic-secret" });
      } finally {
        service.close();
      }
    });
  });
});

function seedPortableData(dbPath: string): void {
  const runtime = createCompanionRuntime({ dbPath });
  try {
    runtime.performCompanionInteraction("pet");
  } finally {
    runtime.close();
  }

  const providerProfiles = createProviderProfileService({ dbPath });
  try {
    providerProfiles.createProviderProfile({
      id: "anthropic-main",
      name: "Anthropic Main",
      activationMode: "gateway-route",
      credentialRef: "credential:anthropic-main:sk-anthropic-secret",
      clientProtocol: "claude-messages",
      providerProtocol: "anthropic",
      targetModel: "claude-sonnet",
      endpoint: "https://api.anthropic.com",
      adapterSettings: {
        privateAuthFile: "/Users/dev/.claude/auth",
        capturedBody: "captured request body",
      },
    });
  } finally {
    providerProfiles.close();
  }

  const db = new Database(dbPath);
  try {
    db.prepare("INSERT INTO skill_packs (id, skill_json, installed_at) VALUES (?, ?, ?)").run(
      "skill-tdd",
      JSON.stringify({
      id: "skill-tdd",
      name: "TDD",
      source: {
        kind: "local-directory",
        uri: "/skills/tdd",
      },
      globalDefaultEnabled: false,
      installedAt: "2026-05-29T09:00:00.000Z",
    }),
      "2026-05-29T09:00:00.000Z",
    );
    db.prepare(
      "INSERT INTO project_skill_activations (id, project_path, skill_pack_id, enabled, updated_at) VALUES (?, ?, ?, ?, ?)",
    ).run("activation-1", "/workspace/app", "skill-tdd", 1, "2026-05-29T09:05:00.000Z");
    db.prepare(
      "INSERT INTO work_sessions (id, source, project_path, searchable, resumable, session_json, last_active_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "work-session-1",
      "claude-history",
      "/workspace/app",
      1,
      1,
      JSON.stringify({
      id: "work-session-1",
      source: "claude-history",
      client: "claude-code",
      projectPath: "/workspace/app",
      sessionId: "session-1",
      lastActiveAt: "2026-05-29T09:10:00.000Z",
      evidenceSummary: "Discussed export boundary",
      searchable: true,
      resumable: true,
      resumeCommand: "claude -r session-1",
      sourcePath: "/Users/dev/.claude/history.jsonl",
    }),
      "2026-05-29T09:10:00.000Z",
    );
    db.prepare(
      "INSERT INTO audit_records (id, gateway_event_id, traffic_metadata_json, estimated_cost, outcome, evidence_hash, occurred_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "audit-1",
      "gateway-event-1",
      JSON.stringify({
        gatewayEventId: "gateway-event-1",
        clientProtocol: "claude-messages",
        providerProtocol: "anthropic",
        providerProfileId: "anthropic-main",
        model: "claude-sonnet",
        route: "claude-messages -> anthropic",
        inputTokens: 1200,
        outputTokens: 300,
        latencyMs: 850,
        outcome: "success",
      }),
      0.0042,
      "success",
      "sha256:raw-evidence-digest",
      "2026-05-29T09:15:00.000Z",
    );
  } finally {
    db.close();
  }
}

function decideExportSafetyPolicy(options: {
  approvalSurfaceAvailable: boolean;
  approvalDecisionKind?: "allowed" | "denied";
}): any {
  if (!options.approvalSurfaceAvailable) {
    return { outcome: "deny" };
  }
  if (options.approvalDecisionKind === "allowed") {
    return { outcome: "allow" };
  }
  if (options.approvalDecisionKind === "denied") {
    return { outcome: "approval-required", approvalRequest: { id: "approval:export-secret:denied" } };
  }
  return { outcome: "approval-required", approvalRequest: { id: "approval:export-secret:pending" } };
}

function withDatabase(fn: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-export-"));
  try {
    fn(join(dir, "agentsoul.sqlite"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("Export manifest", () => {
  it("generates ExportManifest with included and excluded sections", () => {
    withDatabase((dbPath) => {
      const service = createUserManagedExportService({
        dbPath,
        clock: () => new Date("2026-05-29T10:00:00.000Z"),
        decideSafetyPolicy: decideExportSafetyPolicy,
      });

      try {
        const portableManifest = service.createExportManifest("portable");
        expect(portableManifest.kind).toBe("portable");
        expect(portableManifest.includedSections).toContain("companion");
        expect(portableManifest.includedSections).toContain("growthEvents");
        expect(portableManifest.includedSections).toContain("providerProfiles");
        expect(portableManifest.excludedSections).toContain("credentials");
        expect(portableManifest.excludedSections).toContain("capturedBodies");
        expect(portableManifest.createdAt).toBe("2026-05-29T10:00:00.000Z");

        const sensitiveManifest = service.createExportManifest("sensitive");
        expect(sensitiveManifest.kind).toBe("sensitive");
        expect(sensitiveManifest.includedSections).toContain("credentials");
        expect(sensitiveManifest.includedSections).toContain("capturedBodies");
        expect(sensitiveManifest.excludedSections).toHaveLength(0);
      } finally {
        service.close();
      }
    });
  });
});
