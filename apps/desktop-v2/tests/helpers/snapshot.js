/**
 * Factory for building valid DesktopBodySnapshot objects for testing.
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
    desktopPreferences: { language: "zh" },
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
