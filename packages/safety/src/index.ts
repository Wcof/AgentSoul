import type {
  ActionRiskClass,
  ApprovalDecision,
  ApprovalDecisionKind,
  ApprovalRequest,
  ClientAuthorizationMode,
  RiskNotice,
} from "@agentsoul/domain";

export type ControlledEntryPoint = "gateway" | "mcp-server" | "client-hook";

export type SafetyActionKind =
  | "chat"
  | "read-status"
  | "read-sensitive-path"
  | "export-config"
  | "write-file"
  | "delete-file"
  | "execute-command"
  | "modify-client-config"
  | "deploy-workspace-rules"
  | "launch-session"
  | "change-provider-profile"
  | "use-credential"
  | "bulk-delete"
  | "overwrite-user-file"
  | "export-secret";

export interface SafetyAction {
  kind: SafetyActionKind;
  target?: string;
}

export type SafetyPolicyOutcome =
  | "allow"
  | "risk-notice"
  | "approval-required"
  | "deny";

export interface SafetyPolicyInput {
  action: SafetyAction;
  controlledEntryPoint?: ControlledEntryPoint;
  clientAuthorizationMode: ClientAuthorizationMode;
  approvalSurfaceAvailable: boolean;
  scope?: SafetyPolicyScope;
  scopedTrustGrants?: ScopedTrustGrant[];
  now: string;
}

export interface SafetyPolicyScope {
  projectPath?: string;
  clientId?: string;
  providerProfileId?: string;
}

export interface ScopedTrustGrant {
  id: string;
  actionKinds: SafetyActionKind[];
  projectPath?: string;
  clientId?: string;
  targetPathPrefix?: string;
  providerProfileId?: string;
  maxRiskClass: Extract<ActionRiskClass, "high-risk" | "critical">;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
}

export interface SafetyPolicyDecision {
  outcome: SafetyPolicyOutcome;
  actionRiskClass: ActionRiskClass;
  approvalRequest?: ApprovalRequest;
  approvalDecision?: ApprovalDecision;
  riskNotice?: RiskNotice;
  trustGrantId?: string;
}

export interface PendingApprovalRequired {
  status: "approval-required";
  approvalRequest: ApprovalRequest;
}

export interface ApprovalFlow {
  requestApproval(input: SafetyPolicyInput): PendingApprovalRequired | SafetyPolicyDecision;
  getPendingApproval(): ApprovalRequest | undefined;
  decideApproval(
    requestId: string,
    kind: Extract<ApprovalDecisionKind, "allowed" | "denied">,
    decidedAt: string,
  ): ApprovalDecision;
  timeoutPendingApproval(decidedAt: string): ApprovalDecision | undefined;
}

export interface RiskNoticeFlowResult {
  status: "risk-notice";
  blocking: false;
  riskNotice: RiskNotice;
}

export interface RiskNoticeFlow {
  observeAction(input: SafetyPolicyInput): RiskNoticeFlowResult | SafetyPolicyDecision;
  getRiskNotices(): RiskNotice[];
}

export interface CreateScopedTrustGrantInput {
  actionKinds: SafetyActionKind[];
  projectPath?: string;
  clientId?: string;
  targetPathPrefix?: string;
  providerProfileId?: string;
  maxRiskClass?: Extract<ActionRiskClass, "high-risk" | "critical">;
  expiresAt: string;
  createdAt: string;
}

export interface ScopedTrustGrantMatchInput {
  action: SafetyAction;
  actionRiskClass: ActionRiskClass;
  scope?: SafetyPolicyScope;
  now: string;
}

export interface ScopedTrustGrantStore {
  createGrant(input: CreateScopedTrustGrantInput): ScopedTrustGrant;
  listGrants(): ScopedTrustGrant[];
  findMatchingGrant(input: ScopedTrustGrantMatchInput): ScopedTrustGrant | undefined;
  revokeGrant(id: string, revokedAt: string): ScopedTrustGrant | undefined;
}

export function createApprovalFlow(): ApprovalFlow {
  let pendingApproval: ApprovalRequest | undefined;

  return {
    requestApproval(input) {
      const decision = decideSafetyPolicy(input);
      if (decision.outcome !== "approval-required" || !decision.approvalRequest) {
        return decision;
      }

      pendingApproval = decision.approvalRequest;
      return {
        status: "approval-required",
        approvalRequest: decision.approvalRequest,
      };
    },
    getPendingApproval() {
      return pendingApproval;
    },
    decideApproval(requestId, kind, decidedAt) {
      const decision = {
        requestId,
        kind,
        decidedAt,
      };

      if (pendingApproval?.id === requestId) {
        pendingApproval = undefined;
      }

      return decision;
    },
    timeoutPendingApproval(decidedAt) {
      if (!pendingApproval) {
        return undefined;
      }

      const decision = resolveApprovalTimeout(pendingApproval, decidedAt);
      pendingApproval = undefined;
      return decision;
    },
  };
}

export function createRiskNoticeFlow(): RiskNoticeFlow {
  const riskNotices: RiskNotice[] = [];

  return {
    observeAction(input) {
      const decision = decideSafetyPolicy(input);
      if (decision.outcome !== "risk-notice" || !decision.riskNotice) {
        return decision;
      }

      riskNotices.push(decision.riskNotice);
      return {
        status: "risk-notice",
        blocking: false,
        riskNotice: decision.riskNotice,
      };
    },
    getRiskNotices() {
      return [...riskNotices];
    },
  };
}

export function createScopedTrustGrantStore(): ScopedTrustGrantStore {
  const grants: ScopedTrustGrant[] = [];

  return {
    createGrant(input) {
      const grant: ScopedTrustGrant = {
        id: `trust:${input.actionKinds.join("+")}:${input.createdAt}`,
        actionKinds: [...input.actionKinds],
        projectPath: input.projectPath,
        clientId: input.clientId,
        targetPathPrefix: input.targetPathPrefix,
        providerProfileId: input.providerProfileId,
        maxRiskClass: input.maxRiskClass ?? "high-risk",
        expiresAt: input.expiresAt,
        createdAt: input.createdAt,
      };
      grants.push(grant);
      return grant;
    },
    listGrants() {
      return [...grants];
    },
    findMatchingGrant(input) {
      return grants.find((grant) => scopedTrustGrantMatches(grant, input));
    },
    revokeGrant(id, revokedAt) {
      const grant = grants.find((candidate) => candidate.id === id);
      if (!grant) {
        return undefined;
      }

      grant.revokedAt = revokedAt;
      return { ...grant };
    },
  };
}

export function decideSafetyPolicy(input: SafetyPolicyInput): SafetyPolicyDecision {
  const actionRiskClass = classifyActionRisk(input.action);

  if (requiresUserDecision(actionRiskClass)) {
    const trustGrant = findValidTrustGrant(input);
    if (trustGrant) {
      return {
        outcome: "allow",
        actionRiskClass,
        trustGrantId: trustGrant.id,
      };
    }

    if (!input.controlledEntryPoint || input.clientAuthorizationMode === "fully-authorized") {
      return {
        outcome: "risk-notice",
        actionRiskClass,
        riskNotice: {
          id: `risk-notice:${input.action.kind}:${input.now}`,
          message: messageForAction(input.action),
          observedAt: input.now,
          clientAuthorizationMode: input.clientAuthorizationMode,
        },
      };
    }

    if (!input.approvalSurfaceAvailable) {
      return {
        outcome: "deny",
        actionRiskClass,
        approvalDecision: {
          requestId: `approval:${input.action.kind}:${input.now}`,
          kind: "unavailable-denied",
          decidedAt: input.now,
        },
      };
    }

    return {
      outcome: "approval-required",
      actionRiskClass,
      approvalRequest: {
        id: `approval:${input.action.kind}:${input.now}`,
        actionRiskClass,
        title: titleForAction(input.action),
        message: messageForAction(input.action),
        createdAt: input.now,
      },
    };
  }

  if (actionRiskClass === "sensitive") {
    return {
      outcome: "risk-notice",
      actionRiskClass,
      riskNotice: {
        id: `risk-notice:${input.action.kind}:${input.now}`,
        message: messageForAction(input.action),
        observedAt: input.now,
        clientAuthorizationMode: input.clientAuthorizationMode,
      },
    };
  }

  return { outcome: "allow", actionRiskClass };
}

export function classifyActionRisk(action: SafetyAction): ActionRiskClass {
  switch (action.kind) {
    case "read-sensitive-path":
    case "export-config":
      return "sensitive";
    case "write-file":
    case "delete-file":
    case "execute-command":
    case "modify-client-config":
    case "deploy-workspace-rules":
    case "launch-session":
    case "change-provider-profile":
    case "use-credential":
      return "high-risk";
    case "bulk-delete":
    case "overwrite-user-file":
    case "export-secret":
      return "critical";
    default:
      return "safe";
  }
}

export function resolveApprovalTimeout(
  request: ApprovalRequest,
  decidedAt: string,
): ApprovalDecision {
  return {
    requestId: request.id,
    kind: "timeout-denied",
    decidedAt,
  };
}

function titleForAction(action: SafetyAction): string {
  switch (action.kind) {
    case "write-file":
      return "Write file";
    default:
      return "High-risk action";
  }
}

function messageForAction(action: SafetyAction): string {
  return action.target
    ? `${titleForAction(action)}: ${action.target}`
    : titleForAction(action);
}

function requiresUserDecision(actionRiskClass: ActionRiskClass): boolean {
  return actionRiskClass === "high-risk" || actionRiskClass === "critical";
}

function findValidTrustGrant(input: SafetyPolicyInput): ScopedTrustGrant | undefined {
  return input.scopedTrustGrants?.find((grant) => {
    return scopedTrustGrantMatches(grant, {
      action: input.action,
      actionRiskClass: classifyActionRisk(input.action),
      scope: input.scope,
      now: input.now,
    });
  });
}

function scopedTrustGrantMatches(
  grant: ScopedTrustGrant,
  input: ScopedTrustGrantMatchInput,
): boolean {
  if (!grant.actionKinds.includes(input.action.kind)) {
    return false;
  }

  if (grant.revokedAt) {
    return false;
  }

  if (input.actionRiskClass === "critical" && grant.maxRiskClass !== "critical") {
    return false;
  }

  if (Date.parse(grant.expiresAt) <= Date.parse(input.now)) {
    return false;
  }

  if (grant.projectPath && grant.projectPath !== input.scope?.projectPath) {
    return false;
  }

  if (grant.clientId && grant.clientId !== input.scope?.clientId) {
    return false;
  }

  if (grant.providerProfileId && grant.providerProfileId !== input.scope?.providerProfileId) {
    return false;
  }

  if (
    grant.targetPathPrefix &&
    (!input.action.target || !input.action.target.startsWith(grant.targetPathPrefix))
  ) {
    return false;
  }

  return true;
}
