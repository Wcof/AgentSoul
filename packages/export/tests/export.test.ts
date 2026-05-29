import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createUserManagedExportService } from "@agentsoul/export";
import { createGatewayAuditRepository } from "@agentsoul/gateway";
import { createProviderProfileService } from "@agentsoul/provider";
import { createCompanionRuntime } from "@agentsoul/runtime";
import { createSessionSourceScanner } from "@agentsoul/sessions";
import { createSkillSourceStore } from "@agentsoul/skills";

describe("User-managed Export", () => {
  it("exports Portable Data and excludes credentials, bodies, raw evidence, and private auth files", () => {
    withDatabase((dbPath) => {
      seedPortableData(dbPath);
      const service = createUserManagedExportService({
        dbPath,
        clock: () => new Date("2026-05-29T10:00:00.000Z"),
      });

      try {
        const portable = service.createPortableDataExport();
        const serialized = JSON.stringify(portable);

        assert.equal(portable.exportKind, "portable-data");
        assert.equal(portable.formatVersion, "agentsoul-export-v1");
        assert.equal(portable.schemaVersion, 1);
        assert.equal(portable.sensitiveDataIncluded, false);
        assert.equal(portable.createdAt, "2026-05-29T10:00:00.000Z");

        assert.ok(portable.companion);
        assert.equal(portable.growthEvents.length, 1);
        assert.equal(portable.providerProfiles[0]?.id, "anthropic-main");
        assert.equal(portable.providerProfiles[0]?.name, "Anthropic Main");
        assert.equal("credentialRef" in (portable.providerProfiles[0] ?? {}), false);
        assert.equal(portable.providerProfiles[0]?.adapterSettingsIncluded, false);
        assert.equal((portable.skillPacks[0] as { name?: string } | undefined)?.name, "TDD");
        assert.equal(
          (portable.projectSkillActivations[0] as { enabled?: boolean } | undefined)?.enabled,
          true,
        );
        assert.equal(portable.workSessions[0]?.id, "work-session-1");
        assert.equal(
          (
            portable.trafficMetadataSummaries[0]?.trafficMetadata as
              | { inputTokens?: number }
              | undefined
          )?.inputTokens,
          1200,
        );
        assert.deepEqual(portable.exclusions, [
          "Credentials",
          "captured request/response bodies",
          "raw indexed evidence",
          "private client auth files",
        ]);

        assert.doesNotMatch(serialized, /sk-anthropic-secret/);
        assert.doesNotMatch(serialized, /credential:anthropic-main/);
        assert.doesNotMatch(serialized, /captured request body/);
        assert.doesNotMatch(serialized, /raw indexed evidence text/);
        assert.doesNotMatch(serialized, new RegExp("\\.claude/auth"));
      } finally {
        service.close();
      }
    });
  });

  it("requires explicit high-risk confirmation before creating a Sensitive Export", () => {
    withDatabase((dbPath) => {
      const service = createUserManagedExportService({ dbPath });

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

        assert.equal(pending.status, "approval-required");
        if (pending.status !== "approval-required") {
          throw new Error("Expected approval-required");
        }
        assert.equal(pending.actionRiskClass, "critical");
        assert.match(pending.approvalRequestId, /^approval:export-secret:/);

        const denied = service.createSensitiveExport({
          payload: { credential: "sk-anthropic-secret" },
          clientAuthorizationMode: "normal",
          approvalSurfaceAvailable: true,
          now: "2026-05-29T10:05:00.000Z",
          approvalDecisionKind: "denied",
        });
        assert.deepEqual(denied, {
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

        assert.equal(exported.status, "exported");
        if (exported.status !== "exported") {
          throw new Error("Expected exported");
        }
        assert.equal(exported.exportKind, "sensitive-export");
        assert.equal(exported.formatVersion, "agentsoul-export-v1");
        assert.equal(exported.schemaVersion, 1);
        assert.equal(exported.sensitiveDataIncluded, true);
        assert.deepEqual(exported.payload, { credential: "sk-anthropic-secret" });
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

  const skills = createSkillSourceStore({ dbPath });
  try {
    skills.installSkillPack({
      id: "skill-tdd",
      name: "TDD",
      source: {
        kind: "local-directory",
        uri: "/skills/tdd",
      },
      globalDefaultEnabled: false,
      installedAt: "2026-05-29T09:00:00.000Z",
    });
    skills.setProjectSkillActivation({
      projectPath: "/workspace/app",
      skillPackId: "skill-tdd",
      enabled: true,
      updatedAt: "2026-05-29T09:05:00.000Z",
    });
  } finally {
    skills.close();
  }

  const sessions = createSessionSourceScanner({ dbPath });
  try {
    sessions.recordWorkSession({
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
    });
  } finally {
    sessions.close();
  }

  const audit = createGatewayAuditRepository({ dbPath });
  try {
    audit.recordAudit({
      trafficMetadata: {
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
      },
      estimatedCost: 0.0042,
      outcome: "success",
      evidenceHash: "sha256:raw-evidence-digest",
    });
  } finally {
    audit.close();
  }
}

function withDatabase(fn: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-export-"));
  try {
    fn(join(dir, "agentsoul.sqlite"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
