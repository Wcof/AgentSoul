export type CompanionVisualState = "idle" | "positive" | "fatigue" | "sleep" | "attention";
export type CompanionInteractionKind = "feed" | "play" | "pet" | "sleep";
export type CompanionInteractionOutcome = "applied" | "blocked-low-energy";
export type DesktopApprovalDecisionKind = "allowed" | "denied";

export interface PetAppearanceSnapshot {
  kind: "slime" | "cat" | "custom";
  skin: string;
  outfit?: string;
  animationStyle?: string;
}

export interface CompanionRuntimeSnapshot {
  companion: {
    id: string;
    displayName: string;
    soulId: string;
    petAppearance: PetAppearanceSnapshot;
    mood: "positive" | "neutral" | "negative" | "fatigued" | "sleeping";
    vitals: {
      level: number;
      xp: number;
      companionEnergy: number;
      hunger: number;
      intimacy: number;
    };
  };
  providerProfile: {
    id: string;
    name: string;
  };
  gateway: GatewayAreaSnapshot;
  costs: CostsAreaSnapshot;
  skills: SkillsAreaSnapshot;
  sessions: SessionsAreaSnapshot;
  safety: SafetyAreaSnapshot;
  settings: SettingsAreaSnapshot;
  growthHistory: GrowthHistoryItem[];
}

export interface CompanionViewModel {
  viewModelKind: "Companion appearance view model";
  identity: string;
  name: string;
  appearanceLabel: string;
  visualState: CompanionVisualState;
  providerRouteLabel: string;
  lastInteractionStatus?: string;
  pendingApproval?: DesktopApprovalRequest;
  riskNotices: DesktopRiskNotice[];
  vitals: Array<{ label: string; value: string }>;
  controlCenterCompanionArea: ControlCenterCompanionAreaViewModel;
  controlCenterGatewayArea: ControlCenterGatewayAreaViewModel;
  controlCenterCostsArea: ControlCenterCostsAreaViewModel;
  controlCenterSkillsArea: ControlCenterSkillsAreaViewModel;
  controlCenterSessionsArea: ControlCenterSessionsAreaViewModel;
  controlCenterSafetyArea: ControlCenterSafetyAreaViewModel;
  controlCenterSettingsArea: ControlCenterSettingsAreaViewModel;
}

export interface GrowthHistoryItem {
  id: string;
  sourceType: "interaction" | "gateway" | "work-session";
  description: string;
  xpDelta: number;
  occurredAt: string;
}

export interface ControlCenterCompanionAreaViewModel {
  areaKind: "Control Center Companion Area";
  name: string;
  moodLabel: string;
  appearanceLabel: string;
  vitals: Array<{ label: string; value: string }>;
  interactions: Array<{ kind: CompanionInteractionKind; label: string }>;
  growthHistory: GrowthHistoryItem[];
}

export interface GatewayAreaSnapshot {
  routeHealth: "ready" | "not-ready" | "unsupported-route";
  activeProviderName: string;
  activationMode: "gateway-route" | "direct-client-config";
  clientProtocol: string;
  providerProtocol: string;
  targetModel: string;
  adapterSupport: "supported" | "unsupported";
  fallbackStatus: "not-needed" | "available" | "active";
}

export interface CostsAreaSnapshot {
  estimatedCostUsd: number;
  providerUsageUsd?: number;
  inputTokens: number;
  outputTokens: number;
  averageLatencyMs: number;
  providerMix: Array<{ provider: string; percent: number }>;
  modelMix: Array<{ model: string; percent: number }>;
}

export interface ControlCenterGatewayAreaViewModel extends GatewayAreaSnapshot {
  areaKind: "Control Center Gateway Area";
}

export interface ControlCenterCostsAreaViewModel extends CostsAreaSnapshot {
  areaKind: "Control Center Costs Area";
  estimatedCostLabel: string;
  providerUsageLabel: string;
  tokenUsageLabel: string;
  latencyLabel: string;
}

export interface SkillsAreaSnapshot {
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

export interface ControlCenterSkillsAreaViewModel extends SkillsAreaSnapshot {
  areaKind: "Control Center Skills Area";
  deploymentSafetyAction: "deploy-workspace-rules";
}

export interface SessionsAreaSnapshot {
  query: {
    keyword: string;
    projectPath?: string;
    source?: string;
    client?: string;
  };
  workSessions: Array<{
    id: string;
    source: string;
    client: string;
    projectPath: string;
    lastActiveAt: string;
    evidenceSummary: string;
    searchable: boolean;
    resumable: boolean;
    resumeCommand?: string;
  }>;
}

export interface ControlCenterSessionsAreaViewModel extends SessionsAreaSnapshot {
  areaKind: "Control Center Sessions Area";
  searchLabel: "Work Session search";
  launcherLabel: "safety-gated Session Launcher";
  launchSafetyAction: "launch-session";
}

export interface SafetyAreaSnapshot {
  clientAuthorizationMode: "normal" | "elevated" | "fully-authorized";
  approvalRequests: Array<DesktopApprovalRequest & { status: "Approval Required" | "allowed" | "denied" | "timeout-denied" }>;
  riskNotices: DesktopRiskNotice[];
  scopedTrustGrants: Array<{
    id: string;
    actionKinds: string[];
    projectPath?: string;
    clientId?: string;
    maxRiskClass: "high-risk" | "critical";
    expiresAt: string;
    revokedAt?: string;
  }>;
  actionRiskClasses: Array<{
    actionKind: string;
    riskClass: "safe" | "sensitive" | "high-risk" | "critical";
  }>;
}

export interface ControlCenterSafetyAreaViewModel extends SafetyAreaSnapshot {
  areaKind: "Control Center Safety Area";
}

export interface SettingsAreaSnapshot {
  localFirstStatus: "enabled";
  cloudLoginRequired: false;
  portableExportStatus: "available";
  sensitiveExportSafetyAction: "export-secret";
  remoteSyncStatus: "out-of-core-scope" | "disabled";
  growthProfile: {
    name: string;
    xpMultiplier: number;
    energyCostMultiplier: number;
    fatigueThreshold: number;
    maxXpPerEvent: number;
    maxEnergyCostPerEvent: number;
  };
}

export interface ControlCenterSettingsAreaViewModel extends SettingsAreaSnapshot {
  areaKind: "Control Center Settings Area";
}

export interface DesktopApprovalRequest {
  id: string;
  title: string;
  message: string;
  actionRiskClass: "safe" | "sensitive" | "high-risk" | "critical";
  createdAt: string;
}

export interface DesktopRiskNotice {
  id: string;
  message: string;
  observedAt: string;
  clientAuthorizationMode: "normal" | "elevated" | "fully-authorized";
}

export interface CompanionInteractionResult {
  outcome: CompanionInteractionOutcome;
  state: CompanionRuntimeSnapshot;
}

export interface DesktopCompanionController {
  render(snapshot?: CompanionRuntimeSnapshot, status?: string): void;
  performInteraction(kind: CompanionInteractionKind): Promise<void>;
  decideApproval(kind: DesktopApprovalDecisionKind): Promise<void>;
}

export interface DesktopCompanionControllerOptions {
  target: HTMLElement;
  initialSnapshot?: CompanionRuntimeSnapshot;
  initialPendingApproval?: DesktopApprovalRequest;
  initialRiskNotices?: DesktopRiskNotice[];
  performInteraction: (kind: CompanionInteractionKind) => Promise<CompanionInteractionResult>;
  decideApproval?: (
    requestId: string,
    kind: DesktopApprovalDecisionKind,
  ) => Promise<{ decidedAt: string }>;
}

export interface NativeCompanionRuntimeState {
  companion?: Partial<CompanionRuntimeSnapshot["companion"]>;
  providerProfile?: Partial<CompanionRuntimeSnapshot["providerProfile"]>;
  approvalSurface?: {
    approvalRequiredPlaceholder?: string;
    riskNoticePlaceholder?: string;
  };
}
