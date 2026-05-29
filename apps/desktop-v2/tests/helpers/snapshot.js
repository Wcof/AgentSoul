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
