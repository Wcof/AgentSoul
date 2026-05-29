import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

    assert.equal(decision.outcome, "approval-required");
    assert.equal(decision.actionRiskClass, "high-risk");
    assert.equal(decision.approvalRequest?.actionRiskClass, "high-risk");
    assert.match(decision.approvalRequest?.title ?? "", /Write file/);
  });

  it("classifies Safe, Sensitive, High-risk, and Critical actions consistently", () => {
    assert.equal(classifyActionRisk({ kind: "chat" }), "safe");
    assert.equal(classifyActionRisk({ kind: "read-sensitive-path", target: "~/.ssh" }), "sensitive");
    assert.equal(classifyActionRisk({ kind: "execute-command", target: "npm test" }), "high-risk");
    assert.equal(classifyActionRisk({ kind: "export-secret", target: "provider credentials" }), "critical");
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

    assert.equal(decision.outcome, "risk-notice");
    assert.equal(decision.actionRiskClass, "high-risk");
    assert.equal(decision.approvalRequest, undefined);
    assert.equal(decision.riskNotice?.clientAuthorizationMode, "fully-authorized");
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

    assert.equal(decision.outcome, "deny");
    assert.equal(decision.actionRiskClass, "high-risk");
    assert.equal(decision.approvalDecision?.kind, "unavailable-denied");
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

    assert.equal(decision.requestId, "approval:execute-command:2026-05-28T10:15:00.000Z");
    assert.equal(decision.kind, "timeout-denied");
    assert.equal(decision.decidedAt, "2026-05-28T10:16:00.000Z");
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

    assert.equal(decision.outcome, "allow");
    assert.equal(decision.actionRiskClass, "high-risk");
    assert.equal(decision.trustGrantId, "trust:tests");
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

    assert.equal(safeDecision.outcome, "allow");
    assert.equal(safeDecision.actionRiskClass, "safe");
    assert.equal(sensitiveDecision.outcome, "risk-notice");
    assert.equal(sensitiveDecision.actionRiskClass, "sensitive");
    assert.match(sensitiveDecision.riskNotice?.message ?? "", /~\/.ssh\/config/);
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
    assert.equal(pending.status, "approval-required");
    assert.equal(pending.approvalRequest.actionRiskClass, "high-risk");
    assert.equal(flow.getPendingApproval()?.id, pending.approvalRequest.id);

    const allowed = flow.decideApproval(pending.approvalRequest.id, "allowed", "2026-05-28T10:30:10.000Z");

    assert.equal(allowed.kind, "allowed");
    assert.equal(flow.getPendingApproval(), undefined);
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
    assert.equal(deniedPending.status, "approval-required");
    const denied = deniedFlow.decideApproval(
      deniedPending.approvalRequest.id,
      "denied",
      "2026-05-28T10:35:05.000Z",
    );
    assert.equal(denied.kind, "denied");
    assert.equal(deniedFlow.getPendingApproval(), undefined);

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
    assert.equal(timeoutPending.status, "approval-required");
    const timeout = timeoutFlow.timeoutPendingApproval("2026-05-28T10:37:00.000Z");

    assert.equal(timeout?.kind, "timeout-denied");
    assert.equal(timeout?.requestId, timeoutPending.approvalRequest.id);
    assert.equal(timeoutFlow.getPendingApproval(), undefined);
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
    assert.equal(result.status, "risk-notice");
    assert.equal(result.blocking, false);
    assert.equal(result.riskNotice.clientAuthorizationMode, "fully-authorized");
    assert.equal(flow.getRiskNotices()[0]?.id, result.riskNotice.id);
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

    assert.equal(store.listGrants()[0]?.id, grant.id);
    assert.equal(
      store.findMatchingGrant({
        action: { kind: "execute-command", target: "/workspace/app/scripts/test.sh" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
          providerProfileId: "openai",
        },
        now: "2026-05-28T10:50:00.000Z",
      })?.id,
      grant.id,
    );

    assert.equal(
      store.findMatchingGrant({
        action: { kind: "execute-command", target: "/workspace/other/scripts/test.sh" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/other",
          clientId: "claude-code",
          providerProfileId: "openai",
        },
        now: "2026-05-28T10:50:00.000Z",
      }),
      undefined,
    );
    assert.equal(
      store.findMatchingGrant({
        action: { kind: "execute-command", target: "/workspace/app/scripts/test.sh" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
          providerProfileId: "openai",
        },
        now: "2026-05-28T11:00:00.000Z",
      }),
      undefined,
    );
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

    assert.equal(
      store.findMatchingGrant({
        action: { kind: "export-secret", target: "provider credentials" },
        actionRiskClass: "critical",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
        },
        now: "2026-05-28T10:50:00.000Z",
      }),
      undefined,
    );
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

    assert.equal(revoked?.id, grant.id);
    assert.equal(revoked?.revokedAt, "2026-05-28T10:50:00.000Z");
    assert.equal(
      store.findMatchingGrant({
        action: { kind: "launch-session", target: "claude -r session-1" },
        actionRiskClass: "high-risk",
        scope: {
          projectPath: "/workspace/app",
          clientId: "claude-code",
        },
        now: "2026-05-28T10:55:00.000Z",
      }),
      undefined,
    );
  });
});
