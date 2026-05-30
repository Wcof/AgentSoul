import type {
  CompanionRuntimeSnapshot,
  CompanionViewModel,
  CompanionVisualState,
  ControlCenterCompanionAreaViewModel,
  ControlCenterCostsAreaViewModel,
  ControlCenterGatewayAreaViewModel,
  ControlCenterSafetyAreaViewModel,
  ControlCenterSessionsAreaViewModel,
  ControlCenterSkillsAreaViewModel,
  ControlCenterSettingsAreaViewModel,
  DesktopApprovalRequest,
  DesktopRiskNotice,
  CompanionInteractionKind,
  ChannelListItemViewModel,
  DashboardStatsSnapshot,
  CompanionCustomizationSnapshot,
  PersonaTemplateSnapshot,
  SessionListItemViewModel,
  McpServerViewModel,
  PromptTemplateViewModel,
  AppSettingsSnapshot,
  ChannelLogEntry,
  CapabilityTestJob,
  GlobalStatsSnapshot,
  ConversationDashboardSnapshot,
  ConversationInfo,
  ConversationKind,
  ConversationStatus,
  KeyTrendSnapshot,
  ChartDuration,
  KeyTrendView,
  ModelStatsSnapshot,
  ModelStatsView,
  UpdateInfo,
  AppSwitcherSnapshot,
  AppId,
  UsageFooterSnapshot,
  BackupListSnapshot,
  WebdavSyncSnapshot,
  WebdavSyncStatus,
  DeepLinkImportSnapshot,
  DeepLinkType,
} from "./types";
import i18nInstance from "./i18n";

export function t(key: string, fallback: string): string {
  // @ts-ignore
  const instance = typeof i18nInstance !== "undefined" ? i18nInstance : (typeof globalThis.i18nInstance !== "undefined" ? globalThis.i18nInstance : null);
  if (instance && typeof instance.t === "function") {
    return instance.t(key);
  }
  return fallback;
}

export const defaultCompanionSnapshot: CompanionRuntimeSnapshot = {
  companion: {
    id: "active-companion",
    displayName: "AgentSoul Companion",
    soulId: "default-soul",
    petAppearance: {
      kind: "custom",
      skin: "yuanqi-mianmian",
      animationStyle: "idle",
      assetPackId: "yuanqi-mianmian",
      assetPackPath: "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet",
      displayName: "元气眠眠",
      spritesheetPath: "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet/spritesheet.webp",
      assetPackVersion: "codex-pet-v1",
      assetValidation: {
        level: "warning",
        messages: ["warning: states missing in pet.json, using fallback state map"],
      },
      assetManifest: {
        id: "yuanqi-mianmian",
        displayName: "元气眠眠",
        spritesheetPath: "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet/spritesheet.webp",
        kind: "person",
        version: "codex-pet-v1",
        frame: { width: 256, height: 256, count: 48 },
        fps: 8,
        chromaKey: "#00FF00",
      },
    },
    mood: "neutral",
    vitals: {
      level: 1,
      xp: 0,
      companionEnergy: 100,
      hunger: 100,
      intimacy: 0,
    },
    activityState: "idle",
    healthState: "attention",
    summary: "Local runtime pending",
    availableQuickActions: ["open-control-center", "refresh-runtime", "show-status"],
    lastUpdatedAt: new Date().toISOString(),
  },
  providerProfile: {
    id: "",
    name: "",
  },
  gateway: {
    routeHealth: "not-ready",
    activeProviderName: "",
    activationMode: "gateway-route",
    clientProtocol: "openai-chat",
    providerProtocol: "openai-chat",
    targetModel: "",
    adapterSupport: "supported",
    fallbackStatus: "not-needed",
  },
  costs: {
    estimatedCostUsd: 0,
    inputTokens: 0,
    outputTokens: 0,
    averageLatencyMs: 0,
    providerMix: [],
    modelMix: [],
  },
  skills: {
    projectPath: "",
    installedSkillPacks: [],
    projectActivations: [],
    workspaceRuleDeployments: [],
  },
  sessions: {
    query: { keyword: "" },
    workSessions: [],
  },
  safety: {
    clientAuthorizationMode: "normal",
    approvalRequests: [],
    riskNotices: [],
    scopedTrustGrants: [],
    actionRiskClasses: [],
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
  growthHistory: [],
  channels: [],
  dashboardStats: { totalChannels: 0, activeChannels: 0, totalRequests: 0, totalEstimatedCost: 0, overallSuccessRate: 100, totalInputTokens: 0, totalOutputTokens: 0 },
  keyTrend: {
    dataPoints: [],
    duration: "24h",
    view: "traffic",
    summary: {
      totalRequests: 0,
      avgSuccessRate: 100,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalCacheReadTokens: 0,
      totalCacheCreationTokens: 0,
    },
  },
  modelStats: {
    models: [],
    duration: "24h",
    view: "requests",
    topModels: [],
  },
  appSwitcher: {
    activeApp: "agentsoul",
    visibleApps: {
      claude: false,
      "claude-desktop": false,
      codex: true,
      gemini: false,
      opencode: false,
      openclaw: false,
      hermes: false,
      agentsoul: true,
    },
    appNames: {
      claude: "Claude",
      "claude-desktop": "Claude Desktop",
      codex: "Codex",
      gemini: "Gemini",
      opencode: "OpenCode",
      openclaw: "OpenClaw",
      hermes: "Hermes",
      agentsoul: "AgentSoul",
    },
  },
  usageFooter: {
    providerId: "local",
    providerName: "Local",
    usageEnabled: true,
    isCurrent: true,
    usage: {
      used: 0,
      total: 0,
      unit: "tokens",
      success: true,
      extra: "",
    },
  },
  backupList: {
    backups: [],
    autoBackupEnabled: true,
    autoBackupInterval: 24,
    maxBackups: 50,
    storagePath: "",
  },
  webdavSync: {
    status: "idle",
    isConfigured: false,
    config: {
      serverUrl: "",
      username: "",
      remotePath: "",
      autoSync: false,
      syncInterval: 30,
    },
  },
  deepLinkImport: {
    links: [],
    isImporting: false,
    importProgress: 0,
  },
  companionCustomization: {
    availableKinds: [
      { kind: "slime", label: "Slime", labelZh: "粘液怪" },
      { kind: "cat", label: "Cat", labelZh: "猫咪" },
      { kind: "custom", label: "Custom", labelZh: "自定义" },
    ],
    availableSkins: [
      { skin: "default", label: "Default", labelZh: "默认", kind: "slime" },
      { skin: "tabby", label: "Tabby", labelZh: "斑纹", kind: "cat" },
      { skin: "black", label: "Black", labelZh: "黑色", kind: "cat" },
      { skin: "calico", label: "Calico", labelZh: "三花", kind: "cat" },
      { skin: "night", label: "Night", labelZh: "暗夜", kind: "slime" },
      { skin: "sakura", label: "Sakura", labelZh: "樱花", kind: "slime" },
    ],
    currentKind: "slime", currentSkin: "default", displayName: "AgentSoul Companion",
  },
  personaTemplates: [
    { id: "friendly", name: "Friendly", nameZh: "友好", role: "coding companion", personality: ["warm", "encouraging", "playful"], description: "A warm and friendly coding companion", descriptionZh: "一个温暖友好的编程伙伴" },
    { id: "professional", name: "Professional", nameZh: "专业", role: "technical assistant", personality: ["precise", "reliable", "focused"], description: "A professional and reliable technical assistant", descriptionZh: "一个专业可靠的技术助手" },
    { id: "creative", name: "Creative", nameZh: "创意", role: "creative partner", personality: ["imaginative", "spontaneous", "inspiring"], description: "An imaginative and inspiring creative partner", descriptionZh: "一个富有创造力的灵感伙伴" },
    { id: "minimal", name: "Minimal", nameZh: "极简", role: "silent observer", personality: ["quiet", "attentive", "minimal"], description: "A quiet and attentive silent observer", descriptionZh: "一个安静专注的沉默观察者" },
  ],
  localSessions: [],
  conversationDashboard: {
    conversations: [],
    activeFilter: "",
    searchQuery: "",
    systemStatus: "online",
    overrideCount: 0,
  },
  mcpServers: [],
  prompts: [],
  appSettings: {
    language: "zh", theme: "dark", startupBehavior: "restore", closeBehavior: "minimize",
    checkUpdates: true, terminalDefault: "system", terminalShellPath: "/bin/zsh", terminalFontSize: 14,
    proxyEnabled: false, proxyUrl: "", gatewayAccessKey: "", autoFailover: true, failoverThreshold: 3, circuitBreakerTimeout: 60,
    maxConcurrentSessions: 5, sessionRetentionDays: 30, sessionAutoSave: true,
    mcpAutoStart: true, mcpDefaultTimeout: 30, workspaceDir: "", dataDir: "",
    logDir: "", telemetryEnabled: false, crashReporting: false,
    fontSize: 14, fontFamily: "Inter", accentColor: "#3b82f6", glassOpacity: 95,
    autoBackup: true, autoBackupInterval: 24,
  },
};

export function resolveVisualState(snapshot: CompanionRuntimeSnapshot): CompanionVisualState {
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

export function faceForState(state: CompanionVisualState): string {
  const faces: Record<CompanionVisualState, string> = {
    idle: "-",
    positive: "^",
    fatigue: ".",
    sleep: "z",
    attention: "!",
  };

  return faces[state];
}

export function labelForInteraction(kind: CompanionInteractionKind): string {
  const labels: Record<CompanionInteractionKind, string> = {
    feed: "Feed",
    play: "Play",
    pet: "Pet",
    sleep: "Sleep",
  };

  return labels[kind];
}

export function formatMix<T extends "provider" | "model">(
  values: Array<Record<T, string> & { percent: number }>,
  key: T,
): string {
  return values.map((value) => `${value[key]} ${value.percent}%`).join(", ");
}

export function escapeHtml(value: string): string {
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

// 活动波形图 — 仿照 CCX 的 SVG activity bar chart
function successRateGrade(rate: number): number {
  if (rate >= 99) return 0;
  if (rate >= 95) return 1;
  if (rate >= 90) return 2;
  if (rate >= 80) return 3;
  if (rate >= 70) return 4;
  if (rate >= 50) return 5;
  return 6;
}

const WAVEFORM_GRADIENT_COLORS = [
  "rgb(34, 197, 94)", "rgb(132, 204, 22)", "rgb(250, 204, 21)",
  "rgb(251, 146, 60)", "rgb(249, 115, 22)", "rgb(239, 68, 68)", "rgb(220, 38, 38)",
];

export function renderActivityWaveform(requestCount: number, successRate: number, barCount = 30): string {
  const grade = successRateGrade(successRate);
  const color = WAVEFORM_GRADIENT_COLORS[grade];
  const seed = requestCount % 1000;
  let rects = "";
  for (let i = 0; i < barCount; i++) {
    const pseudoRandom = Math.abs(Math.sin(seed + i * 7.3) * 100) % 100;
    const heightPct = Math.max(5, Math.min(100, pseudoRandom * (requestCount > 0 ? 1 : 0.1)));
    const barWidth = 100 / barCount - 1;
    const x = (100 / barCount) * i;
    const height = heightPct * 0.4;
    rects += '<rect x="' + x.toFixed(1) + '" y="' + (100 - height).toFixed(1) + '" width="' + (barWidth * 0.8).toFixed(1) + '" height="' + height.toFixed(1) + '" fill="' + color + '" opacity="0.4" rx="1" ry="1"/>';
  }
  return '<svg class="activity-waveform" preserveAspectRatio="none" viewBox="0 0 100 100" aria-hidden="true">' + rects + '</svg>';
}


export function renderControlCenterCompanionAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterCompanionAreaViewModel {
  const moodVal = t(`mood.${snapshot.companion.mood}`, snapshot.companion.mood);
  const kindVal = t(`appearance.${snapshot.companion.petAppearance.kind}`, snapshot.companion.petAppearance.kind);
  const skinVal = t(`appearance.${snapshot.companion.petAppearance.skin}`, snapshot.companion.petAppearance.skin);

  const companionViewModel = {
    areaKind: "Control Center Companion Area" as const,
    name: snapshot.companion.displayName,
    moodLabel: `${t("companion.mood", "Mood")}: ${moodVal}`,
    appearanceLabel: `${t("companion.appearance", "Pet Appearance")}: ${kindVal} / ${skinVal}`,
    vitals: [
      { label: t("companion.level", "Level"), value: String(snapshot.companion.vitals.level) },
      { label: t("companion.xp", "XP"), value: String(snapshot.companion.vitals.xp) },
      { label: t("companion.energy", "Energy"), value: `${snapshot.companion.vitals.companionEnergy}%` },
      { label: t("companion.hunger", "Hunger"), value: `${snapshot.companion.vitals.hunger}%` },
      { label: t("companion.intimacy", "Intimacy"), value: `${snapshot.companion.vitals.intimacy}%` },
    ],
    interactions: [
      { kind: "feed" as const, label: t("common.feed", "Feed") },
      { kind: "play" as const, label: t("common.play", "Play") },
      { kind: "pet" as const, label: t("common.pet", "Pet") },
      { kind: "sleep" as const, label: t("common.sleep", "Sleep") },
    ],
    growthHistory: snapshot.growthHistory,
    customization: snapshot.companionCustomization,
  };

  return companionViewModel;
}


// ─── CCX-Inspired Helper Functions ───

function circuitBadge(state: string): string {
  const colors: Record<string, string> = { closed: "var(--accent-green)", open: "var(--accent-red)", half_open: "var(--accent-orange)" };
  return '<span class="circuit-badge" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (colors[state] || "var(--text-muted)") + '"></span>';
}

function statusBadge(status: string): string {
  const colors: Record<string, string> = { active: "var(--accent-green)", suspended: "var(--accent-orange)", disabled: "var(--text-muted)", healthy: "var(--accent-green)", error: "var(--accent-red)" };
  const c = colors[status] || "var(--text-muted)";
  return '<span class="status-badge" style="display:inline-block;padding:2px 8px;border-radius:6px;font-size:0.7rem;font-weight:700;background:' + c + '20;color:' + c + ';border:1px solid ' + c + '40">' + escapeHtml(status) + '</span>';
}

export function renderDashboardStatsBar(stats: DashboardStatsSnapshot): string {
  return `
    <div class="dashboard-stats-bar" aria-label="Dashboard Stats">
      <div class="stat-chip"><span class="stat-value">${stats.totalChannels}</span><span class="stat-label">${t("gateway.channels.total", "Total Channels")}</span></div>
      <div class="stat-chip stat-chip--active"><span class="stat-value">${stats.activeChannels}</span><span class="stat-label">${t("gateway.channels.active", "Active Channels")}</span></div>
      <div class="stat-chip"><span class="stat-value">${stats.totalRequests.toLocaleString()}</span><span class="stat-label">${t("gateway.requests.total", "Total Requests")}</span></div>
      <div class="stat-chip"><span class="stat-value">$${stats.totalEstimatedCost.toFixed(4)}</span><span class="stat-label">${t("costs.estimatedCost", "Estimated Cost")}</span></div>
      <div class="stat-chip"><span class="stat-value">${stats.overallSuccessRate.toFixed(1)}%</span><span class="stat-label">${t("gateway.successRate", "Success Rate")}</span></div>
    </div>
  `;
}

function renderChannelCard(ch: ChannelListItemViewModel, index: number): string {
  const waveform = renderActivityWaveform(ch.requestCount, ch.successRate);
  return `
    <article class="channel-card" role="listitem" data-channel-id="${escapeHtml(ch.id)}">
      ${waveform}
      <div class="channel-card-header">
        <div class="channel-card-title">
          <span class="channel-priority">#${index + 1}</span>
          <h4>${escapeHtml(ch.name)}</h4>
          ${statusBadge(ch.status)}
          ${circuitBadge(ch.circuitState)}
          <span class="channel-api-type">${escapeHtml(ch.apiType)}</span>
        </div>
        <div class="channel-card-actions">
          <button type="button" data-channel-edit="${escapeHtml(ch.id)}" title="${t("gateway.edit", "Edit")}">&#9997;</button>
          <button type="button" data-channel-ping="${escapeHtml(ch.id)}" title="${t("gateway.ping", "Ping")}">&#128225;</button>
          <button type="button" data-channel-delete="${escapeHtml(ch.id)}" title="${t("gateway.delete", "Delete")}">&#128465;</button>
          <button type="button" data-channel-menu="${escapeHtml(ch.id)}" class="channel-menu-btn" title="${t("common.more", "更多")}">&#8943;</button>
        </div>
      </div>
      <div class="channel-card-metrics">
        <div class="metric-item"><span class="metric-label">${t("gateway.requests", "Requests")}</span><span class="metric-value">${ch.requestCount.toLocaleString()}</span></div>
        <div class="metric-item"><span class="metric-label">${t("gateway.successRate", "Success Rate")}</span><span class="metric-value ${ch.successRate < 95 ? "metric-value--warning" : ""}">${ch.successRate.toFixed(1)}%</span></div>
        <div class="metric-item"><span class="metric-label">${t("gateway.latency", "Latency")}</span><span class="metric-value">${ch.averageLatencyMs.toFixed(0)}ms</span></div>
        <div class="metric-item"><span class="metric-label">${t("gateway.tokens", "Tokens")}</span><span class="metric-value">${((ch.totalInputTokens + ch.totalOutputTokens) / 1000).toFixed(1)}k</span></div>
        <div class="metric-item"><span class="metric-label">${t("costs.estimatedCost", "Estimated Cost")}</span><span class="metric-value">$${ch.estimatedCost.toFixed(4)}</span></div>
      </div>
      ${ch.description ? '<p class="channel-card-desc">' + escapeHtml(ch.description) + '</p>' : ""}
      <p class="channel-card-url">${escapeHtml(ch.baseUrl)}</p>
      ${ch.consecutiveFailures > 0 ? '<p class="channel-card-failures">' + t("gateway.consecutiveFailures", "Consecutive Failures") + ': ' + ch.consecutiveFailures + '</p>' : ""}
    </article>
  `;
}

export function renderControlCenterGatewayAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterGatewayAreaViewModel {
  return {
    areaKind: "Control Center Gateway Area",
    channels: snapshot.channels,
    dashboardStats: snapshot.dashboardStats,
    ...snapshot.gateway,
  };
}

export function renderControlCenterCostsAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterCostsAreaViewModel {
  const totalTokens = snapshot.costs.inputTokens + snapshot.costs.outputTokens;

  return {
    areaKind: "Control Center Costs Area",
    channels: snapshot.channels,
    dashboardStats: snapshot.dashboardStats,
    ...snapshot.costs,
    estimatedCostLabel: `${t("costs.estimatedCost", "Estimated Cost")}: $${snapshot.costs.estimatedCostUsd.toFixed(4)}`,
    providerUsageLabel:
      snapshot.costs.providerUsageUsd === undefined
        ? `${t("costs.providerUsage", "Provider Usage")}: ${t("common.notConnected", "not connected")}`
        : `${t("costs.providerUsage", "Provider Usage")}: $${snapshot.costs.providerUsageUsd.toFixed(4)}`,
    tokenUsageLabel: `${t("costs.tokenUsageTitle", "Token Usage")}: ${totalTokens} ${t("costs.total", "total")} (${snapshot.costs.inputTokens} ${t("costs.input", "input")} / ${snapshot.costs.outputTokens} ${t("costs.output", "output")})`,
    latencyLabel: `${t("costs.latencyTitle", "Latency")}: ${snapshot.costs.averageLatencyMs} ms ${t("costs.average", "average")}`,
  };
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

export function renderControlCenterSafetyAreaViewModel(
  snapshot: CompanionRuntimeSnapshot,
): ControlCenterSafetyAreaViewModel {
  return {
    areaKind: "Control Center Safety Area",
    ...snapshot.safety,
  };
}

export function renderControlCenterSettingsAreaViewModel(snapshot: CompanionRuntimeSnapshot): ControlCenterSettingsAreaViewModel {
  return {
    areaKind: "Control Center Settings Area" as const,
    personaTemplates: snapshot.personaTemplates ?? [],
    customization: snapshot.companionCustomization,
    ...snapshot.settings,
  };
}

export function renderCompanionViewModel(
  snapshot: CompanionRuntimeSnapshot,
  lastInteractionStatus?: string,
  pendingApproval?: DesktopApprovalRequest,
  riskNotices: DesktopRiskNotice[] = [],
): CompanionViewModel {
  const { companion } = snapshot;
  const visualState = resolveVisualState(snapshot);
  const outfit = companion.petAppearance.outfit ? ` + ${companion.petAppearance.outfit}` : "";

  const kindVal = t(`appearance.${companion.petAppearance.kind}`, companion.petAppearance.kind);
  const skinVal = t(`appearance.${companion.petAppearance.skin}`, companion.petAppearance.skin);

  return {
    viewModelKind: "Companion appearance view model",
    identity: companion.id,
    name: companion.displayName,
    appearanceLabel: `${t("companion.appearance", "Pet Appearance")}: ${kindVal} / ${skinVal}${outfit}`,
    visualState,
    providerRouteLabel: `${t("gateway.activeProvider", "Active Provider Profile")}: ${snapshot.providerProfile.name}`,
    lastInteractionStatus,
    pendingApproval,
    riskNotices,
    vitals: [
      { label: t("companion.level", "Level"), value: String(companion.vitals.level) },
      { label: t("companion.xp", "XP"), value: String(companion.vitals.xp) },
      { label: t("companion.energy", "Energy"), value: `${companion.vitals.companionEnergy}%` },
      { label: t("companion.hunger", "Hunger"), value: `${companion.vitals.hunger}%` },
      { label: t("companion.intimacy", "Intimacy"), value: `${companion.vitals.intimacy}%` },
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

export function renderApprovalRequired(pendingApproval?: DesktopApprovalRequest): string {
  if (!pendingApproval) {
    return "";
  }

  return `
    <section class="approval-required" aria-label="Approval Required">
      <p class="approval-risk">${escapeHtml(t("safety.riskClass." + pendingApproval.actionRiskClass, pendingApproval.actionRiskClass))}</p>
      <h2>${escapeHtml(pendingApproval.title)}</h2>
      <p>${escapeHtml(pendingApproval.message)}</p>
      <div class="approval-actions">
        <button type="button" data-approval-decision="allowed">${t("common.approve", "Allow")}</button>
        <button type="button" data-approval-decision="denied">${t("common.deny", "Deny")}</button>
      </div>
    </section>
  `;
}

export function renderRiskNotices(riskNotices: DesktopRiskNotice[]): string {
  if (riskNotices.length === 0) {
    return "";
  }

  return `
    <section class="risk-notices" aria-label="Risk Notice">
      <h2>${t("safety.riskNotices", "Risk Notice")}</h2>
      ${riskNotices
        .slice(-3)
        .map(
          (notice) => `
            <article class="risk-notice">
              <p>${escapeHtml(notice.message)}</p>
              <p class="risk-mode">${t("safety.clientAuthorizationMode", "Client Authorization Mode")}: ${escapeHtml(notice.clientAuthorizationMode)}</p>
            </article>
          `,
        )
        .join("")}
    </section>
  `;
}

export function renderControlCenterTaskNavigation(): string {
  return `
    <nav class="control-center-nav" aria-label="Control Center task navigation">
      <p class="eyebrow">${t("nav.title", "Control Center task navigation")}</p>
      <p class="control-note">${t("nav.note", "Local-first configuration surface; cloud login not required.")}</p>
      <div class="control-center-nav-actions">
        <a href="#control-center-companion" data-nav-target="companion">${t("nav.companion", "Companion")}</a>
        <a href="#control-center-gateway" data-nav-target="gateway">${t("nav.gateway", "Gateway")}</a>
        <a href="#control-center-skills" data-nav-target="skills">${t("nav.skills", "Skills")}</a>
        <a href="#control-center-sessions" data-nav-target="sessions">${t("nav.sessions", "Sessions")}</a>
        <a href="#control-center-conversations" data-nav-target="conversations">${t("nav.conversations", "Conversations")}</a>
        <a href="#control-center-costs" data-nav-target="costs">${t("nav.costs", "Costs")}</a>
        <a href="#control-center-safety" data-nav-target="safety">${t("nav.safety", "Safety")}</a>
        <a href="#control-center-settings" data-nav-target="settings">${t("nav.settings", "Settings")}</a>
        <a href="#control-center-settings-full" data-nav-target="settings-full">${t("nav.settingsFull", "Full Settings")}</a>
        <a href="#control-center-sessions-mgr" data-nav-target="sessions-mgr">${t("nav.sessionsMgr", "Sessions")}</a>
        <a href="#control-center-mcp" data-nav-target="mcp">${t("nav.mcp", "MCP")}</a>
        <a href="#control-center-prompts" data-nav-target="prompts">${t("nav.prompts", "Prompts")}</a>
      </div>
    </nav>
  `;
}

export function renderControlCenterCompanionArea(
  area: ControlCenterCompanionAreaViewModel,
): string {
  const cust = area.customization;
  return `
    <section id="control-center-companion" class="control-center-area control-center-companion-area" data-control-area="companion" aria-label="Control Center Companion Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("common.controlCenter", "Control Center")}</p>
        <h2>${t("companion.title", "Companion Area")}</h2>
        <p>${escapeHtml(area.moodLabel)} . ${escapeHtml(area.appearanceLabel)}</p>
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

      <div class="companion-customization" aria-label="Companion Customization">
        <h3>${t("companion.appearance", "Appearance")}</h3>
        <div class="customization-form">
          <div class="form-group">
            <label class="modal-label" for="companion-display-name">${t("companion.displayName", "Display Name")}</label>
            <input type="text" id="companion-display-name" class="modal-input" data-companion-field="displayName" value="${escapeHtml(cust.displayName)}" />
          </div>
          <div class="form-group">
            <label class="modal-label">${t("companion.kind", "Appearance Kind")}</label>
            <select class="modal-select" data-companion-field="kind">
              ${cust.availableKinds.map((k) => '<option value="' + k.kind + '"' + (k.kind === cust.currentKind ? " selected" : "") + '>' + escapeHtml(k.labelZh) + ' / ' + escapeHtml(k.label) + '</option>').join("")}
            </select>
          </div>
          <div class="form-group">
            <label class="modal-label">${t("companion.skin", "Skin")}</label>
            <div class="skin-preview">
              ${cust.availableSkins.filter((s) => s.kind === cust.currentKind).map((s) => '<button type="button" class="skin-option' + (s.skin === cust.currentSkin ? " skin-option--active" : "") + '" data-skin-select="' + s.skin + '">' + escapeHtml(s.labelZh) + '</button>').join("")}
            </div>
          </div>
        </div>
      </div>

      <section class="growth-history" aria-label="Growth Events">
        <h3>${t("companion.growthHistory", "Growth Events")}</h3>
        ${area.growthHistory
          .slice(-5)
          .map(
            (event) => `
              <article class="growth-event">
                <p>${escapeHtml(event.description)}</p>
                <span>${escapeHtml(t("companion.sourceType." + event.sourceType, event.sourceType))} . XP ${event.xpDelta >= 0 ? "+" : ""}${event.xpDelta} . ${escapeHtml(event.occurredAt)}</span>
              </article>
            `,
          )
          .join("")}
      </section>
    </section>
  `;
}


// ─── CCX-Inspired Helper Functions ───

export function renderControlCenterGatewayArea(area: ControlCenterGatewayAreaViewModel): string {
  const channels = area.channels ?? [];
  return `
    <section id="control-center-gateway" class="control-center-area control-center-gateway-area" data-control-area="gateway" aria-label="Control Center Gateway Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("gateway.title", "Gateway Area")}</p>
        <h2>${t("gateway.routingHealth", "Gateway Route Health")}</h2>
        <p>${t("gateway.activeProvider", "Active Provider Profile")}: ${escapeHtml(area.activeProviderName)}</p>
      </div>

      <dl class="control-vitals">
        <div class="control-vital">
          <dt>${t("gateway.routingHealth", "Gateway Route Health")}</dt>
          <dd>${escapeHtml(t("gateway.state." + area.routeHealth, area.routeHealth))}</dd>
        </div>
        <div class="control-vital">
          <dt>${t("gateway.adapterStatus", "Provider Adapter Support")}</dt>
          <dd>${escapeHtml(t("gateway.state." + area.adapterSupport, area.adapterSupport))}</dd>
        </div>
        <div class="control-vital">
          <dt>${t("gateway.clientProtocol", "Client Protocol")}</dt>
          <dd>${escapeHtml(area.clientProtocol)}</dd>
        </div>
        <div class="control-vital">
          <dt>${t("gateway.providerProtocol", "Provider Protocol")}</dt>
          <dd>${escapeHtml(area.providerProtocol)}</dd>
        </div>
        <div class="control-vital">
          <dt>${t("gateway.targetModel", "Target Model")}</dt>
          <dd>${escapeHtml(area.targetModel)}</dd>
        </div>
      </dl>
      <p class="control-note">${t("gateway.directFallback", "Direct Client Config fallback")}: ${escapeHtml(t("gateway.state." + area.fallbackStatus, area.fallbackStatus))}. ${t("gateway.note", "Gateway Route remains the default for audit, growth, and approval control.")}</p>

      <div class="channel-orchestration" aria-label="Channel Orchestration">
        <div class="channel-orchestration-header">
          <h3>${t("gateway.failoverSequence", "Failover Sequence")}</h3>
          <div class="channel-orchestration-actions">
            <button type="button" data-channel-action="add" class="channel-action-btn">${t("gateway.addChannel", "Add Channel")}</button>
            <button type="button" data-channel-action="ping-all" class="channel-action-btn channel-action-btn--ghost">${t("gateway.pingAll", "Ping All")}</button>
          </div>
        </div>
        ${channels.length > 0 ? `
          <div class="channel-list" role="list" aria-label="Channel List">
            ${channels.map((ch, index) => renderChannelCard(ch, index)).join("")}
          </div>
        ` : `
          <div class="empty-state">
            <p>${t("gateway.noChannels", "No channels configured")}</p>
            <button type="button" data-channel-action="add" class="channel-action-btn">${t("gateway.addChannel", "Add Channel")}</button>
          </div>
        `}
      </div>
    </section>
  `;
}

export function renderControlCenterCostsArea(area: ControlCenterCostsAreaViewModel): string {
  const channels = area.channels ?? [];
  return `
    <section id="control-center-costs" class="control-center-area control-center-costs-area" data-control-area="costs" aria-label="Control Center Costs Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("costs.title", "Costs Area")}</p>
        <h2>${t("costs.breakdown", "Cost Breakdown")}</h2>
        <p>${escapeHtml(area.estimatedCostLabel)} . ${escapeHtml(area.providerUsageLabel)}</p>
      </div>

      ${renderDashboardStatsBar(area.dashboardStats)}

      <dl class="control-vitals">
        <div class="control-vital"><dt>${t("costs.tokenUsageTitle", "Token Usage")}</dt><dd>${escapeHtml(area.tokenUsageLabel)}</dd></div>
        <div class="control-vital"><dt>${t("costs.latencyTitle", "Latency")}</dt><dd>${escapeHtml(area.latencyLabel)}</dd></div>
        <div class="control-vital"><dt>${t("costs.providerMix", "Provider Mix")}</dt><dd>${escapeHtml(formatMix(area.providerMix, "provider"))}</dd></div>
        <div class="control-vital"><dt>${t("costs.modelMix", "Model Mix")}</dt><dd>${escapeHtml(formatMix(area.modelMix, "model"))}</dd></div>
      </dl>

      ${channels.length > 0 ? `
        <div class="cost-breakdown" aria-label="Per-channel Cost Breakdown">
          <h3>${t("costs.perChannel", "Per-Channel Costs")}</h3>
          <div class="cost-table">
            <div class="cost-table-header">
              <span>${t("gateway.channel", "Channel")}</span>
              <span>${t("gateway.requests", "Requests")}</span>
              <span>${t("gateway.successRate", "Success Rate")}</span>
              <span>${t("costs.tokenUsageTitle", "Token")}</span>
              <span>${t("costs.estimatedCost", "Estimated Cost")}</span>
            </div>
            ${channels.map((ch) => `
              <div class="cost-table-row">
                <span class="cost-channel-name">${escapeHtml(ch.name)} ${statusBadge(ch.status)}</span>
                <span>${ch.requestCount.toLocaleString()}</span>
                <span class="${ch.successRate < 95 ? "metric-value--warning" : ""}">${ch.successRate.toFixed(1)}%</span>
                <span>${((ch.totalInputTokens + ch.totalOutputTokens) / 1000).toFixed(1)}k</span>
                <span class="cost-value">$${ch.estimatedCost.toFixed(4)}</span>
              </div>
            `).join("")}
          </div>
        </div>
      ` : ""}

      <p class="control-note">${t("costs.note", "Estimated Cost is calculated locally from Audit Records.")}</p>
    </section>
  `;
}

export function renderControlCenterSkillsArea(area: ControlCenterSkillsAreaViewModel): string {
  return `
    <section id="control-center-skills" class="control-center-area control-center-skills-area" data-control-area="skills" aria-label="Control Center Skills Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("skills.title", "Skills Area")}</p>
        <h2>${t("skills.installed", "Skill Installation")}</h2>
        <p>${t("skills.projectActivationFor", "Project Skill Activation for")} ${escapeHtml(area.projectPath)}</p>
      </div>
      <section class="skills-list" aria-label="Installed Skill Packs">
        ${area.installedSkillPacks
          .map(
            (skill) => `
              <article class="skill-row">
                <h3>${escapeHtml(skill.name)}</h3>
                <p>${escapeHtml(skill.source)} · ${t("skills.installedLabel", "installed")} ${escapeHtml(skill.installedAt)}</p>
                <button type="button" data-skill-activation="${escapeHtml(skill.id)}">${t("skills.toggleActivation", "Toggle Project Skill Activation")}</button>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="skills-list" aria-label="Project Skill Activation">
        <h3>${t("skills.projectActivation", "Project Skill Activation")}</h3>
        ${area.projectActivations
          .map(
            (activation) => `
              <p>${escapeHtml(activation.skillPackId)}: ${activation.enabled ? t("common.enabled", "enabled") : t("common.disabled", "disabled")} ${t("skills.via", "via")} ${escapeHtml(t("skills.source." + activation.source, activation.source))}</p>
            `,
          )
          .join("")}
      </section>
      <section class="skills-list" aria-label="Workspace Rule Deployment">
        <h3>${t("skills.ruleDeployment", "Workspace Rule Deployment")}</h3>
        <p>${t("skills.safetyPolicyState", "Safety Policy state")}: ${escapeHtml(area.deploymentSafetyAction)}</p>
        ${area.workspaceRuleDeployments
          .map(
            (deployment) => `
              <article class="skill-row">
                <p>${escapeHtml(deployment.skillPackId)} ${t("skills.deployment", "deployment")}: ${escapeHtml(t("skills.status." + deployment.status, deployment.status))}</p>
                <button type="button" data-safety-action="${area.deploymentSafetyAction}">${t("skills.deployRules", "Deploy Workspace Rules")}</button>
                ${deployment.managedRuleFiles
                  .map(
                    (file) => `
                      <p>${t("skills.managedFile", "Managed Rule File")}: ${escapeHtml(file.targetPath)} (${escapeHtml(t("skills.method." + file.method, file.method))})</p>
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

export function renderControlCenterSessionsArea(area: ControlCenterSessionsAreaViewModel): string {
  return `
    <section id="control-center-sessions" class="control-center-area control-center-sessions-area" data-control-area="sessions" aria-label="Control Center Sessions Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("sessions.title", "Sessions Area")}</p>
        <h2>${t("sessions.searchLabel", area.searchLabel)}</h2>
        <p>${t("sessions.searchDesc", "Search Index from Session Source metadata and evidence.")} ${t("sessions.launcherLabel", area.launcherLabel)} ${t("sessions.safetyPolicyNote", "uses Safety Policy before terminal execution.")}</p>
      </div>
      <label class="session-search">
        <span>${t("sessions.keyword", "Keyword")}</span>
        <input type="search" data-session-search="keyword" value="${escapeHtml(area.query.keyword)}" aria-label="Work Session search keyword" />
      </label>
      <div class="session-results" aria-label="Work Sessions">
        ${area.workSessions
          .map((session) => {
            const resume = session.resumable && session.resumeCommand
              ? `<button type="button" data-session-launch="${escapeHtml(session.id)}" data-safety-action="${area.launchSafetyAction}">${t("sessions.resume", "Resume Session")}</button>`
              : "";

            return `
              <article class="session-row">
                <h3>${escapeHtml(session.projectPath)}</h3>
                <p>${t("sessions.source", "Session Source")}: ${escapeHtml(session.source)} · ${escapeHtml(session.client)} · ${escapeHtml(session.lastActiveAt)}</p>
                <p>${escapeHtml(session.evidenceSummary)}</p>
                <p>${t("sessions.searchable", "Searchable")}: ${session.searchable ? t("common.yes", "yes") : t("common.no", "no")} · ${t("sessions.resumable", "Resumable")}: ${session.resumable ? t("common.yes", "yes") : t("common.no", "no")}</p>
                ${session.resumeCommand ? `<p>${t("sessions.resumeCommand", "Session Resume Command")}: ${escapeHtml(session.resumeCommand)}</p>` : ""}
                ${resume}
              </article>
            `;
          })
          .join("")}
      </div>
      <p class="control-note">${t("sessions.launcherNote", "Session Launcher actions use")} ${escapeHtml(area.launchSafetyAction)} ${t("sessions.launcherNoteSuffix", "and are available only for resumable Work Sessions.")}</p>
    </section>
  `;
}

export function renderControlCenterSafetyArea(area: ControlCenterSafetyAreaViewModel): string {
  return `
    <section id="control-center-safety" class="control-center-area control-center-safety-area" data-control-area="safety" aria-label="Control Center Safety Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("safety.title", "Safety Area")}</p>
        <h2>${t("safety.approvalHistory", "Approval Requests")}</h2>
        <p>${t("safety.clientAuthorizationMode", "Client Authorization Mode")}: ${escapeHtml(t("safety.authMode." + area.clientAuthorizationMode, area.clientAuthorizationMode))}</p>
      </div>
      <section class="safety-list" aria-label="Approval Requests">
        ${area.approvalRequests
          .map(
            (request) => `
              <article class="safety-row">
                <h3>${escapeHtml(request.status)}</h3>
                <p>${escapeHtml(request.title)} · ${escapeHtml(t("safety.riskClass." + request.actionRiskClass, request.actionRiskClass))} · ${escapeHtml(request.createdAt)}</p>
                <p>${escapeHtml(request.message)}</p>
                ${request.status === "Approval Required"
                  ? `<div class="approval-actions">
                      <button type="button" data-approval-action="allow" data-approval-id="${escapeHtml(request.id)}">${t("common.approve", "Allow")}</button>
                      <button type="button" data-approval-action="deny" data-approval-id="${escapeHtml(request.id)}">${t("common.deny", "Deny")}</button>
                    </div>`
                  : ""}
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="safety-list" aria-label="Risk Notices">
        <h3>${t("safety.riskNotices", "Risk Notices")}</h3>
        ${area.riskNotices
          .map(
            (notice) => `
              <article class="safety-row">
                <p>${escapeHtml(notice.message)}</p>
                <p>${t("safety.clientAuthorizationMode", "Client Authorization Mode")}: ${escapeHtml(t("safety.authMode." + notice.clientAuthorizationMode, notice.clientAuthorizationMode))} · ${escapeHtml(notice.observedAt)}</p>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="safety-list" aria-label="Scoped Trust Grants">
        <h3>${t("safety.trustGrants", "Scoped Trust Grants")}</h3>
        ${area.scopedTrustGrants
          .map(
            (grant) => `
              <article class="safety-row">
                <p>${escapeHtml(grant.id)} · ${escapeHtml(grant.actionKinds.join(", "))} · max ${escapeHtml(t("safety.riskClass." + grant.maxRiskClass, grant.maxRiskClass))}</p>
                <p>${grant.revokedAt ? `${t("safety.action.revokedAt", "revokedAt")}: ${escapeHtml(grant.revokedAt)}` : `${t("safety.action.expires", "expires")} ${escapeHtml(grant.expiresAt)}`}</p>
                <button type="button" data-trust-revoke="${escapeHtml(grant.id)}">${t("safety.revokeGrant", "Revoke Scoped Trust Grant")}</button>
              </article>
            `,
          )
          .join("")}
      </section>
      <section class="safety-list" aria-label="Action Risk Classes">
        <h3>${t("safety.actionRiskClasses", "Action Risk Classes")}</h3>
        ${area.actionRiskClasses
          .map(
            (riskClass) => `
              <p>${escapeHtml(riskClass.actionKind)}: ${escapeHtml(t("safety.riskClass." + riskClass.riskClass, riskClass.riskClass))}</p>
            `,
          )
          .join("")}
      </section>
    </section>
  `;
}

export function renderControlCenterSettingsArea(area: ControlCenterSettingsAreaViewModel): string {
  const cust = area.customization;
  const templates = area.personaTemplates ?? [];
  return `
    <section id="control-center-settings" class="control-center-area control-center-settings-area" data-control-area="settings" aria-label="Control Center Settings Area">
      <div class="control-area-header">
        <p class="eyebrow">${t("settings.title", "Settings Area")}</p>
        <h2>${t("settings.localFirst", "Local-first")}</h2>
        <p>${t("settings.cloudLoginNotRequired", "Cloud login not required.")}</p>
      </div>

      <div class="settings-section" aria-label="Persona Templates">
        <h3>${t("settings.persona", "Persona Configuration")}</h3>
        <div class="persona-grid">
          ${templates.map((tpl) => `
            <article class="persona-card" data-persona-select="${escapeHtml(tpl.id)}">
              <h4>${escapeHtml(tpl.nameZh)} / ${escapeHtml(tpl.name)}</h4>
              <p class="persona-role">${escapeHtml(tpl.role)}</p>
              <p class="persona-desc">${escapeHtml(tpl.descriptionZh)}</p>
              <div class="persona-traits">${tpl.personality.map((p) => '<span class="trait-tag">' + escapeHtml(p) + '</span>').join("")}</div>
            </article>
          `).join("")}
        </div>
      </div>

      <div class="settings-section" aria-label="Locale">
        <h3>${t("settings.locale", "Language")}</h3>
        <div class="locale-switcher-inline">
          <button type="button" data-locale="zh" class="locale-btn locale-btn--active">中文</button>
          <button type="button" data-locale="en" class="locale-btn">English</button>
        </div>
      </div>

      <dl class="control-vitals">
        <div class="control-vital"><dt>${t("settings.localFirst", "Local-first")}</dt><dd>${escapeHtml(t("common." + area.localFirstStatus, area.localFirstStatus))}</dd></div>
        <div class="control-vital"><dt>${t("settings.cloudLogin", "Cloud login")}</dt><dd>${area.cloudLoginRequired ? t("settings.required", "required") : t("settings.notRequired", "not required")}</dd></div>
        <div class="control-vital"><dt>${t("settings.sensitiveExport", "Sensitive Export")}</dt><dd>${escapeHtml(t("settings.safetyAction." + area.sensitiveExportSafetyAction, area.sensitiveExportSafetyAction))}</dd></div>
        <div class="control-vital"><dt>${t("settings.remoteSync", "Remote Sync")}</dt><dd>${escapeHtml(t("settings.remoteSyncStatus." + area.remoteSyncStatus, area.remoteSyncStatus))}</dd></div>
        <div class="control-vital"><dt>${t("settings.growthProfile", "Growth Profile")}</dt><dd>${escapeHtml(area.growthProfile.name)}</dd></div>
        <div class="control-vital"><dt>${t("settings.xpMultiplier", "XP multiplier")}</dt><dd>${area.growthProfile.xpMultiplier}</dd></div>
        <div class="control-vital"><dt>${t("settings.energyCost", "Energy cost")}</dt><dd>${area.growthProfile.energyCostMultiplier}</dd></div>
        <div class="control-vital"><dt>${t("settings.fatigueThreshold", "Fatigue threshold")}</dt><dd>${area.growthProfile.fatigueThreshold}%</dd></div>
        <div class="control-vital"><dt>${t("settings.growthCap", "Growth Cap")}</dt><dd>XP ${area.growthProfile.maxXpPerEvent} . Energy ${area.growthProfile.maxEnergyCostPerEvent}</dd></div>
      </dl>
      <p class="control-note">${t("settings.note", "User-managed Export keeps backups under the user's control. Sensitive Export requires explicit high-risk confirmation.")}</p>
    </section>
  `;
}


// ═══════════════════════════════════════════════════════════════════════
// cc-switch 功能渲染器 — Session 管理、MCP、Prompt
// ═══════════════════════════════════════════════════════════════════════

function sessionProviderBadge(provider: string): string {
  const labels: Record<string, string> = { "claude-code": "Claude Code", codex: "Codex", "gemini-cli": "Gemini CLI", agentsoul: "AgentSoul" };
  return '<span class="provider-badge">' + escapeHtml(labels[provider] || provider) + '</span>';
}

export function renderSessionManagerArea(sessions: SessionListItemViewModel[]): string {
  return `
    <section id="control-center-sessions-mgr" class="control-center-area" data-control-area="sessions-mgr" aria-label="Session Manager">
      <div class="control-area-header">
        <p class="eyebrow">${t("sessions.mgrTitle", "Session Manager")}</p>
        <h2>${t("sessions.mgrSubtitle", "Browse & Resume Local Sessions")}</h2>
      </div>
      <label class="session-search">
        <span>${t("sessions.keyword", "Keyword")}</span>
        <input type="search" data-session-mgr-search placeholder="${t("sessions.searchPlaceholder", "Search sessions...")}" />
      </label>
      <div class="session-list" role="list">
        ${sessions.length === 0 ? `<div class="empty-state"><p>${t("sessions.noSessions", "No sessions found")}</p></div>` : ''}
        ${sessions.map((s) => `
          <article class="session-card" role="listitem" data-session-id="${escapeHtml(s.id)}">
            <div class="session-card-header">
              ${sessionProviderBadge(s.provider)}
              <h4>${escapeHtml(s.projectDir)}</h4>
              <span class="session-time">${escapeHtml(s.lastActiveAt)}</span>
            </div>
            ${s.summary ? '<p class="session-summary">' + escapeHtml(s.summary) + '</p>' : ''}
            <div class="session-card-footer">
              <span class="session-msg-count">${s.messageCount} ${t("sessions.messages", "messages")}</span>
              ${s.isResumable ? '<button type="button" data-session-launch="' + escapeHtml(s.id) + '" class="channel-action-btn channel-action-btn--ghost">' + t("sessions.resume", "Resume") + '</button>' : '<span class="session-not-resumable">' + t("sessions.notResumable", "Not resumable") + '</span>'}
              <button type="button" data-session-delete="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost" style="color:var(--accent-red)">&#128465;</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderControlCenterMcpArea(mcpServers: McpServerViewModel[]): string {
  return `
    <section id="control-center-mcp" class="control-center-area" data-control-area="mcp" aria-label="MCP Server Management">
      <div class="control-area-header">
        <p class="eyebrow">${t("mcp.title", "MCP Servers")}</p>
        <h2>${t("mcp.subtitle", "Model Context Protocol Servers")}</h2>
        <div class="channel-orchestration-actions">
          <button type="button" data-mcp-add class="channel-action-btn">${t("mcp.addServer", "Add MCP Server")}</button>
        </div>
      </div>
      <div class="mcp-list" role="list">
        ${mcpServers.length === 0 ? `<div class="empty-state"><p>${t("mcp.noServers", "No MCP servers configured")}</p></div>` : ''}
        ${mcpServers.map((s) => `
          <article class="mcp-card" role="listitem" data-mcp-id="${escapeHtml(s.id)}">
            <div class="mcp-card-header">
              <h4>${escapeHtml(s.name)}</h4>
              <span class="mcp-status mcp-status--${s.status}">${escapeHtml(s.status)}</span>
              ${s.toolCount !== undefined ? '<span class="mcp-tools">' + s.toolCount + ' ' + t("mcp.tools", "tools") + '</span>' : ''}
            </div>
            <p class="mcp-command"><code>${escapeHtml(s.command)} ${(s.args || []).map(escapeHtml).join(" ")}</code></p>
            ${s.errorMessage ? '<p class="mcp-error">' + escapeHtml(s.errorMessage) + '</p>' : ''}
            <div class="mcp-card-actions">
              <button type="button" data-mcp-toggle="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost">${s.status === "running" ? t("mcp.stop", "Stop") : t("mcp.start", "Start")}</button>
              <button type="button" data-mcp-delete="${escapeHtml(s.id)}" class="channel-action-btn channel-action-btn--ghost" style="color:var(--accent-red)">${t("mcp.delete", "Delete")}</button>
            </div>
          </article>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderControlCenterPromptsArea(prompts: PromptTemplateViewModel[]): string {
  return `
    <section id="control-center-prompts" class="control-center-area" data-control-area="prompts" aria-label="Prompt Management">
      <div class="control-area-header">
        <p class="eyebrow">${t("prompts.title", "Prompt Templates")}</p>
        <h2>${t("prompts.subtitle", "Reusable Prompt Library")}</h2>
        <div class="channel-orchestration-actions">
          <button type="button" data-prompt-add class="channel-action-btn">${t("prompt.addPrompt", "Add Prompt")}</button>
        </div>
      </div>
      <div class="prompt-list" role="list">
        ${prompts.length === 0 ? `<div class="empty-state"><p>${t("prompt.noPrompts", "No prompt templates")}</p></div>` : ''}
        ${prompts.map((p) => `
          <article class="prompt-card${p.isFavorite ? " prompt-card--favorite" : ""}" role="listitem" data-prompt-id="${escapeHtml(p.id)}">
            <div class="prompt-card-header">
              <h4>${escapeHtml(p.nameZh || p.name)}</h4>
              ${p.category ? '<span class="prompt-category">' + escapeHtml(p.category) + '</span>' : ''}
              <button type="button" data-prompt-favorite="${escapeHtml(p.id)}" class="prompt-fav-btn">${p.isFavorite ? "&#9733;" : "&#9734;"}</button>
              <button type="button" data-prompt-delete="${escapeHtml(p.id)}" class="prompt-fav-btn" style="color:var(--accent-red)">&#128465;</button>
            </div>
            <p class="prompt-content">${escapeHtml(p.content.slice(0, 120))}${p.content.length > 120 ? "..." : ""}</p>
            ${p.tags ? '<div class="prompt-tags">' + p.tags.map((tag) => '<span class="trait-tag">' + escapeHtml(tag) + '</span>').join("") + '</div>' : ''}
          </article>
        `).join("")}
      </div>
    </section>
  `;
}


// ═══════════════════════════════════════════════════════════════════════
// 完整 Settings 渲染器 (仿照 cc-switch SettingsPage)
// ═══════════════════════════════════════════════════════════════════════

export function renderFullSettingsArea(settings: AppSettingsSnapshot): string {
  return `
    <section id="control-center-settings-full" class="control-center-area" data-control-area="settings-full" aria-label="Full Settings">
      <div class="control-area-header">
        <p class="eyebrow">${t("settings.fullTitle", "Settings")}</p>
        <h2>${t("settings.fullSubtitle", "Application Configuration")}</h2>
      </div>

      <div class="settings-tabs" role="tablist">
        <button type="button" class="settings-tab settings-tab--active" data-settings-tab="general">${t("settings.tabGeneral", "General")}</button>
        <button type="button" class="settings-tab" data-settings-tab="appearance">${t("settings.tabAppearance", "Appearance")}</button>
        <button type="button" class="settings-tab" data-settings-tab="terminal">${t("settings.tabTerminal", "Terminal")}</button>
        <button type="button" class="settings-tab" data-settings-tab="proxy">${t("settings.tabProxy", "Proxy")}</button>
        <button type="button" class="settings-tab" data-settings-tab="failover">${t("settings.tabFailover", "Failover")}</button>
        <button type="button" class="settings-tab" data-settings-tab="privacy">${t("settings.tabPrivacy", "Privacy")}</button>
        <button type="button" class="settings-tab" data-settings-tab="backup">${t("settings.tabBackup", "Backup")}</button>
      </div>

      <div class="settings-content">
        <!-- 通用设置 -->
        <div class="settings-panel" data-settings-panel="general">
          <h3>${t("settings.general", "General Settings")}</h3>
          <div class="settings-group">
            <label class="settings-label">${t("settings.language", "Language")}</label>
            <select class="modal-select" data-setting="language">
              <option value="zh" ${settings.language === "zh" ? "selected" : ""}>中文</option>
              <option value="en" ${settings.language === "en" ? "selected" : ""}>English</option>
            </select>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.startupBehavior", "Startup Behavior")}</label>
            <select class="modal-select" data-setting="startupBehavior">
              <option value="restore" ${settings.startupBehavior === "restore" ? "selected" : ""}>${t("settings.restoreLast", "Restore Last Session")}</option>
              <option value="fresh" ${settings.startupBehavior === "fresh" ? "selected" : ""}>${t("settings.freshStart", "Fresh Start")}</option>
              <option value="minimized" ${settings.startupBehavior === "minimized" ? "selected" : ""}>${t("settings.minimized", "Start Minimized")}</option>
            </select>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.closeBehavior", "Close Behavior")}</label>
            <select class="modal-select" data-setting="closeBehavior">
              <option value="close" ${settings.closeBehavior === "close" ? "selected" : ""}>${t("settings.closeWindow", "Close Window")}</option>
              <option value="minimize" ${settings.closeBehavior === "minimize" ? "selected" : ""}>${t("settings.minimizeToTray", "Minimize to Tray")}</option>
              <option value="quit" ${settings.closeBehavior === "quit" ? "selected" : ""}>${t("settings.quitApp", "Quit Application")}</option>
            </select>
          </div>
          <div class="settings-group">
            <label class="settings-toggle-label">
              <input type="checkbox" data-setting="checkUpdates" ${settings.checkUpdates ? "checked" : ""} />
              <span>${t("settings.checkUpdates", "Check for Updates")}</span>
            </label>
          </div>
        </div>

        <!-- 外观设置 -->
        <div class="settings-panel" data-settings-panel="appearance" style="display:none">
          <h3>${t("settings.appearance", "Appearance Settings")}</h3>
          <div class="settings-group">
            <label class="settings-label">${t("settings.theme", "Theme")}</label>
            <select class="modal-select" data-setting="theme">
              <option value="dark" ${settings.theme === "dark" ? "selected" : ""}>${t("settings.dark", "Dark")}</option>
              <option value="light" ${settings.theme === "light" ? "selected" : ""}>${t("settings.light", "Light")}</option>
              <option value="system" ${settings.theme === "system" ? "selected" : ""}>${t("settings.system", "System")}</option>
            </select>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.fontSize", "Font Size")}</label>
            <input type="range" min="12" max="20" value="${settings.fontSize}" data-setting="fontSize" class="settings-slider" />
            <span class="settings-value">${settings.fontSize}px</span>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.accentColor", "Accent Color")}</label>
            <input type="color" value="${settings.accentColor}" data-setting="accentColor" class="settings-color" />
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.glassOpacity", "Glass Opacity")}</label>
            <input type="range" min="0" max="100" value="${settings.glassOpacity}" data-setting="glassOpacity" class="settings-slider" />
            <span class="settings-value">${settings.glassOpacity}%</span>
          </div>
        </div>

        <!-- 终端设置 -->
        <div class="settings-panel" data-settings-panel="terminal" style="display:none">
          <h3>${t("settings.terminal", "Terminal Settings")}</h3>
          <div class="settings-group">
            <label class="settings-label">${t("settings.defaultTerminal", "Default Terminal")}</label>
            <select class="modal-select" data-setting="terminalDefault">
              <option value="system" ${settings.terminalDefault === "system" ? "selected" : ""}>${t("settings.systemDefault", "System Default")}</option>
              <option value="iterm2" ${settings.terminalDefault === "iterm2" ? "selected" : ""}>iTerm2</option>
              <option value="kitty" ${settings.terminalDefault === "kitty" ? "selected" : ""}>Kitty</option>
              <option value="alacritty" ${settings.terminalDefault === "alacritty" ? "selected" : ""}>Alacritty</option>
              <option value="wezterm" ${settings.terminalDefault === "wezterm" ? "selected" : ""}>WezTerm</option>
            </select>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.shellPath", "Shell Path")}</label>
            <input type="text" class="modal-input" value="${escapeHtml(settings.terminalShellPath)}" data-setting="terminalShellPath" placeholder="/bin/zsh" />
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.terminalFontSize", "Terminal Font Size")}</label>
            <input type="range" min="10" max="24" value="${settings.terminalFontSize}" data-setting="terminalFontSize" class="settings-slider" />
            <span class="settings-value">${settings.terminalFontSize}px</span>
          </div>
        </div>

        <!-- 代理设置 -->
        <div class="settings-panel" data-settings-panel="proxy" style="display:none">
          <h3>${t("settings.proxy", "Proxy Settings")}</h3>
          <div class="settings-group">
            <label class="settings-toggle-label">
              <input type="checkbox" data-setting="proxyEnabled" ${settings.proxyEnabled ? "checked" : ""} />
              <span>${t("settings.enableProxy", "Enable Proxy")}</span>
            </label>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.proxyUrl", "Proxy URL")}</label>
            <input type="text" class="modal-input" value="${escapeHtml(settings.proxyUrl)}" data-setting="proxyUrl" placeholder="http://127.0.0.1:7890" />
            <p class="form-hint">${t("settings.proxyHint", "Supports HTTP/HTTPS/SOCKS5")}</p>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.gatewayAccessKey", "Gateway Access Key")}</label>
            <input type="password" class="modal-input" value="${escapeHtml(settings.gatewayAccessKey || "")}" data-setting="gatewayAccessKey" placeholder="${t("settings.gatewayAccessKeyPlaceholder", "Optional bearer token for gateway/control-plane APIs")}" />
            <p class="form-hint">${t("settings.gatewayAccessKeyHint", "Used as Authorization bearer token for local gateway APIs")}</p>
          </div>
        </div>

        <!-- 故障转移设置 -->
        <div class="settings-panel" data-settings-panel="failover" style="display:none">
          <h3>${t("settings.failover", "Failover Settings")}</h3>
          <div class="settings-group">
            <label class="settings-toggle-label">
              <input type="checkbox" data-setting="autoFailover" ${settings.autoFailover ? "checked" : ""} />
              <span>${t("settings.autoFailover", "Auto Failover")}</span>
            </label>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.failoverThreshold", "Failure Threshold")}</label>
            <input type="number" class="modal-input" value="${settings.failoverThreshold}" data-setting="failoverThreshold" min="1" max="100" />
            <p class="form-hint">${t("settings.failoverThresholdHint", "Consecutive failures before switching provider")}</p>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.circuitBreakerTimeout", "Circuit Breaker Timeout (s)")}</label>
            <input type="number" class="modal-input" value="${settings.circuitBreakerTimeout}" data-setting="circuitBreakerTimeout" min="10" max="3600" />
          </div>
        </div>

        <!-- 隐私设置 -->
        <div class="settings-panel" data-settings-panel="privacy" style="display:none">
          <h3>${t("settings.privacy", "Privacy Settings")}</h3>
          <div class="settings-group">
            <label class="settings-toggle-label">
              <input type="checkbox" data-setting="telemetryEnabled" ${settings.telemetryEnabled ? "checked" : ""} />
              <span>${t("settings.telemetry", "Enable Telemetry")}</span>
            </label>
          </div>
          <div class="settings-group">
            <label class="settings-toggle-label">
              <input type="checkbox" data-setting="crashReporting" ${settings.crashReporting ? "checked" : ""} />
              <span>${t("settings.crashReporting", "Crash Reporting")}</span>
            </label>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.sessionRetention", "Session Retention (days)")}</label>
            <input type="number" class="modal-input" value="${settings.sessionRetentionDays}" data-setting="sessionRetentionDays" min="1" max="365" />
          </div>
        </div>

        <!-- 备份设置 -->
        <div class="settings-panel" data-settings-panel="backup" style="display:none">
          <h3>${t("settings.backup", "Backup & Restore")}</h3>
          <div class="settings-group">
            <label class="settings-toggle-label">
              <input type="checkbox" data-setting="autoBackup" ${settings.autoBackup ? "checked" : ""} />
              <span>${t("settings.autoBackup", "Auto Backup")}</span>
            </label>
          </div>
          <div class="settings-group">
            <label class="settings-label">${t("settings.backupInterval", "Backup Interval (hours)")}</label>
            <input type="number" class="modal-input" value="${settings.autoBackupInterval}" data-setting="autoBackupInterval" min="1" max="168" />
          </div>
          ${settings.lastBackupAt ? '<p class="form-hint">' + t("settings.lastBackup", "Last backup") + ': ' + escapeHtml(settings.lastBackupAt) + '</p>' : ""}
          <div class="settings-actions">
            <button type="button" class="modal-btn modal-btn--primary" data-action="export-config">${t("settings.exportConfig", "Export Config")}</button>
            <button type="button" class="modal-btn modal-btn--ghost" data-action="import-config">${t("settings.importConfig", "Import Config")}</button>
            <button type="button" class="modal-btn modal-btn--ghost" data-action="create-backup">${t("settings.createBackup", "Create Backup")}</button>
          </div>
        </div>
      </div>
    </section>
  `;
}


// ═══════════════════════════════════════════════════════════════════════
// CCX 高级功能渲染器 — 渠道日志、能力测试、全局统计
// ═══════════════════════════════════════════════════════════════════════

function logStatusColor(status: string): string {
  const colors: Record<string, string> = { completed: "var(--accent-green)", failed: "var(--accent-red)", streaming: "var(--accent-blue)", connecting: "var(--accent-orange)", pending: "var(--text-muted)" };
  return colors[status] || "var(--text-muted)";
}

export function renderChannelLogsDialog(channelName: string, logs: ChannelLogEntry[]): string {
  return `
    <div class="channel-logs-dialog" aria-label="${t("channelLogs.title", "Channel Logs")} - ${escapeHtml(channelName)}">
      <div class="logs-header">
        <h3>${t("channelLogs.title", "Channel Logs")} - ${escapeHtml(channelName)}</h3>
        <label class="settings-toggle-label">
          <input type="checkbox" data-logs-auto-refresh checked />
          <span>${t("channelLogs.autoRefresh", "Auto Refresh")}</span>
        </label>
      </div>
      <div class="logs-scroll">
        ${logs.length === 0 ? '<div class="empty-state"><p>' + t("channelLogs.empty", "No logs") + '</p></div>' : ''}
        ${logs.map((log, i) => `
          <div class="log-item${log.status === 'failed' ? ' log-item--error' : ''}" data-log-index="${i}">
            <div class="log-row">
              <span class="log-status-code" style="color: ${logStatusColor(log.status)}">${log.statusCode || '-'}</span>
              <span class="log-time">${escapeHtml(log.timestamp)}</span>
              <span class="log-status-badge" style="color: ${logStatusColor(log.status)}">${escapeHtml(log.status)}</span>
              ${log.interfaceType ? '<span class="log-interface">' + escapeHtml(log.interfaceType) + '</span>' : ''}
              <span class="log-model">${escapeHtml(log.model)}</span>
              <code class="log-key">${escapeHtml(log.keyMask)}</code>
              ${log.connectMs !== undefined ? '<span class="log-duration">' + t("channelLogs.duration.connect", "Connect") + ' ' + log.connectMs + 'ms</span>' : ''}
              ${log.firstByteMs !== undefined ? '<span class="log-duration">' + t("channelLogs.duration.firstByte", "First Byte") + ' ' + log.firstByteMs + 'ms</span>' : ''}
              <span class="log-duration">${t("channelLogs.duration.total", "Total")} ${log.durationMs}ms</span>
              ${log.isRetry ? '<span class="log-retry">' + t("channelLogs.retry", "Retry") + '</span>' : ''}
            </div>
            ${log.errorInfo ? '<div class="log-error-detail">' + escapeHtml(log.errorInfo) + '</div>' : ''}
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderCapabilityTestDialog(job: CapabilityTestJob): string {
  const progressPct = job.totalModels > 0 ? (job.completedModels / job.totalModels * 100) : 0;
  return `
    <div class="capability-dialog" aria-label="${t("capability.title", "Capability Test")}">
      <div class="capability-header">
        <h3>${t("capability.title", "Capability Test")} - ${escapeHtml(job.channelName)}</h3>
        <span class="capability-status capability-status--${job.status}">${escapeHtml(job.status)}</span>
      </div>
      ${job.status === "running" ? `
        <div class="capability-progress">
          <div class="progress-bar"><div class="progress-fill" style="width: ${progressPct}%"></div></div>
          <span class="progress-text">${job.completedModels}/${job.totalModels} ${t("capability.progressSummary", "models completed")}</span>
        </div>
      ` : ''}
      <div class="capability-results">
        <div class="capability-table-header">
          <span>${t("capability.table.protocol", "Protocol")}</span>
          <span>${t("capability.table.status", "Status")}</span>
          <span>${t("capability.table.latency", "Latency")}</span>
          <span>${t("capability.table.streaming", "Streaming")}</span>
        </div>
        ${job.results.map((r) => `
          <div class="capability-table-row${r.success ? '' : ' capability-table-row--failed'}">
            <span>${escapeHtml(r.protocol)}</span>
            <span class="capability-result-status">${r.success ? t("capability.success", "Success") : t("capability.failed", "Failed")}</span>
            <span>${r.latencyMs}ms</span>
            <span>${r.streamingSupported ? t("capability.supported", "Supported") : t("capability.unsupported", "Unsupported")}</span>
          </div>
        `).join("")}
      </div>
      ${job.finishedAt ? '<p class="capability-meta">' + t("capability.testedAt", "Tested At") + ': ' + escapeHtml(job.finishedAt) + '</p>' : ''}
    </div>
  `;
}

export function renderGlobalStatsChart(stats: GlobalStatsSnapshot): string {
  const maxTraffic = Math.max(...stats.trafficHistory.map(d => d.value), 1);
  const maxTokens = Math.max(...stats.tokenHistory.map(d => d.value), 1);
  const maxCost = Math.max(...stats.costHistory.map(d => d.value), 0.01);

  function sparkline(data: Array<{value: number}>, max: number, color: string): string {
    if (data.length < 2) return "";
    const w = 200, h = 40;
    const step = w / (data.length - 1);
    const points = data.map((d, i) => (i * step) + "," + (h - (d.value / max * h))).join(" ");
    return '<svg viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" class="stats-sparkline"><polyline fill="none" stroke="' + color + '" stroke-width="2" points="' + points + '"/></svg>';
  }

  return `
    <section class="global-stats" aria-label="Global Statistics">
      <div class="stats-grid">
        <div class="stats-card">
          <h4>${t("chart.traffic", "Traffic")}</h4>
          ${sparkline(stats.trafficHistory, maxTraffic, "var(--accent-blue)")}
          <span class="stats-total">${stats.trafficHistory.reduce((s, d) => s + d.value, 0).toLocaleString()} ${t("chart.requestUnit", "requests")}</span>
        </div>
        <div class="stats-card">
          <h4>${t("chart.tokens", "Tokens")}</h4>
          ${sparkline(stats.tokenHistory, maxTokens, "var(--accent-cyan)")}
          <span class="stats-total">${(stats.tokenHistory.reduce((s, d) => s + d.value, 0) / 1000).toFixed(1)}k</span>
        </div>
        <div class="stats-card">
          <h4>${t("costs.estimatedCost", "Cost")}</h4>
          ${sparkline(stats.costHistory, maxCost, "var(--accent-green)")}
          <span class="stats-total">$${stats.costHistory.reduce((s, d) => s + d.value, 0).toFixed(2)}</span>
        </div>
        <div class="stats-card">
          <h4>${t("chart.successRate", "Success Rate")}</h4>
          ${sparkline(stats.successRateHistory, 100, "var(--accent-purple)")}
          <span class="stats-total">${stats.successRateHistory.length > 0 ? stats.successRateHistory[stats.successRateHistory.length - 1].value.toFixed(1) + '%' : '--'}</span>
        </div>
      </div>
      ${stats.topModels.length > 0 ? `
        <div class="stats-top-models">
          <h4>${t("chart.modelStats", "Top Models")}</h4>
          ${stats.topModels.map((m) => `
            <div class="top-model-row">
              <span class="top-model-name">${escapeHtml(m.model)}</span>
              <div class="top-model-bar"><div class="top-model-fill" style="width: ${m.percentage}%"></div></div>
              <span class="top-model-count">${m.requestCount.toLocaleString()}</span>
            </div>
          `).join("")}
        </div>
      ` : ''}
    </section>
  `;
}



// ═══════════════════════════════════════════════════════════════════════
// CCX 会话驾驶舱渲染器 (仿照 ConversationDashboard)
// ═══════════════════════════════════════════════════════════════════════

export function renderConversationDashboard(dashboard: ConversationDashboardSnapshot): string {
  const kindFilters: Array<{ value: ConversationKind | ""; label: string; color: string }> = [
    { value: "", label: t("cockpit.filter.all", "全部"), color: "var(--text-primary)" },
    { value: "messages", label: t("cockpit.filter.messages", "消息"), color: "var(--accent-purple)" },
    { value: "chat", label: t("cockpit.filter.chat", "对话"), color: "var(--accent-blue)" },
    { value: "images", label: t("cockpit.filter.images", "图像"), color: "var(--accent-pink)" },
    { value: "responses", label: t("cockpit.filter.responses", "响应"), color: "var(--accent-cyan)" },
    { value: "gemini", label: t("cockpit.filter.gemini", "Gemini"), color: "var(--accent-orange)" },
  ];

  const filtered = dashboard.conversations.filter((c) => {
    if (dashboard.activeFilter && c.kind !== dashboard.activeFilter) return false;
    if (dashboard.searchQuery) {
      const q = dashboard.searchQuery.toLowerCase();
      return c.title.toLowerCase().includes(q) || c.channelName?.toLowerCase().includes(q);
    }
    return true;
  });

  return `
    <div class="conversation-dashboard" data-control-area="conversations">
      <div class="dashboard-header">
        <div class="kind-filter-chips">
          ${kindFilters.map((f) => `
            <button type="button" class="kind-chip ${dashboard.activeFilter === f.value ? 'kind-chip--active' : ''}"
              data-kind-filter="${f.value}" style="--chip-color: ${f.color}">
              ${escapeHtml(f.label)}
            </button>
          `).join("")}
        </div>
        <div class="dashboard-search">
          <input type="search" data-conversation-search value="${escapeHtml(dashboard.searchQuery)}"
            placeholder="${t('cockpit.searchPlaceholder', 'Search conversations...')}" class="search-input" />
        </div>
        <div class="system-status">
          <span class="status-dot status-dot--${dashboard.systemStatus}"></span>
          <span>${escapeHtml(t("cockpit.status." + dashboard.systemStatus, dashboard.systemStatus))}</span>
          <span class="active-count">${t('cockpit.active', 'Active')}: ${filtered.length}</span>
          ${dashboard.overrideCount > 0 ? `<span class="override-count">${t('cockpit.override', 'Override')}: ${dashboard.overrideCount}</span>` : ''}
        </div>
      </div>
      ${filtered.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">💬</div>
          <p>${t('cockpit.empty', 'No active conversations')}</p>
        </div>
      ` : `
        <div class="conversation-grid">
          ${filtered.map((conv) => renderConversationCard(conv)).join("")}
        </div>
      `}
    </div>
  `;
}

function renderConversationCard(conv: ConversationInfo): string {
  const statusColors: Record<ConversationStatus, string> = {
    active: "var(--accent-green)",
    idle: "var(--accent-gold)",
    completed: "var(--text-muted)",
    error: "var(--accent-red)",
  };
  const kindIcons: Record<ConversationKind, string> = {
    messages: "💬",
    chat: "🗨️",
    images: "🖼️",
    responses: "📝",
    gemini: "✨",
  };

  return `
    <article class="conversation-card" data-conversation-id="${escapeHtml(conv.id)}">
      <div class="conversation-card-header">
        <span class="conversation-kind-icon">${kindIcons[conv.kind]}</span>
        <span class="conversation-kind-badge" style="color: ${statusColors[conv.status]}">${escapeHtml(t("cockpit.kind." + conv.kind, conv.kind))}</span>
        <span class="conversation-status-dot" style="background: ${statusColors[conv.status]}"></span>
      </div>
      <h4 class="conversation-title">${escapeHtml(conv.title)}</h4>
      ${conv.channelName ? `<p class="conversation-channel">${escapeHtml(conv.channelName)}</p>` : ''}
      <div class="conversation-meta">
        <span class="conversation-messages">💬 ${conv.messageCount}</span>
        ${conv.model ? `<span class="conversation-model">🤖 ${escapeHtml(conv.model)}</span>` : ''}
        ${conv.estimatedCost ? `<span class="conversation-cost">💰 $${conv.estimatedCost.toFixed(4)}</span>` : ''}
      </div>
      <div class="conversation-time">
        <span>${escapeHtml(conv.lastActivityAt)}</span>
      </div>
    </article>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// CCX Key Trend Chart 渲染器 (仿照 KeyTrendChart)
// ═══════════════════════════════════════════════════════════════════════

export function renderKeyTrendChart(trend: KeyTrendSnapshot): string {
  const durationOptions: ChartDuration[] = ["1h", "6h", "24h", "today", "7d", "30d"];
  const viewOptions: Array<{ value: KeyTrendView; label: string; icon: string }> = [
    { value: "traffic", label: t("chart.traffic", "Traffic"), icon: "📈" },
    { value: "tokens", label: "Token I/O", icon: "📊" },
    { value: "cache", label: t("chart.cacheRw", "Cache R/W"), icon: "💾" },
  ];

  return `
    <div class="key-trend-chart" data-chart-type="key-trend">
      <div class="chart-header">
        <div class="duration-selector">
          ${durationOptions.map((d) => `
            <button type="button" class="duration-btn ${trend.duration === d ? 'duration-btn--active' : ''}"
              data-duration="${d}">${d}</button>
          `).join("")}
          <button type="button" class="refresh-btn" data-chart-refresh title="${t('chart.refresh', 'Refresh')}">🔄</button>
        </div>
        <div class="view-selector">
          ${viewOptions.map((v) => `
            <button type="button" class="view-btn ${trend.view === v.value ? 'view-btn--active' : ''}"
              data-view="${v.value}">
              <span class="view-icon">${v.icon}</span> ${escapeHtml(v.label)}
            </button>
          `).join("")}
        </div>
      </div>
      <div class="summary-cards">
        <div class="summary-card">
          <span class="summary-label">${t('chart.totalRequests', 'Total Requests')}</span>
          <span class="summary-value">${formatNumber(trend.summary.totalRequests)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">${t('chart.successRate', 'Success Rate')}</span>
          <span class="summary-value ${trend.summary.avgSuccessRate >= 95 ? 'text-success' : trend.summary.avgSuccessRate >= 80 ? 'text-warning' : 'text-error'}">
            ${trend.summary.avgSuccessRate.toFixed(1)}%
          </span>
        </div>
        <div class="summary-card">
          <span class="summary-label">${t('chart.inputTokens', 'Input Tokens')}</span>
          <span class="summary-value">${formatNumber(trend.summary.totalInputTokens)}</span>
        </div>
        <div class="summary-card">
          <span class="summary-label">${t('chart.outputTokens', 'Output Tokens')}</span>
          <span class="summary-value">${formatNumber(trend.summary.totalOutputTokens)}</span>
        </div>
      </div>
      <div class="chart-area" data-chart-view="${trend.view}">
        ${trend.dataPoints.length === 0 ? `
          <div class="empty-state">
            <div class="empty-icon">📊</div>
            <p>${t('chart.noData', 'No data in this time range')}</p>
          </div>
        ` : `
          <div class="sparkline-chart">
            ${renderSparkline(trend.dataPoints.map((d) => d.requests), trend.view)}
          </div>
        `}
      </div>
    </div>
  `;
}

function renderSparkline(values: number[], view: string): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const width = 300;
  const height = 80;
  const step = width / (values.length - 1 || 1);
  
  const points = values.map((v, i) => `${i * step},${height - (v / max) * height}`).join(' ');
  const areaPoints = `0,${height} ${points} ${width},${height}`;
  
  const colors: Record<string, string> = {
    traffic: "var(--accent-blue)",
    tokens: "var(--accent-purple)",
    cache: "var(--accent-cyan)",
  };
  const color = colors[view] || "var(--accent-blue)";
  
  return `
    <svg viewBox="0 0 ${width} ${height}" class="sparkline-svg">
      <polygon points="${areaPoints}" fill="${color}" opacity="0.1" />
      <polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" />
    </svg>
  `;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

// ═══════════════════════════════════════════════════════════════════════
// CCX Model Stats Chart 渲染器 (仿照 ModelStatsChart)
// ═══════════════════════════════════════════════════════════════════════

export function renderModelStatsChart(stats: ModelStatsSnapshot): string {
  const durationOptions: ChartDuration[] = ["1h", "6h", "24h", "today"];
  const viewOptions: Array<{ value: ModelStatsView; label: string; icon: string }> = [
    { value: "requests", label: t("chart.traffic", "Traffic"), icon: "📈" },
    { value: "tokens", label: "Token", icon: "📊" },
    { value: "cache", label: t("chart.cacheRw", "Cache R/W"), icon: "💾" },
  ];

  return `
    <div class="model-stats-chart" data-chart-type="model-stats">
      <div class="chart-header">
        <div class="duration-selector">
          ${durationOptions.map((d) => `
            <button type="button" class="duration-btn ${stats.duration === d ? 'duration-btn--active' : ''}"
              data-duration="${d}">${d}</button>
          `).join("")}
          <button type="button" class="refresh-btn" data-chart-refresh title="${t('chart.refresh', 'Refresh')}">🔄</button>
        </div>
        <div class="view-selector">
          ${viewOptions.map((v) => `
            <button type="button" class="view-btn ${stats.view === v.value ? 'view-btn--active' : ''}"
              data-view="${v.value}">
              <span class="view-icon">${v.icon}</span> ${escapeHtml(v.label)}
            </button>
          `).join("")}
        </div>
      </div>
      ${stats.topModels.length > 0 ? `
        <div class="compact-summary">
          ${stats.topModels.map((m, i) => `
            <span class="model-tag">
              <span class="model-dot" style="background: var(--accent-${['blue', 'purple', 'cyan', 'green', 'orange'][i % 5]})"></span>
              <strong>${escapeHtml(m.name)}</strong> ${formatNumber(m.count)} ${t('chart.requests', 'req')}
            </span>
          `).join("")}
        </div>
      ` : ''}
      ${stats.models.length === 0 ? `
        <div class="empty-state">
          <div class="empty-icon">📊</div>
          <p>${t('chart.noModelData', 'No model data in this time range')}</p>
        </div>
      ` : `
        <div class="model-stats-table">
          <table>
            <thead>
              <tr>
                <th>${t('chart.model', 'Model')}</th>
                <th>${t('chart.requests', 'Requests')}</th>
                <th>${t('chart.inputTokens', 'Input')}</th>
                <th>${t('chart.outputTokens', 'Output')}</th>
                <th>${t('chart.successRate', 'Success')}</th>
                <th>${t('chart.avgLatency', 'Latency')}</th>
              </tr>
            </thead>
            <tbody>
              ${stats.models.map((m) => `
                <tr>
                  <td class="model-name">${escapeHtml(m.model)}</td>
                  <td>${formatNumber(m.requestCount)}</td>
                  <td>${formatNumber(m.inputTokens)}</td>
                  <td>${formatNumber(m.outputTokens)}</td>
                  <td class="${m.successRate >= 95 ? 'text-success' : m.successRate >= 80 ? 'text-warning' : 'text-error'}">
                    ${m.successRate.toFixed(1)}%
                  </td>
                  <td>${m.avgLatencyMs}ms</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// CCX Update Dialog 渲染器 (仿照 UpdateDialog)
// ═══════════════════════════════════════════════════════════════════════

export function renderUpdateDialog(update: UpdateInfo): string {
  return `
    <dialog class="update-dialog" data-dialog="update">
      <div class="update-dialog-content">
        <div class="update-header">
          <h3>🔄 ${t('update.title', 'Update Available')}</h3>
          <button type="button" class="close-btn" data-dialog-close>✕</button>
        </div>
        <div class="update-body">
          <div class="version-info">
            <span class="current-version">${t('update.current', 'Current')}: ${escapeHtml(update.currentVersion)}</span>
            <span class="version-arrow">→</span>
            <span class="latest-version">${t('update.latest', 'Latest')}: ${escapeHtml(update.latestVersion)}</span>
          </div>
          ${update.releaseNotes ? `
            <div class="release-notes">
              <h4>${t('update.releaseNotes', 'Release Notes')}</h4>
              <div class="notes-content">${escapeHtml(update.releaseNotes)}</div>
            </div>
          ` : ''}
          <div class="update-meta">
            <span>${t('update.publishedAt', 'Published')}: ${escapeHtml(update.publishedAt)}</span>
            ${update.isMandatory ? `<span class="mandatory-badge">${t('update.mandatory', 'Mandatory')}</span>` : ''}
          </div>
        </div>
        <div class="update-actions">
          <button type="button" class="btn btn--secondary" data-dialog-close>${t('update.later', 'Later')}</button>
          ${update.downloadUrl ? `
            <a href="${escapeHtml(update.downloadUrl)}" target="_blank" class="btn btn--primary">${t('update.download', 'Download')}</a>
          ` : `
            <button type="button" class="btn btn--primary" data-dialog-close>${t('update.ok', 'OK')}</button>
          `}
        </div>
      </div>
    </dialog>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch App Switcher 渲染器 (仿照 AppSwitcher)
// ═══════════════════════════════════════════════════════════════════════

export function renderAppSwitcher(switcher: AppSwitcherSnapshot): string {
  const apps = Object.entries(switcher.visibleApps)
    .filter(([_, visible]) => visible)
    .map(([id]) => id as AppId);

  const appIcons: Record<AppId, string> = {
    claude: "🤖",
    "claude-desktop": "🖥️",
    codex: "🔮",
    gemini: "✨",
    opencode: "📝",
    openclaw: "🐾",
    hermes: "⚡",
    agentsoul: "💜",
  };
  const appNameKey: Record<AppId, string> = {
    claude: "apps.claude",
    "claude-desktop": "apps.claudeDesktop",
    codex: "apps.codex",
    gemini: "apps.gemini",
    opencode: "apps.opencode",
    openclaw: "apps.openclaw",
    hermes: "apps.hermes",
    agentsoul: "apps.agentsoul",
  };

  return `
    <div class="app-switcher" data-app-switcher>
      <div class="app-switcher-tabs">
        ${apps.map((app) => `
          <button type="button" class="app-tab ${switcher.activeApp === app ? 'app-tab--active' : ''}"
            data-app-id="${app}" title="${escapeHtml(t(appNameKey[app], switcher.appNames[app]))}">
            <span class="app-icon">${appIcons[app]}</span>
            <span class="app-name">${escapeHtml(t(appNameKey[app], switcher.appNames[app]))}</span>
          </button>
        `).join("")}
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch Usage Footer 渲染器 (仿照 UsageFooter)
// ═══════════════════════════════════════════════════════════════════════

export function renderUsageFooter(usage: UsageFooterSnapshot): string {
  if (!usage.usageEnabled || !usage.usage) return '';
  
  const data = usage.usage;
  const percentage = data.total > 0 ? (data.used / data.total) * 100 : 0;
  const isWarning = percentage >= 80;
  const isCritical = percentage >= 95;

  return `
    <div class="usage-footer ${isCritical ? 'usage-footer--critical' : isWarning ? 'usage-footer--warning' : ''}" data-provider-id="${escapeHtml(usage.providerId)}">
      <div class="usage-header">
        <span class="provider-name">${escapeHtml(usage.providerName)}</span>
        ${usage.isCurrent ? `<span class="current-badge">${t('usage.current', 'Current')}</span>` : ''}
      </div>
      ${!data.success ? `
        <div class="usage-error">
          <span class="error-icon">⚠️</span>
          <span>${escapeHtml(data.errorMessage || t('usage.fetchFailed', 'Failed to fetch usage'))}</span>
        </div>
      ` : `
        <div class="usage-bar-container">
          <div class="usage-bar" style="width: ${Math.min(percentage, 100)}%"></div>
        </div>
        <div class="usage-details">
          <span class="usage-used">${formatNumber(data.used)} / ${formatNumber(data.total)} ${escapeHtml(data.unit)}</span>
          <span class="usage-percentage">${percentage.toFixed(1)}%</span>
        </div>
        ${data.planName ? `<div class="usage-plan">${escapeHtml(data.planName)}</div>` : ''}
        ${data.resetsAt ? `<div class="usage-resets">${t('usage.resets', 'Resets')}: ${escapeHtml(data.resetsAt)}</div>` : ''}
      `}
      ${usage.lastQueriedAt ? `
        <div class="usage-last-queried">
          <span>${t('usage.lastQueried', 'Last queried')}: ${escapeHtml(usage.lastQueriedAt)}</span>
          <button type="button" class="refresh-btn" data-usage-refresh title="${t('usage.refresh', 'Refresh')}">🔄</button>
        </div>
      ` : ''}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch Backup List 渲染器 (仿照 BackupListSection)
// ═══════════════════════════════════════════════════════════════════════

export function renderBackupListSection(backup: BackupListSnapshot): string {
  return `
    <div class="backup-section" data-control-area="backup">
      <div class="backup-header">
        <h3>${t('backup.title', 'Backups')}</h3>
        <div class="backup-actions">
          <button type="button" class="btn btn--primary" data-backup-create>
            ${t('backup.create', 'Create Backup')}
          </button>
        </div>
      </div>
      <div class="backup-config">
        <div class="config-row">
          <label>${t('backup.autoBackup', 'Auto Backup')}</label>
          <button type="button" class="toggle-btn ${backup.autoBackupEnabled ? 'toggle-btn--active' : ''}"
            data-backup-auto-toggle>
            ${backup.autoBackupEnabled ? t('common.on', 'ON') : t('common.off', 'OFF')}
          </button>
        </div>
        <div class="config-row">
          <label>${t('backup.interval', 'Interval')}</label>
          <span>${backup.autoBackupInterval}h</span>
        </div>
        <div class="config-row">
          <label>${t('backup.maxBackups', 'Max Backups')}</label>
          <span>${backup.maxBackups}</span>
        </div>
        <div class="config-row">
          <label>${t('backup.storagePath', 'Storage Path')}</label>
          <span class="path">${escapeHtml(backup.storagePath)}</span>
        </div>
      </div>
      ${backup.backups.length === 0 ? `
        <div class="empty-state">
          <p>${t('backup.empty', 'No backups yet')}</p>
        </div>
      ` : `
        <div class="backup-list">
          ${backup.backups.map((b) => `
            <div class="backup-item" data-backup-id="${escapeHtml(b.id)}">
              <div class="backup-info">
                <span class="backup-name">${escapeHtml(b.name)}</span>
                <span class="backup-time">${escapeHtml(b.createdAt)}</span>
                <span class="backup-size">${formatBytes(b.sizeBytes)}</span>
                ${b.isAuto ? `<span class="backup-auto-badge">${t('backup.auto', 'Auto')}</span>` : ''}
              </div>
              ${b.description ? `<p class="backup-desc">${escapeHtml(b.description)}</p>` : ''}
              <div class="backup-item-actions">
                <button type="button" class="btn btn--small" data-backup-restore="${escapeHtml(b.id)}">
                  ${t('backup.restore', 'Restore')}
                </button>
                <button type="button" class="btn btn--small btn--danger" data-backup-delete="${escapeHtml(b.id)}">
                  ${t('backup.delete', 'Delete')}
                </button>
              </div>
            </div>
          `).join("")}
        </div>
      `}
    </div>
  `;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch WebDAV Sync 渲染器 (仿照 WebdavSyncSection)
// ═══════════════════════════════════════════════════════════════════════

export function renderWebdavSyncSection(webdav: WebdavSyncSnapshot): string {
  const statusIcons: Record<WebdavSyncStatus, string> = {
    idle: "⏸️",
    syncing: "🔄",
    error: "❌",
    success: "✅",
  };

  return `
    <div class="webdav-section" data-control-area="webdav">
      <div class="webdav-header">
        <h3>${t('webdav.title', 'WebDAV Sync')}</h3>
        <span class="sync-status ${webdav.status === 'syncing' ? 'sync-status--active' : ''}">
          ${statusIcons[webdav.status]} ${escapeHtml(t("webdav.status." + webdav.status, webdav.status))}
        </span>
      </div>
      ${!webdav.isConfigured ? `
        <div class="webdav-setup">
          <p>${t('webdav.notConfigured', 'WebDAV is not configured')}</p>
          <div class="form-group">
            <label>${t('webdav.serverUrl', 'Server URL')}</label>
            <input type="url" data-webdav-field="serverUrl" placeholder="https://dav.example.com" class="form-input" />
          </div>
          <div class="form-group">
            <label>${t('webdav.username', 'Username')}</label>
            <input type="text" data-webdav-field="username" class="form-input" />
          </div>
          <div class="form-group">
            <label>${t('webdav.remotePath', 'Remote Path')}</label>
            <input type="text" data-webdav-field="remotePath" placeholder="/agentsoul/backup" class="form-input" />
          </div>
          <button type="button" class="btn btn--primary" data-webdav-configure>
            ${t('webdav.configure', 'Configure')}
          </button>
        </div>
      ` : `
        <div class="webdav-config">
          <div class="config-row">
            <label>${t('webdav.serverUrl', 'Server URL')}</label>
            <span>${escapeHtml(webdav.config.serverUrl)}</span>
          </div>
          <div class="config-row">
            <label>${t('webdav.username', 'Username')}</label>
            <span>${escapeHtml(webdav.config.username)}</span>
          </div>
          <div class="config-row">
            <label>${t('webdav.remotePath', 'Remote Path')}</label>
            <span>${escapeHtml(webdav.config.remotePath)}</span>
          </div>
          <div class="config-row">
            <label>${t('webdav.autoSync', 'Auto Sync')}</label>
            <button type="button" class="toggle-btn ${webdav.config.autoSync ? 'toggle-btn--active' : ''}"
              data-webdav-auto-toggle>
              ${webdav.config.autoSync ? t('common.on', 'ON') : t('common.off', 'OFF')}
            </button>
          </div>
          ${webdav.config.autoSync ? `
            <div class="config-row">
              <label>${t('webdav.syncInterval', 'Sync Interval')}</label>
              <span>${webdav.config.syncInterval} ${t('webdav.minutes', 'min')}</span>
            </div>
          ` : ''}
          ${webdav.config.lastSyncAt ? `
            <div class="config-row">
              <label>${t('webdav.lastSync', 'Last Sync')}</label>
              <span>${escapeHtml(webdav.config.lastSyncAt)}</span>
              ${webdav.config.lastSyncStatus === 'error' ? `
                <span class="sync-error">${escapeHtml(webdav.config.lastSyncError || t('webdav.syncError', 'Sync error'))}</span>
              ` : ''}
            </div>
          ` : ''}
          <div class="webdav-actions">
            <button type="button" class="btn btn--primary" data-webdav-sync ${webdav.status === 'syncing' ? 'disabled' : ''}>
              ${webdav.status === 'syncing' ? t('webdav.syncing', 'Syncing...') : t('webdav.syncNow', 'Sync Now')}
            </button>
            <button type="button" class="btn btn--secondary" data-webdav-reset>
              ${t('webdav.reset', 'Reset Config')}
            </button>
          </div>
        </div>
      `}
    </div>
  `;
}

// ═══════════════════════════════════════════════════════════════════════
// cc-switch Deep Link Import 渲染器 (仿照 DeepLinkImportDialog)
// ═══════════════════════════════════════════════════════════════════════

export function renderDeepLinkImportDialog(importState: DeepLinkImportSnapshot): string {
  const typeIcons: Record<DeepLinkType, string> = {
    channel: "📡",
    provider: "🔌",
    config: "⚙️",
    skill: "🎯",
  };

  return `
    <section class="control-center-area" data-control-area="deeplink-launch">
      <div class="control-area-header">
        <p class="eyebrow">${t("deeplink.title", "Import Configuration")}</p>
        <h2>${t("deeplink.subtitle", "Deep Link Import")}</h2>
      </div>
      <button type="button" class="channel-action-btn" data-deeplink-open>${t("deeplink.openDialog", "Open Import Panel")}</button>
    </section>
    <dialog class="deeplink-dialog" data-dialog="deeplink-import">
      <div class="deeplink-dialog-content">
        <div class="deeplink-header">
          <h3>${t('deeplink.title', 'Import Configuration')}</h3>
          <button type="button" class="close-btn" data-dialog-close>✕</button>
        </div>
        <div class="deeplink-body">
          <div class="deeplink-input-area">
            <textarea data-deeplink-input placeholder="${t('deeplink.placeholder', 'Paste configuration URLs (one per line)...')}" rows="4"></textarea>
            <button type="button" class="btn btn--primary" data-deeplink-parse>
              ${t('deeplink.parse', 'Parse')}
            </button>
          </div>
          ${importState.links.length > 0 ? `
            <div class="deeplink-list">
              ${importState.links.map((link) => `
                <div class="deeplink-item" data-deeplink-url="${escapeHtml(link.url)}">
                  <span class="deeplink-icon">${typeIcons[link.type]}</span>
                  <div class="deeplink-info">
                    <span class="deeplink-type">${escapeHtml(link.type)}</span>
                    ${link.name ? `<span class="deeplink-name">${escapeHtml(link.name)}</span>` : ''}
                    ${link.description ? `<span class="deeplink-desc">${escapeHtml(link.description)}</span>` : ''}
                  </div>
                  <span class="deeplink-url">${escapeHtml(link.url)}</span>
                </div>
              `).join("")}
            </div>
          ` : ''}
          ${importState.isImporting ? `
            <div class="import-progress">
              <div class="progress-bar">
                <div class="progress-fill" style="width: ${importState.importProgress}%"></div>
              </div>
              <span>${importState.importProgress}%</span>
            </div>
          ` : ''}
          ${importState.lastImportResult ? `
            <div class="import-result ${importState.lastImportResult.success ? 'import-result--success' : 'import-result--error'}">
              <span>${importState.lastImportResult.success ? '✅' : '❌'}</span>
              <span>${escapeHtml(importState.lastImportResult.message)}</span>
              ${importState.lastImportResult.importedCount > 0 ? `
                <span>${t('deeplink.imported', 'Imported')}: ${importState.lastImportResult.importedCount}</span>
              ` : ''}
            </div>
          ` : ''}
        </div>
        <div class="deeplink-actions">
          <button type="button" class="btn btn--secondary" data-dialog-close>${t('common.cancel', 'Cancel')}</button>
          <button type="button" class="btn btn--primary" data-deeplink-run
            ${importState.links.length === 0 || importState.isImporting ? 'disabled' : ''}>
            ${importState.isImporting ? t('deeplink.importing', 'Importing...') : t('deeplink.import', 'Import All')}
          </button>
        </div>
      </div>
    </dialog>
  `;
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

  const companion = snapshot?.companion || defaultCompanionSnapshot.companion;
  const vitalsObj = companion.vitals || defaultCompanionSnapshot.companion.vitals;

  const vitalKeys = ["level", "xp", "energy", "hunger", "intimacy"];
  const vitalPercentages = [
    Math.min(100, ((vitalsObj.level || 0) / 10) * 100),
    Math.min(100, vitalsObj.xp || 0),
    vitalsObj.companionEnergy || 0,
    vitalsObj.hunger || 0,
    vitalsObj.intimacy || 0
  ];

  target.innerHTML = `
    <section class="shell" aria-label="AgentSoul v2 desktop shell" data-state="${viewModel.visualState}" data-active-tab="${(typeof localStorage !== "undefined" && localStorage.getItem("agentsoul_active_tab")) || "companion"}">
      <!-- Sidebar Panel -->
      <aside class="companion-panel sidebar-panel" aria-label="Desktop Companion">
        <div class="sidebar-header">
          <div class="app-brand">
            <span class="brand-title">${t("common.appName", "AgentSoul v2")}</span>
            <button type="button" data-locale-toggle class="locale-toggle-btn">${typeof i18nInstance !== "undefined" && i18nInstance.language === "zh" ? "EN" : "中文"}</button>
          </div>
        </div>

        <div class="companion-visual-section">
          <div class="companion-orb companion-orb--${viewModel.visualState}" aria-label="${escapeHtml(viewModel.name)} ${viewModel.visualState}">
            <canvas class="companion-canvas clean-avatar" width="200" height="200" style="width: 100%; height: 100%; display: block;"></canvas>
            <span class="companion-face" aria-hidden="true" style="display: none;">${faceForState(viewModel.visualState)}</span>
          </div>
          <div class="companion-identity">
            <h1>${escapeHtml(viewModel.name)}</h1>
            <p class="appearance-desc">${escapeHtml(viewModel.appearanceLabel)}</p>
            <p class="summary">
              ${t("common.appDesc", "Local-first AI Agent Companion for the Desktop Companion and Control Center.")}
            </p>
          </div>
        </div>

        <dl class="vitals">
          ${viewModel.vitals
            .map(
              (vital, index) => {
                const key = vitalKeys[index] || "unknown";
                const pct = vitalPercentages[index] ?? 50;
                return `
                  <div class="vital vital--${key}">
                    <dt>${escapeHtml(vital.label)}</dt>
                    <dd>${escapeHtml(vital.value)}</dd>
                    <div class="vital-bar">
                      <div class="vital-bar-fill" style="width: ${pct}%"></div>
                    </div>
                  </div>
                `;
              }
            )
            .join("")}
        </dl>

        <div class="interactions" aria-label="Companion interactions">
          <button type="button" data-interaction="feed">${t("common.feed", "Feed")}</button>
          <button type="button" data-interaction="play">${t("common.play", "Play")}</button>
          <button type="button" data-interaction="pet">${t("common.pet", "Pet")}</button>
          <button type="button" data-interaction="sleep">${t("common.sleep", "Sleep")}</button>
        </div>

        ${renderApprovalRequired(viewModel.pendingApproval)}
        ${renderRiskNotices(viewModel.riskNotices)}

        ${
          viewModel.lastInteractionStatus
            ? `<p class="interaction-status" role="status">${escapeHtml(viewModel.lastInteractionStatus)}</p>`
            : ""
        }
        <p class="route">${escapeHtml(viewModel.providerRouteLabel)}</p>
      </aside>

      <!-- Main Content Area -->
      <main class="main-content">
        ${renderAppSwitcher(snapshot.appSwitcher)}
        ${renderControlCenterTaskNavigation()}
        ${renderControlCenterCompanionArea(viewModel.controlCenterCompanionArea)}
        ${renderControlCenterGatewayArea(viewModel.controlCenterGatewayArea)}
        ${renderControlCenterCostsArea(viewModel.controlCenterCostsArea)}
        ${renderKeyTrendChart(snapshot.keyTrend)}
        ${renderModelStatsChart(snapshot.modelStats)}
        ${renderControlCenterSkillsArea(viewModel.controlCenterSkillsArea)}
        ${renderControlCenterSessionsArea(viewModel.controlCenterSessionsArea)}
        <section id="control-center-conversations" class="control-center-area">
          ${renderConversationDashboard(snapshot.conversationDashboard)}
        </section>
        ${renderControlCenterSafetyArea(viewModel.controlCenterSafetyArea)}
        ${renderControlCenterSettingsArea(viewModel.controlCenterSettingsArea)}
        ${renderSessionManagerArea(snapshot.localSessions || [])}
        ${renderControlCenterMcpArea(snapshot.mcpServers || [])}
        ${renderControlCenterPromptsArea(snapshot.prompts || [])}
        ${renderBackupListSection(snapshot.backupList)}
        ${renderWebdavSyncSection(snapshot.webdavSync)}
        ${renderDeepLinkImportDialog(snapshot.deepLinkImport)}
        ${renderUsageFooter(snapshot.usageFooter)}
      </main>
    </section>
  `;
}

export function renderDesktopCompanionWidget(
  target: HTMLElement,
  snapshot: CompanionRuntimeSnapshot = defaultCompanionSnapshot,
  lastInteractionStatus?: string,
): void {
  const state = snapshot.companion.activityState ?? resolveVisualState(snapshot);
  const summary = snapshot.companion.summary ?? t("common.appDesc", "Local-first companion");
  const updatedAt = snapshot.companion.lastUpdatedAt ?? "";
  target.innerHTML = `
    <section class="pet-widget" data-state="${escapeHtml(String(state))}" aria-label="Desktop Companion Widget" data-tauri-drag-region>
      <div class="pet-widget__character" data-pet-widget-trigger>
        <canvas class="companion-canvas clean-avatar" width="220" height="220" style="width: 100%; height: 100%; display: block;"></canvas>
      </div>
      <div class="pet-widget__status">
        <strong>${escapeHtml(snapshot.companion.displayName)}</strong>
        <span>${escapeHtml(summary)}</span>
        ${updatedAt ? `<time>${escapeHtml(updatedAt)}</time>` : ""}
        ${lastInteractionStatus ? `<p role="status">${escapeHtml(lastInteractionStatus)}</p>` : ""}
      </div>
      <button type="button" class="pet-widget__menu-btn" data-pet-menu-trigger aria-label="Open companion menu">•••</button>
    </section>
  `;
}
