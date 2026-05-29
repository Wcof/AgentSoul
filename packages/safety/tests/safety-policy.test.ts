import { describe, it, expect } from "vitest";
import {
  classifyActionRisk,
  createApprovalFlow,
  createRiskNoticeFlow,
  createScopedTrustGrantStore,
  decideSafetyPolicy,
  resolveApprovalTimeout,
} from "@agentsoul/safety";

describe("Safety Policy decision engine", () => {
  it("requires Approval Required for high-risk actions through a Controlled Entry Point", () => {
    const decision = decideSafetyPolicy({
      action: {
        kind: "write-file",
        target: "/workspace/CLAUDE.md",
      },
      controlledEntryPoint: "mcp-server",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:00:00.000Z",
    });

    expect(decision.outcome).toBe("approval-required");
    expect(decision.actionRiskClass).toBe("high-risk");
    expect(decision.approvalRequest?.actionRiskClass).toBe("high-risk");
    expect(decision.approvalRequest?.title ?? "").toMatch(/Write file/);
  });

  it("classifies Safe, Sensitive, High-risk, and Critical actions consistently", () => {
    expect(classifyActionRisk({ kind: "chat" })).toBe("safe");
    expect(classifyActionRisk({ kind: "read-sensitive-path", target: "~/.ssh" })).toBe("sensitive");
    expect(classifyActionRisk({ kind: "execute-command", target: "npm test" })).toBe("high-risk");
    expect(classifyActionRisk({ kind: "export-secret", target: "provider credentials" })).toBe("critical");
  });

  it("emits a Risk Notice instead of Approval Required for bypassed fully authorized clients", () => {
    const decision = decideSafetyPolicy({
      action: {
        kind: "execute-command",
        target: "rm -rf build",
      },
      clientAuthorizationMode: "fully-authorized",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:05:00.000Z",
    });

    expect(decision.outcome).toBe("risk-notice");
    expect(decision.actionRiskClass).toBe("high-risk");
    expect(decision.approvalRequest).toBe(undefined);
    expect(decision.riskNotice?.clientAuthorizationMode).toBe("fully-authorized");
  });

  it("denies by default when an approval surface is unavailable for a controlled high-risk action", () => {
    const decision = decideSafetyPolicy({
      action: {
        kind: "launch-session",
        target: "claude -r session-123",
      },
      controlledEntryPoint: "client-hook",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: false,
      now: "2026-05-28T10:10:00.000Z",
    });

    expect(decision.outcome).toBe("deny");
    expect(decision.actionRiskClass).toBe("high-risk");
    expect(decision.approvalDecision?.kind).toBe("unavailable-denied");
  });

  it("resolves unanswered approval requests as timeout-denied decisions", () => {
    const decision = resolveApprovalTimeout(
      {
        id: "approval:execute-command:2026-05-28T10:15:00.000Z",
        actionRiskClass: "high-risk",
        title: "Execute command",
        message: "Execute command: npm publish",
        createdAt: "2026-05-28T10:15:00.000Z",
      },
      "2026-05-28T10:16:00.000Z",
    );

    expect(decision.requestId).toBe("approval:execute-command:2026-05-28T10:15:00.000Z");
    expect(decision.kind).toBe("timeout-denied");
    expect(decision.decidedAt).toBe("2026-05-28T10:16:00.000Z");
  });

  it("allows high-risk actions covered by a valid Scoped Trust Grant", () => {
    const decision = decideSafetyPolicy({
      action: {
        kind: "execute-command",
        target: "npm test",
      },
      controlledEntryPoint: "mcp-server",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      scope: {
        projectPath: "/workspace/app",
        clientId: "claude-code",
      },
      scopedTrustGrants: [
        {
          id: "trust:tests",
          actionKinds: ["execute-command"],
          projectPath: "/workspace/app",
          clientId: "claude-code",
          maxRiskClass: "high-risk",
          expiresAt: "2026-05-28T11:00:00.000Z",
          createdAt: "2026-05-28T10:20:00.000Z",
        },
      ],
      now: "2026-05-28T10:20:00.000Z",
    });

    expect(decision.outcome).toBe("allow");
    expect(decision.actionRiskClass).toBe("high-risk");
    expect(decision.trustGrantId).toBe("trust:tests");
  });

  it("allows Safe actions and emits Risk Notice for Sensitive actions", () => {
    const safeDecision = decideSafetyPolicy({
      action: { kind: "read-status" },
      controlledEntryPoint: "gateway",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:25:00.000Z",
    });
    const sensitiveDecision = decideSafetyPolicy({
      action: { kind: "read-sensitive-path", target: "~/.ssh/config" },
      controlledEntryPoint: "mcp-server",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:25:00.000Z",
    });

    expect(safeDecision.outcome).toBe("allow");
    expect(safeDecision.actionRiskClass).toBe("safe");
    expect(sensitiveDecision.outcome).toBe("risk-notice");
    expect(sensitiveDecision.actionRiskClass).toBe("sensitive");
    expect(sensitiveDecision.riskNotice?.message ?? "").toMatch(/~\/.ssh\/config/);
  });
});

describe("Approval Required flow", () => {
  it("keeps blockable high-risk actions pending until the user allows or denies", () => {
    const flow = createApprovalFlow();
    const pending = flow.requestApproval({
      action: { kind: "write-file", target: "/workspace/app/README.md" },
      controlledEntryPoint: "mcp-server",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:30:00.000Z",
    });

    if (!("status" in pending)) {
      throw new Error("Expected Approval Required state");
    }
    expect(pending.status).toBe("approval-required");
    expect(pending.approvalRequest.actionRiskClass).toBe("high-risk");
    expect(flow.getPendingApproval()?.id).toBe(pending.approvalRequest.id);

    const allowed = flow.decideApproval(pending.approvalRequest.id, "allowed", "2026-05-28T10:30:10.000Z");

    expect(allowed.kind).toBe("allowed");
    expect(flow.getPendingApproval()).toBe(undefined);
  });

  it("records explicit denial and timeout-denied decisions for pending approvals", () => {
    const deniedFlow = createApprovalFlow();
    const deniedPending = deniedFlow.requestApproval({
      action: { kind: "delete-file", target: "/workspace/app/tmp.txt" },
      controlledEntryPoint: "client-hook",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:35:00.000Z",
    });

    if (!("status" in deniedPending)) {
      throw new Error("Expected Approval Required state");
    }
    expect(deniedPending.status).toBe("approval-required");
    const denied = deniedFlow.decideApproval(
      deniedPending.approvalRequest.id,
      "denied",
      "2026-05-28T10:35:05.000Z",
    );
    expect(denied.kind).toBe("denied");
    expect(deniedFlow.getPendingApproval()).toBe(undefined);

    const timeoutFlow = createApprovalFlow();
    const timeoutPending = timeoutFlow.requestApproval({
      action: { kind: "execute-command", target: "npm publish" },
      controlledEntryPoint: "mcp-server",
      clientAuthorizationMode: "normal",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:36:00.000Z",
    });

    if (!("status" in timeoutPending)) {
      throw new Error("Expected Approval Required state");
    }
    expect(timeoutPending.status).toBe("approval-required");
    const timeout = timeoutFlow.timeoutPendingApproval("2026-05-28T10:37:00.000Z");

    expect(timeout?.kind).toBe("timeout-denied");
    expect(timeout?.requestId).toBe(timeoutPending.approvalRequest.id);
    expect(timeoutFlow.getPendingApproval()).toBe(undefined);
  });
});

describe("Risk Notice flow", () => {
  it("records bypassed fully authorized actions as non-blocking Risk Notices", () => {
    const flow = createRiskNoticeFlow();
    const result = flow.observeAction({
      action: { kind: "execute-command", target: "rm -rf build" },
      clientAuthorizationMode: "fully-authorized",
      approvalSurfaceAvailable: true,
      now: "2026-05-28T10:40:00.000Z",
    });

    if (!("status" in result)) {
      throw new Error("Expected Risk Notice state");
    }
    expect(result.status).toBe("risk-notice");
    expect(result.blocking).toBe(false);
    expect(result.riskNotice.clientAuthorizationMode).toBe("fully-authorized");
    expect(flow.getRiskNotices()[0]?.id).toBe(result.riskNotice.id);
  });
});

describe("Scoped Trust Grants", () => {
  it("creates scoped trust that only matches action, project, client, path, profile, and time scope", () => {
    const store = createScopedTrustGrantStore();
    const grant = store.createGrant({
      actionKinds: ["execute-command"],
      projectPath: "/workspace/app",
      clientId: "claude-code",
      targetPathPrefix: "/workspace/app/scripts",
      providerProfileId: "openai",
      expiresAt: "2026-05-28T11:00:00.000Z",
      createdAt: "2026-05-28T10:45:00.000Z",
    });

    expect(store.listGrants()[0]?.id).toBe(grant.id);
    expect(store.findMatchingGrant({
        action: { kind: "execute-command", target: "/workspace/app/scripts/test.sh" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
          providerProfileId: "openai",
        },
        now: "2026-05-28T10:50:00.000Z",
      })?.id).toBe(grant.id);

    expect(store.findMatchingGrant({
        action: { kind: "execute-command", target: "/workspace/other/scripts/test.sh" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/other",
          clientId: "claude-code",
          providerProfileId: "openai",
        },
        now: "2026-05-28T10:50:00.000Z",
      })).toBe(undefined);
    expect(store.findMatchingGrant({
        action: { kind: "execute-command", target: "/workspace/app/scripts/test.sh" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
          providerProfileId: "openai",
        },
        now: "2026-05-28T11:00:00.000Z",
      })).toBe(undefined);
  });

  it("does not let ordinary Scoped Trust Grants cover Critical Actions", () => {
    const store = createScopedTrustGrantStore();
    store.createGrant({
      actionKinds: ["export-secret"],
      projectPath: "/workspace/app",
      clientId: "claude-code",
      expiresAt: "2026-05-28T11:00:00.000Z",
      createdAt: "2026-05-28T10:45:00.000Z",
    });

    expect(store.findMatchingGrant({
        action: { kind: "export-secret", target: "provider credentials" },
        actionRiskClass: "critical",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
        },
        now: "2026-05-28T10:50:00.000Z",
      })).toBe(undefined);
  });

  it("revokes Scoped Trust Grants so they no longer match future actions", () => {
    const store = createScopedTrustGrantStore();
    const grant = store.createGrant({
      actionKinds: ["launch-session"],
      projectPath: "/workspace/app",
      clientId: "claude-code",
      expiresAt: "2026-05-28T11:00:00.000Z",
      createdAt: "2026-05-28T10:45:00.000Z",
    });

    const revoked = store.revokeGrant(grant.id, "2026-05-28T10:50:00.000Z");

    expect(revoked?.id).toBe(grant.id);
    expect(revoked?.revokedAt).toBe("2026-05-28T10:50:00.000Z");
    expect(store.findMatchingGrant({
        action: { kind: "launch-session", target: "claude -r session-1" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
        },
        now: "2026-05-28T10:55:00.000Z",
      })).toBe(undefined);
  });
});
