import "./styles.css";

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

interface NativeCompanionRuntimeState {
  companion?: Partial<CompanionRuntimeSnapshot["companion"]>;
  providerProfile?: Partial<CompanionRuntimeSnapshot["providerProfile"]>;
  approvalSurface?: {
    approvalRequiredPlaceholder?: string;
    riskNoticePlaceholder?: string;
  };
}

export const defaultCompanionSnapshot: CompanionRuntimeSnapshot = {
  companion: {
    id: "active-companion",
    displayName: "AgentSoul Companion",
    soulId: "default-soul",
    petAppearance: {
      kind: "slime",
      skin: "default",
      animationStyle: "idle",
    },
    mood: "neutral",
    vitals: {
      level: 1,
      xp: 0,
      companionEnergy: 100,
      hunger: 100,
      intimacy: 0,
    },
  },
  providerProfile: {
    id: "default-provider-profile",
    name: "Local Gateway Default",
  },
  gateway: {
    routeHealth: "ready",
    activeProviderName: "Local Gateway Default",
    activationMode: "gateway-route",
    clientProtocol: "openai-chat",
    providerProtocol: "openai-chat",
    targetModel: "gpt-4.1",
    adapterSupport: "supported",
    fallbackStatus: "available",
  },
  costs: {
    estimatedCostUsd: 0.0048,
    inputTokens: 1200,
    outputTokens: 300,
    averageLatencyMs: 842,
    providerMix: [{ provider: "OpenAI", percent: 100 }],
    modelMix: [{ model: "gpt-4.1", percent: 100 }],
  },
  skills: {
    projectPath: "/workspace/app",
    installedSkillPacks: [
      {
        id: "tdd",
        name: "TDD",
        source: "local-directory:/Users/ldh/.agents/skills/tdd",
        installedAt: "2026-05-28T11:10:00.000Z",
      },
    ],
    projectActivations: [
      {
        skillPackId: "tdd",
        enabled: true,
        source: "project",
      },
    ],
    workspaceRuleDeployments: [
      {
        skillPackId: "tdd",
        status: "deployed",
        managedRuleFiles: [
          {
            targetPath: "/workspace/app/CLAUDE.md",
            method: "symlink",
          },
        ],
      },
    ],
  },
  sessions: {
    query: {
      keyword: "gateway",
      projectPath: "/workspace/app",
      source: "claude-code-history-jsonl",
      client: "claude-code",
    },
    workSessions: [
      {
        id: "claude-code-history-jsonl:resumable",
        source: "claude-code-history-jsonl",
        client: "claude-code",
        projectPath: "/workspace/app",
        lastActiveAt: "2026-05-28T12:05:00.000Z",
        evidenceSummary: "Resume gateway implementation.",
        searchable: true,
        resumable: true,
        resumeCommand: "claude -r resumable",
      },
      {
        id: "claude-code-history-jsonl:searchable-only",
        source: "claude-code-history-jsonl",
        client: "claude-code",
        projectPath: "/workspace/app",
        lastActiveAt: "2026-05-28T12:00:00.000Z",
        evidenceSummary: "Searchable Work Session from Session Source.",
        searchable: true,
        resumable: false,
      },
    ],
  },
  safety: {
    clientAuthorizationMode: "normal",
    approvalRequests: [
      {
        id: "approval:launch-session:2026-05-28T12:06:00.000Z",
        title: "Session Launcher",
        message: "Launch resumable Work Session through terminal.",
        actionRiskClass: "high-risk",
        createdAt: "2026-05-28T12:06:00.000Z",
        status: "Approval Required",
      },
      {
        id: "approval:execute-command:2026-05-28T12:00:00.000Z",
        title: "Execute command",
        message: "npm test",
        actionRiskClass: "high-risk",
        createdAt: "2026-05-28T12:00:00.000Z",
        status: "allowed",
      },
    ],
    riskNotices: [
      {
        id: "risk-notice:execute-command:2026-05-28T12:10:00.000Z",
        message: "Fully authorized client executed a command outside an approval gate.",
        observedAt: "2026-05-28T12:10:00.000Z",
        clientAuthorizationMode: "fully-authorized",
      },
    ],
    scopedTrustGrants: [
      {
        id: "trust:launch-session",
        actionKinds: ["launch-session"],
        projectPath: "/workspace/app",
        clientId: "claude-code",
        maxRiskClass: "high-risk",
        expiresAt: "2026-05-28T13:00:00.000Z",
      },
      {
        id: "trust:deploy-workspace-rules:revoked",
        actionKinds: ["deploy-workspace-rules"],
        projectPath: "/workspace/app",
        clientId: "claude-code",
        maxRiskClass: "high-risk",
        expiresAt: "2026-05-28T13:00:00.000Z",
        revokedAt: "2026-05-28T12:30:00.000Z",
      },
    ],
    actionRiskClasses: [
      { actionKind: "chat", riskClass: "safe" },
      { actionKind: "read-sensitive-path", riskClass: "sensitive" },
      { actionKind: "launch-session", riskClass: "high-risk" },
      { actionKind: "export-secret", riskClass: "critical" },
    ],
  },
  settings: {
    localFirstStatus: "enabled",
    cloudLoginRequired: false,
    portableExportStatus: "available",
    sensitiveExportSafetyAction: "export-secret",
    remoteSyncStatus: "out-of-core-scope",
    growthProfile: {
      name: "Default Growth Profile",
      xpMultiplier: 1,
      energyCostMultiplier: 1,
      fatigueThreshold: 20,
      maxXpPerEvent: 50,
      maxEnergyCostPerEvent: 25,
    },
  },
  growthHistory: [
    {
      id: "growth:seed",
      sourceType: "interaction",
      description: "Companion initialized from local runtime data.",
      xpDelta: 0,
      occurredAt: "2026-05-28T00:00:00.000Z",
    },
  ],
};

export function renderCompanionViewModel(
  snapshot: CompanionRuntimeSnapshot,
  lastInteractionStatus?: string,
  pendingApproval?: DesktopApprovalRequest,
  riskNotices: DesktopRiskNotice[] = [],
): CompanionViewModel {
  const { companion } = snapshot;
  const visualState = resolveVisualState(snapshot);
  const outfit = companion.petAppearance.outfit ? ` + ${companion.petAppearance.outfit}` : "";

  return {
    viewModelKind: "Companion appearance view model",
    identity: companion.id,
    name: companion.displayName,
    appearanceLabel: `Pet Appearance: ${companion.petAppearance.kind} / ${companion.petAppearance.skin}${outfit}`,
    visualState,
    providerRouteLabel: `Provider Profile: ${snapshot.providerProfile.name}`,
    lastInteractionStatus,
    pendingApproval,
    riskNotices,
    vitals: [
      { label: "Level", value: String(companion.vitals.level) },
      { label: "XP", value: String(companion.vitals.xp) },
      { label: "Energy", value: `${companion.vitals.companionEnergy}%` },
      { label: "Hunger", value: `${companion.vitals.hunger}%` },
      { label: "Intimacy", value: `${companion.vitals.intimacy}%` },
    ],
    controlCenterCompanionArea: renderControlCenterCompanionAreaViewModel(snapshot),
    controlCenterGatewayArea: renderControlCenterGatewayAreaViewModel(snapshot),
    controlCenterCostsArea: renderControlCenterCostsAreaViewModel(snapshot),
    controlCenterSkillsArea: renderControlCenterSkillsAreaViewModel(snapshot),
    controlCenterSessionsArea: renderControlCenterSessionsAreaViewModel(snapshot),
    controlCenterSafetyArea: renderControlCenterSafetyAreaViewModel(snapshot),
    controlCenterSettingsArea: renderControlCenterSettingsAreaViewModel(snapshot),
  };
}

export function renderAgentSoulShell(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot = defaultCompanionSnapshot,
  lastInteractionStatus?: string,
  pendingApproval?: DesktopApprovalRequest,
  riskNotices: DesktopRiskNotice[] = [],
): void {
  const viewModel = renderCompanionViewModel(
    snapshot,
    lastInteractionStatus,
    pendingApproval,
    riskNotices,
  );

  target.innerHTML = `
    <section class="shell" aria-label="AgentSoul v2 desktop shell" data-state="${viewModel.visualState}">
      <div class="companion-orb companion-orb--${viewModel.visualState}" aria-label="${viewModel.name} ${viewModel.visualState}">
        <span class="companion-face" aria-hidden="true">${faceForState(viewModel.visualState)}</span>
      </div>
      <div class="companion-panel" aria-label="Desktop Companion">
        <p class="eyebrow">AgentSoul v2</p>
        <h1>${escapeHtml(viewModel.name)}</h1>
        <p class="summary">
          Local-first AI Agent Companion for the Desktop Companion and Control Center.
          ${escapeHtml(viewModel.appearanceLabel)}
        </p>
        <dl class="vitals">
          ${viewModel.vitals
            .map(
              (vital) => `
                <div class="vital">
                  <dt>${escapeHtml(vital.label)}</dt>
                  <dd>${escapeHtml(vital.value)}</dd>
                </div>
              `,
            )
            .join("")}
        </dl>
        <div class="interactions" aria-label="Companion interactions">
          <button type="button" data-interaction="feed">Feed</button>
          <button type="button" data-interaction="play">Play</button>
          <button type="button" data-interaction="pet">Pet</button>
          <button type="button" data-interaction="sleep">Sleep</button>
        </div>
        ${renderApprovalRequired(viewModel.pendingApproval)}
        ${renderRiskNotices(viewModel.riskNotices)}
        ${
          viewModel.lastInteractionStatus
            ? `<p class="interaction-status" role="status">${escapeHtml(viewModel.lastInteractionStatus)}</p>`
            : ""
        }
        <p class="route">${escapeHtml(viewModel.providerRouteLabel)}</p>
      </div>
      ${renderControlCenterTaskNavigation()}
      ${renderControlCenterCompanionArea(viewModel.controlCenterCompanionArea)}
      ${renderControlCenterGatewayArea(viewModel.controlCenterGatewayArea)}
      ${renderControlCenterCostsArea(viewModel.controlCenterCostsArea)}
      ${renderControlCenterSkillsArea(viewModel.controlCenterSkillsArea)}
      ${renderControlCenterSessionsArea(viewModel.controlCenterSessionsArea)}
      ${renderControlCenterSafetyArea(viewModel.controlCenterSafetyArea)}
      ${renderControlCenterSettingsArea(viewModel.controlCenterSettingsArea)}
    </section>
  `;
}

export function renderControlCenterTaskNavigation(): string {
  return `
    <nav class="control-center-nav" aria-label="Control Center task navigation">
      <p class="eyebrow">Control Center task navigation</p>
      <p class="control-note">Local-first configuration surface; cloud login not required.</p>
      <div class="control-center-nav-actions">
        <a href="#control-center-companion" data-nav-target="companion">Companion</a>
        <a href="#control-center-gateway" data-nav-target="gateway">Gateway</a>
        <a href="#control-center-skills" data-nav-target="skills">Skills</a>
        <a href="#control-center-sessions" data-nav-target="sessions">Sessions</a>
        <a href="#control-center-costs" data-nav-target="costs">Costs</a>
        <a href="#control-center-safety" data-nav-target="safety">Safety</a>
        <a href="#control-center-settings" data-nav-target="settings">Settings</a>
      </div>
    </nav>
  `;
}

export function renderControlCenterCompanionAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterCompanionAreaViewModel {
  const companionViewModel = {
    areaKind: "Control Center Companion Area" as const,
    name: snapshot.companion.displayName,
    moodLabel: `Mood: ${snapshot.companion.mood}`,
    appearanceLabel: `Pet Appearance: ${snapshot.companion.petAppearance.kind} / ${snapshot.companion.petAppearance.skin}`,
    vitals: [
      { label: "Level", value: String(snapshot.companion.vitals.level) },
      { label: "XP", value: String(snapshot.companion.vitals.xp) },
      { label: "Energy", value: `${snapshot.companion.vitals.companionEnergy}%` },
      { label: "Hunger", value: `${snapshot.companion.vitals.hunger}%` },
      { label: "Intimacy", value: `${snapshot.companion.vitals.intimacy}%` },
    ],
    interactions: [
      { kind: "feed" as const, label: "Feed" },
      { kind: "play" as const, label: "Play" },
      { kind: "pet" as const, label: "Pet" },
      { kind: "sleep" as const, label: "Sleep" },
    ],
    growthHistory: snapshot.growthHistory,
  };

  return companionViewModel;
}

export function renderControlCenterGatewayAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterGatewayAreaViewModel {
  return {
    areaKind: "Control Center Gateway Area",
    ...snapshot.gateway,
  };
}

export function renderControlCenterCostsAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterCostsAreaViewModel {
  const totalTokens = snapshot.costs.inputTokens + snapshot.costs.outputTokens;

  return {
    areaKind: "Control Center Costs Area",
    ...snapshot.costs,
    estimatedCostLabel: `Estimated Cost: $${snapshot.costs.estimatedCostUsd.toFixed(4)}`,
    providerUsageLabel:
      snapshot.costs.providerUsageUsd === undefined
        ? "Provider Usage: not connected"
        : `Provider Usage: $${snapshot.costs.providerUsageUsd.toFixed(4)}`,
    tokenUsageLabel: `Token Usage: ${totalTokens} total (${snapshot.costs.inputTokens} input / ${snapshot.costs.outputTokens} output)`,
    latencyLabel: `Latency: ${snapshot.costs.averageLatencyMs} ms average`,
  };
}

export function renderControlCenterGatewayArea(area: ControlCenterGatewayAreaViewModel): string {
  return `
    <section id="control-center-gateway" class="control-center-area control-center-gateway-area" data-control-area="gateway" aria-label="Control Center Gateway Area">
      <div class="control-area-header">
        <p class="eyebrow">Gateway Area</p>
        <h2>Gateway Route Health</h2>
        <p>Active Provider Profile: ${escapeHtml(area.activeProviderName)}</p>
      </div>
      <dl class="control-vitals">
        <div class="control-vital">
          <dt>Gateway Route Health</dt>
          <dd>${escapeHtml(area.routeHealth)}</dd>
        </div>
        <div class="control-vital">
          <dt>Provider Adapter Support</dt>
          <dd>${escapeHtml(area.adapterSupport)}</dd>
        </div>
        <div class="control-vital">
          <dt>Client Protocol</dt>
          <dd>${escapeHtml(area.clientProtocol)}</dd>
        </div>
        <div class="control-vital">
          <dt>Provider Protocol</dt>
          <dd>${escapeHtml(area.providerProtocol)}</dd>
        </div>
        <div class="control-vital">
          <dt>Target Model</dt>
          <dd>${escapeHtml(area.targetModel)}</dd>
        </div>
      </dl>
      <p class="control-note">Direct Client Config fallback: ${escapeHtml(area.fallbackStatus)}. Gateway Route remains the default for audit, growth, and approval control.</p>
    </section>
  `;
}

export function renderControlCenterCostsArea(area: ControlCenterCostsAreaViewModel): string {
  return `
    <section id="control-center-costs" class="control-center-area control-center-costs-area" data-control-area="costs" aria-label="Control Center Costs Area">
      <div class="control-area-header">
        <p class="eyebrow">Costs Area</p>
        <h2>Estimated Cost</h2>
        <p>${escapeHtml(area.estimatedCostLabel)} · ${escapeHtml(area.providerUsageLabel)}</p>
      </div>
      <dl class="control-vitals">
        <div class="control-vital">
          <dt>Token Usage</dt>
          <dd>${escapeHtml(area.tokenUsageLabel)}</dd>
        </div>
        <div class="control-vital">
          <dt>Latency</dt>
          <dd>${escapeHtml(area.latencyLabel)}</dd>
        </div>
        <div class="control-vital">
          <dt>Provider Mix</dt>
          <dd>${escapeHtml(formatMix(area.providerMix, "provider"))}</dd>
        </div>
        <div class="control-vital">
          <dt>Model Mix</dt>
          <dd>${escapeHtml(formatMix(area.modelMix, "model"))}</dd>
        </div>
      </dl>
      <p class="control-note">Estimated Cost is calculated locally from Audit Records. Provider Usage is a separate provider-reported source when available.</p>
    </section>
  `;
}

export function renderControlCenterSkillsAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterSkillsAreaViewModel {
  return {
    areaKind: "Control Center Skills Area",
    deploymentSafetyAction: "deploy-workspace-rules",
    ...snapshot.skills,
  };
}

export function renderControlCenterSkillsArea(area: ControlCenterSkillsAreaViewModel): string {
  return `
    <section id="control-center-skills" class="control-center-area control-center-skills-area" data-control-area="skills" aria-label="Control Center Skills Area">
      <div class="control-area-header">
        <p class="eyebrow">Skills Area</p>
        <h2>Skill Installation</h2>
        <p>Project Skill Activation for ${escapeHtml(area.projectPath)}</p>
      </div>
      <section class="skills-list" aria-label="Installed Skill Packs">
        ${area.installedSkillPacks
          .map(
            (skill) => `
              <article class="skill-row">
                <h3>${escapeHtml(skill.name)}</h3>
                <p>${escapeHtml(skill.source)} · installed ${escapeHtml(skill.installedAt)}</p>
                <button type="button" data-skill-activation="${escapeHtml(skill.id)}">Toggle Project Skill Activation</button>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="skills-list" aria-label="Project Skill Activation">
        <h3>Project Skill Activation</h3>
        ${area.projectActivations
          .map(
            (activation) => `
              <p>${escapeHtml(activation.skillPackId)}: ${activation.enabled ? "enabled" : "disabled"} via ${escapeHtml(activation.source)}</p>
            `,
          )
          .join("")}
      </section>
      <section class="skills-list" aria-label="Workspace Rule Deployment">
        <h3>Workspace Rule Deployment</h3>
        <p>Safety Policy action: ${escapeHtml(area.deploymentSafetyAction)}</p>
        ${area.workspaceRuleDeployments
          .map(
            (deployment) => `
              <article class="skill-row">
                <p>${escapeHtml(deployment.skillPackId)} deployment: ${escapeHtml(deployment.status)}</p>
                <button type="button" data-safety-action="${area.deploymentSafetyAction}">Deploy Workspace Rules</button>
                ${deployment.managedRuleFiles
                  .map(
                    (file) => `
                      <p>Managed Rule File: ${escapeHtml(file.targetPath)} (${escapeHtml(file.method)})</p>
                    `,
                  )
                  .join("")}
              </article>
            `,
          )
          .join("")}
      </section>
    </section>
  `;
}

export function renderControlCenterSessionsAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterSessionsAreaViewModel {
  return {
    areaKind: "Control Center Sessions Area",
    searchLabel: "Work Session search",
    launcherLabel: "safety-gated Session Launcher",
    launchSafetyAction: "launch-session",
    ...snapshot.sessions,
  };
}

export function renderControlCenterSessionsArea(area: ControlCenterSessionsAreaViewModel): string {
  return `
    <section id="control-center-sessions" class="control-center-area control-center-sessions-area" data-control-area="sessions" aria-label="Control Center Sessions Area">
      <div class="control-area-header">
        <p class="eyebrow">Sessions Area</p>
        <h2>${area.searchLabel}</h2>
        <p>Search Index from Session Source metadata and evidence. ${area.launcherLabel} uses Safety Policy before terminal execution.</p>
      </div>
      <label class="session-search">
        <span>Keyword</span>
        <input type="search" data-session-search="keyword" value="${escapeHtml(area.query.keyword)}" aria-label="Work Session search keyword" />
      </label>
      <div class="session-results" aria-label="Work Sessions">
        ${area.workSessions
          .map((session) => {
            const resume = session.resumable && session.resumeCommand
              ? `<button type="button" data-session-launch="${escapeHtml(session.id)}" data-safety-action="${area.launchSafetyAction}">Resume Session</button>`
              : "";

            return `
              <article class="session-row">
                <h3>${escapeHtml(session.projectPath)}</h3>
                <p>Session Source: ${escapeHtml(session.source)} · ${escapeHtml(session.client)} · ${escapeHtml(session.lastActiveAt)}</p>
                <p>${escapeHtml(session.evidenceSummary)}</p>
                <p>Searchable: ${session.searchable ? "yes" : "no"} · Resumable: ${session.resumable ? "yes" : "no"}</p>
                ${session.resumeCommand ? `<p>Session Resume Command: ${escapeHtml(session.resumeCommand)}</p>` : ""}
                ${resume}
              </article>
            `;
          })
          .join("")}
      </div>
      <p class="control-note">Session Launcher actions use ${escapeHtml(area.launchSafetyAction)} and are available only for resumable Work Sessions.</p>
    </section>
  `;
}

export function renderControlCenterSafetyAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterSafetyAreaViewModel {
  return {
    areaKind: "Control Center Safety Area",
    ...snapshot.safety,
  };
}

export function renderControlCenterSafetyArea(area: ControlCenterSafetyAreaViewModel): string {
  return `
    <section id="control-center-safety" class="control-center-area control-center-safety-area" data-control-area="safety" aria-label="Control Center Safety Area">
      <div class="control-area-header">
        <p class="eyebrow">Safety Area</p>
        <h2>Approval Requests</h2>
        <p>Client Authorization Mode: ${escapeHtml(area.clientAuthorizationMode)}</p>
      </div>
      <section class="safety-list" aria-label="Approval Requests">
        ${area.approvalRequests
          .map(
            (request) => `
              <article class="safety-row">
                <h3>${escapeHtml(request.status)}</h3>
                <p>${escapeHtml(request.title)} · ${escapeHtml(request.actionRiskClass)} · ${escapeHtml(request.createdAt)}</p>
                <p>${escapeHtml(request.message)}</p>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="safety-list" aria-label="Risk Notices">
        <h3>Risk Notices</h3>
        ${area.riskNotices
          .map(
            (notice) => `
              <article class="safety-row">
                <p>${escapeHtml(notice.message)}</p>
                <p>Client Authorization Mode: ${escapeHtml(notice.clientAuthorizationMode)} · ${escapeHtml(notice.observedAt)}</p>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="safety-list" aria-label="Scoped Trust Grants">
        <h3>Scoped Trust Grants</h3>
        ${area.scopedTrustGrants
          .map(
            (grant) => `
              <article class="safety-row">
                <p>${escapeHtml(grant.id)} · ${escapeHtml(grant.actionKinds.join(", "))} · max ${escapeHtml(grant.maxRiskClass)}</p>
                <p>${grant.revokedAt ? `revokedAt: ${escapeHtml(grant.revokedAt)}` : `expires ${escapeHtml(grant.expiresAt)}`}</p>
                <button type="button" data-trust-revoke="${escapeHtml(grant.id)}">Revoke Scoped Trust Grant</button>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="safety-list" aria-label="Action Risk Classes">
        <h3>Action Risk Classes</h3>
        ${area.actionRiskClasses
          .map(
            (riskClass) => `
              <p>${escapeHtml(riskClass.actionKind)}: ${escapeHtml(riskClass.riskClass)}</p>
            `,
          )
          .join("")}
      </section>
    </section>
  `;
}

export function renderControlCenterCompanionArea(
  area: ControlCenterCompanionAreaViewModel,
): string {
  return `
    <section id="control-center-companion" class="control-center-area control-center-companion-area" data-control-area="companion" aria-label="Control Center Companion Area">
      <div class="control-area-header">
        <p class="eyebrow">Control Center</p>
        <h2>Companion Area</h2>
        <p>${escapeHtml(area.moodLabel)} · ${escapeHtml(area.appearanceLabel)}</p>
      </div>
      <dl class="control-vitals">
        ${area.vitals
          .map(
            (vital) => `
              <div class="control-vital">
                <dt>${escapeHtml(vital.label)}</dt>
                <dd>${escapeHtml(vital.value)}</dd>
              </div>
            `,
          )
          .join("")}
      </dl>
      <div class="control-interactions" aria-label="Companion interactions">
        ${area.interactions
          .map(
            (interaction) => `
              <button type="button" data-interaction="${interaction.kind}">${escapeHtml(interaction.label)}</button>
            `,
          )
          .join("")}
      </div>
      <section class="growth-history" aria-label="Growth Events">
        <h3>Growth Events</h3>
        ${area.growthHistory
          .slice(-5)
          .map(
            (event) => `
              <article class="growth-event">
                <p>${escapeHtml(event.description)}</p>
                <span>${escapeHtml(event.sourceType)} · XP ${event.xpDelta >= 0 ? "+" : ""}${event.xpDelta} · ${escapeHtml(event.occurredAt)}</span>
              </article>
            `,
          )
          .join("")}
      </section>
    </section>
  `;
}

export function renderControlCenterSettingsAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterSettingsAreaViewModel {
  return {
    areaKind: "Control Center Settings Area",
    ...snapshot.settings,
  };
}

export function renderControlCenterSettingsArea(area: ControlCenterSettingsAreaViewModel): string {
  return `
    <section id="control-center-settings" class="control-center-area control-center-settings-area" data-control-area="settings" aria-label="Control Center Settings Area">
      <div class="control-area-header">
        <p class="eyebrow">Settings Area</p>
        <h2>Local-first</h2>
        <p>Cloud login not required. Portable Data export: ${escapeHtml(area.portableExportStatus)}.</p>
      </div>
      <dl class="control-vitals">
        <div class="control-vital">
          <dt>Local-first</dt>
          <dd>${escapeHtml(area.localFirstStatus)}</dd>
        </div>
        <div class="control-vital">
          <dt>Cloud login</dt>
          <dd>${area.cloudLoginRequired ? "required" : "not required"}</dd>
        </div>
        <div class="control-vital">
          <dt>Sensitive Export</dt>
          <dd>${escapeHtml(area.sensitiveExportSafetyAction)}</dd>
        </div>
        <div class="control-vital">
          <dt>Remote Sync</dt>
          <dd>${escapeHtml(area.remoteSyncStatus)}</dd>
        </div>
        <div class="control-vital">
          <dt>Growth Profile</dt>
          <dd>${escapeHtml(area.growthProfile.name)}</dd>
        </div>
        <div class="control-vital">
          <dt>XP multiplier</dt>
          <dd>${area.growthProfile.xpMultiplier}</dd>
        </div>
        <div class="control-vital">
          <dt>Energy cost</dt>
          <dd>${area.growthProfile.energyCostMultiplier}</dd>
        </div>
        <div class="control-vital">
          <dt>Fatigue threshold</dt>
          <dd>${area.growthProfile.fatigueThreshold}%</dd>
        </div>
        <div class="control-vital">
          <dt>Growth Cap</dt>
          <dd>XP ${area.growthProfile.maxXpPerEvent} · Energy ${area.growthProfile.maxEnergyCostPerEvent}</dd>
        </div>
      </dl>
      <p class="control-note">User-managed Export keeps backups under the user's control. Sensitive Export requires explicit high-risk confirmation.</p>
    </section>
  `;
}

export function createDesktopCompanionController(
  options: DesktopCompanionControllerOptions,
): DesktopCompanionController {
  let currentSnapshot = options.initialSnapshot ?? defaultCompanionSnapshot;
  let pendingApproval = options.initialPendingApproval;
  const riskNotices = options.initialRiskNotices ?? [];

  const controller: DesktopCompanionController = {
    render(snapshot = currentSnapshot, status) {
      currentSnapshot = snapshot;
      renderAgentSoulShell(options.target, currentSnapshot, status, pendingApproval, riskNotices);
      bindInteractionControls(options.target, controller);
      bindApprovalControls(options.target, controller);
      bindControlCenterNavigation(options.target);
    },
    async performInteraction(kind) {
      try {
        const result = await options.performInteraction(kind);
        const status =
          result.outcome === "blocked-low-energy"
            ? "Play blocked: Companion Energy is too low."
            : `${labelForInteraction(kind)} applied.`;

        controller.render(result.state, status);
      } catch (error) {
        controller.render(currentSnapshot, `Interaction failed: ${errorMessage(error)}`);
      }
    },
    async decideApproval(kind) {
      if (!pendingApproval) {
        controller.render(currentSnapshot, "No pending approval.");
        return;
      }

      const requestId = pendingApproval.id;
      try {
        await options.decideApproval?.(requestId, kind);
        pendingApproval = undefined;
        controller.render(
          currentSnapshot,
          kind === "allowed" ? "Approval allowed." : "Approval denied.",
        );
      } catch (error) {
        controller.render(currentSnapshot, `Approval decision failed: ${errorMessage(error)}`);
      }
    },
  };

  controller.render(currentSnapshot);
  return controller;
}

export async function loadCompanionRuntimeSnapshot(): Promise<CompanionRuntimeSnapshot> {
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    const nativeState = await invoke<NativeCompanionRuntimeState>("get_companion_runtime_state");
    return mergeNativeCompanionRuntimeState(defaultCompanionSnapshot, nativeState);
  } catch {
    return defaultCompanionSnapshot;
  }
}

function mergeNativeCompanionRuntimeState(
  fallback: CompanionRuntimeSnapshot,
  nativeState: NativeCompanionRuntimeState,
): CompanionRuntimeSnapshot {
  return {
    ...fallback,
    companion: {
      ...fallback.companion,
      ...nativeState.companion,
      petAppearance: {
        ...fallback.companion.petAppearance,
        ...nativeState.companion?.petAppearance,
      },
      vitals: {
        ...fallback.companion.vitals,
        ...nativeState.companion?.vitals,
      },
    },
    providerProfile: {
      ...fallback.providerProfile,
      ...nativeState.providerProfile,
    },
  };
}

function bindControlCenterNavigation(target: HTMLElement): void {
  target.querySelectorAll<HTMLAnchorElement>("[data-nav-target]").forEach((link) => {
    link.addEventListener("click", (event) => {
      const area = link.dataset.navTarget;
      const destination = area
        ? target.querySelector<HTMLElement>(`[data-control-area="${area}"]`)
        : undefined;

      if (destination) {
        event.preventDefault();
        destination.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  });
}

function bindInteractionControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "performInteraction">,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-interaction]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.interaction as CompanionInteractionKind;
      void controller.performInteraction(kind);
    });
  });
}

function bindApprovalControls(
  target: HTMLElement,
  controller: Pick<DesktopCompanionController, "decideApproval">,
): void {
  target.querySelectorAll<HTMLButtonElement>("[data-approval-decision]").forEach((button) => {
    button.addEventListener("click", () => {
      const kind = button.dataset.approvalDecision as DesktopApprovalDecisionKind;
      void controller.decideApproval(kind);
    });
  });
}

function renderApprovalRequired(pendingApproval?: DesktopApprovalRequest): string {
  if (!pendingApproval) {
    return "";
  }

  return `
    <section class="approval-required" aria-label="Approval Required">
      <p class="approval-risk">${escapeHtml(pendingApproval.actionRiskClass)}</p>
      <h2>${escapeHtml(pendingApproval.title)}</h2>
      <p>${escapeHtml(pendingApproval.message)}</p>
      <div class="approval-actions">
        <button type="button" data-approval-decision="allowed">Allow</button>
        <button type="button" data-approval-decision="denied">Deny</button>
      </div>
    </section>
  `;
}

function renderRiskNotices(riskNotices: DesktopRiskNotice[]): string {
  if (riskNotices.length === 0) {
    return "";
  }

  return `
    <section class="risk-notices" aria-label="Risk Notice">
      <h2>Risk Notice</h2>
      ${riskNotices
        .slice(-3)
        .map(
          (notice) => `
            <article class="risk-notice">
              <p>${escapeHtml(notice.message)}</p>
              <p class="risk-mode">Client Authorization Mode: ${escapeHtml(notice.clientAuthorizationMode)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

function resolveVisualState(snapshot: CompanionRuntimeSnapshot): CompanionVisualState {
  const { mood, vitals } = snapshot.companion;

  if (mood === "sleeping") {
    return "sleep";
  }

  if (mood === "fatigued" || vitals.companionEnergy < 20) {
    return "fatigue";
  }

  if (mood === "positive") {
    return "positive";
  }

  if (mood === "negative" || vitals.hunger < 20) {
    return "attention";
  }

  return "idle";
}

function faceForState(state: CompanionVisualState): string {
  const faces: Record<CompanionVisualState, string> = {
    idle: "-",
    positive: "^",
    fatigue: ".",
    sleep: "z",
    attention: "!",
  };

  return faces[state];
}

function labelForInteraction(kind: CompanionInteractionKind): string {
  const labels: Record<CompanionInteractionKind, string> = {
    feed: "Feed",
    play: "Play",
    pet: "Pet",
    sleep: "Sleep",
  };

  return labels[kind];
}

function formatMix<T extends "provider" | "model">(
  values: Array<Record<T, string> & { percent: number }>,
  key: T,
): string {
  return values.map((value) => `${value[key]} ${value.percent}%`).join(", ");
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown error";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character];
  });
}

const app = document.querySelector<HTMLElement>("#app");

if (app) {
  void bootstrapDesktopCompanion(app);
}

async function bootstrapDesktopCompanion(app: HTMLElement): Promise<void> {
  const initialSnapshot = await loadCompanionRuntimeSnapshot();
  createDesktopCompanionController({
    target: app,
    initialSnapshot,
    async performInteraction(kind) {
      return {
        outcome: kind === "play" && initialSnapshot.companion.vitals.companionEnergy < 20
          ? "blocked-low-energy"
          : "applied",
        state: initialSnapshot,
      };
    },
  });
}
