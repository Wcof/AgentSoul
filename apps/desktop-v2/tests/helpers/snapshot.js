/**
 * Factory for building valid CompanionRuntimeSnapshot objects for testing.
 * Provides sensible defaults that can be overridden per-field.
 */

export function buildSnapshot(overrides = {}) {
  const defaults = {
    companion: {
      id: "test-companion",
      displayName: "Test Companion",
      soulId: "test-soul",
      petAppearance: { kind: "slime", skin: "default", animationStyle: "idle" },
      mood: "neutral",
      vitals: { level: 1, xp: 0, companionEnergy: 100, hunger: 100, intimacy: 0 },
    },
    providerProfile: { id: "test-provider", name: "Test Provider" },
    gateway: {
      routeHealth: "ready",
      activeProviderName: "Test Provider",
      activationMode: "gateway-route",
      clientProtocol: "openai-chat",
      providerProtocol: "openai-chat",
      targetModel: "gpt-4.1",
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
      projectPath: "/test",
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
        name: "Default",
        xpMultiplier: 1,
        energyCostMultiplier: 1,
        fatigueThreshold: 20,
        maxXpPerEvent: 50,
        maxEnergyCostPerEvent: 20,
      },
    },
    growthHistory: [],
    channels: [],
    dashboardStats: {
      totalChannels: 0,
      activeChannels: 0,
      totalRequests: 0,
      totalEstimatedCost: 0,
      overallSuccessRate: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
    },
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
      usage: { used: 0, total: 0, unit: "tokens", success: true },
    },
    backupList: {
      backups: [],
      autoBackupEnabled: true,
      autoBackupInterval: 24,
      maxBackups: 50,
      storagePath: "/tmp",
    },
    webdavSync: {
      config: {
        serverUrl: "",
        username: "",
        remotePath: "",
        autoSync: false,
        syncInterval: 30,
      },
      status: "idle",
      isConfigured: false,
    },
    deepLinkImport: {
      links: [],
      isImporting: false,
      importProgress: 0,
    },
    companionCustomization: {
      availableKinds: [
        { kind: "slime", label: "Slime", labelZh: "Slime" },
        { kind: "cat", label: "Cat", labelZh: "Cat" },
      ],
      availableSkins: [
        { skin: "default", label: "Default", labelZh: "Default", kind: "slime" },
        { skin: "tabby", label: "Tabby", labelZh: "Tabby", kind: "cat" },
      ],
      currentKind: "slime",
      currentSkin: "default",
      displayName: "Test Companion",
    },
    personaTemplates: [
      { id: "friendly", name: "Friendly", nameZh: "Friendly", role: "coding companion", personality: ["warm"], description: "A warm companion", descriptionZh: "A warm companion" },
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
      language: "zh",
      theme: "dark",
      startupBehavior: "restore",
      closeBehavior: "minimize",
      checkUpdates: true,
      terminalDefault: "system",
      terminalShellPath: "/bin/zsh",
      terminalFontSize: 14,
      proxyEnabled: false,
      proxyUrl: "",
      autoFailover: true,
      failoverThreshold: 3,
      circuitBreakerTimeout: 60,
      maxConcurrentSessions: 5,
      sessionRetentionDays: 30,
      sessionAutoSave: true,
      mcpAutoStart: true,
      mcpDefaultTimeout: 30,
      workspaceDir: "",
      dataDir: "",
      logDir: "",
      telemetryEnabled: false,
      crashReporting: false,
      fontSize: 14,
      fontFamily: "Inter",
      accentColor: "#3b82f6",
      glassOpacity: 95,
      autoBackup: true,
      autoBackupInterval: 24,
    },
  };

  return deepMerge(defaults, overrides);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] !== null &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] !== null &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
