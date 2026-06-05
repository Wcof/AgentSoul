import { describe, expect, it } from "vitest";
import { normalizePetAssetPack, resolveRenderableSpriteSrc } from "../src/utils/petAssetPack";

describe("pet asset pack normalization", () => {
  it("normalizes full manifest with explicit states", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "demo",
        displayName: "Demo",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
        frame: { width: 128, height: 128, count: 32 },
        states: {
          idle: { frames: [0, 1, 2], loop: true, fps: 8 },
          blink: { frames: [3, 4], loop: true, fps: 6 },
          happy: { frames: [5, 6, 7], loop: true, fps: 10 },
          attention: { frames: [8, 9], loop: true },
          sleep: { frames: [10, 11], loop: true, fps: 4 },
          degraded: { frames: [12, 13], loop: true, fps: 4 },
        },
      },
      "/tmp/demo.codex-pet",
    );

    expect(normalized.validation.level).toBe("ok");
    expect(normalized.states.idle.frames).toEqual([0, 1, 2]);
    expect(normalized.manifest.spritesheetPath).toBe("/tmp/demo.codex-pet/spritesheet.webp");
  });

  it("supports legacy manifest and falls back safely", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "legacy",
        displayName: "Legacy",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
      },
      "/tmp/legacy.codex-pet",
    );

    expect(normalized.validation.level).toBe("warning");
    expect(normalized.states.idle.frames?.length).toBeGreaterThan(0);
    expect(normalized.states.sleep.frames?.length).toBeGreaterThan(0);
    expect(normalized.validation.messages.join(" ")).toMatch(/states missing/);
  });

  it("accepts state supersets without treating custom states as validation noise", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "superset",
        displayName: "Superset",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
        frame: { width: 128, height: 128, count: 8 },
        states: {
          idle: { frames: [0], loop: true },
          blink: { frames: [1], loop: true },
          happy: { frames: [2], loop: true },
          attention: { frames: [3], loop: true },
          sleep: { frames: [4], loop: true },
          degraded: { frames: [5], loop: true },
          walk: { frames: [6, 7], loop: true },
        } as any,
      },
      "/tmp/superset.codex-pet",
    );

    expect(normalized.validation.level).toBe("ok");
    expect(normalized.validation.messages).toEqual([]);
    expect(normalized.states.idle.frames).toEqual([0]);
  });

  it("maps missing core states to default before guessed animation slices", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "default-only",
        displayName: "Default Only",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
        frame: { width: 128, height: 128, count: 24 },
        states: {
          default: { frames: [9], loop: true, fps: 3 },
        } as any,
      },
      "/tmp/default-only.codex-pet",
    );

    expect(normalized.validation.level).toBe("warning");
    expect(normalized.states.idle.frames).toEqual([9]);
    expect(normalized.states.attention.frames).toEqual([9]);
    expect(normalized.states.sleep.fps).toBe(3);
    expect(normalized.validation.messages.filter((message) => message.includes("missing"))).toEqual([
      "warning: states idle, blink, happy, attention, sleep, degraded missing, fallback to default",
    ]);
  });

  it("reports missing spritesheet paths while resolving to the stable default filename", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "no-sprite",
        displayName: "No Sprite",
        kind: "person",
        states: {
          idle: { frames: [0], loop: true },
        },
      },
      "/tmp/no-sprite.codex-pet",
    );

    expect(normalized.validation.level).toBe("warning");
    expect(normalized.manifest.spritesheetPath).toBe("/tmp/no-sprite.codex-pet/spritesheet.webp");
    expect(normalized.validation.messages).toContain(
      "warning: spritesheetPath missing in pet.json, using spritesheet.webp",
    );
  });

  it("keeps nested relative spritesheet paths relative to the asset pack folder", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "relative",
        displayName: "Relative",
        spritesheetPath: "sprites/main sheet.webp",
        kind: "person",
        states: {
          idle: { frames: [0], loop: true },
        },
      },
      "/tmp/relative.codex-pet",
    );

    expect(normalized.manifest.spritesheetPath).toBe("/tmp/relative.codex-pet/sprites/main sheet.webp");
  });

  it("converts absolute local sprite paths through the Tauri asset protocol when available", () => {
    const original = (globalThis as any).__TAURI_INTERNALS__;
    (globalThis as any).__TAURI_INTERNALS__ = {
      convertFileSrc: (filePath: string, protocol = "asset") => `${protocol}://${encodeURIComponent(filePath)}`,
    };

    try {
      expect(resolveRenderableSpriteSrc("/tmp/demo.codex-pet/spritesheet.webp")).toBe(
        "asset://%2Ftmp%2Fdemo.codex-pet%2Fspritesheet.webp",
      );
    } finally {
      if (original === undefined) delete (globalThis as any).__TAURI_INTERNALS__;
      else (globalThis as any).__TAURI_INTERNALS__ = original;
    }
  });

  it("converts local sprite paths in Tauri v2 module runtime even without global internals", () => {
    const originalGlobalInternals = (globalThis as any).__TAURI_INTERNALS__;
    const originalWindow = (globalThis as any).window;
    const originalIsTauri = (globalThis as any).isTauri;
    delete (globalThis as any).__TAURI_INTERNALS__;
    (globalThis as any).isTauri = true;
    (globalThis as any).window = {
      __TAURI_INTERNALS__: {
        convertFileSrc: (filePath: string, protocol = "asset") => `${protocol}://localhost/${encodeURIComponent(filePath)}`,
      },
    };

    try {
      expect(resolveRenderableSpriteSrc("/tmp/demo.codex-pet/spritesheet.webp")).toBe(
        "asset://localhost/%2Ftmp%2Fdemo.codex-pet%2Fspritesheet.webp",
      );
    } finally {
      if (originalGlobalInternals === undefined) delete (globalThis as any).__TAURI_INTERNALS__;
      else (globalThis as any).__TAURI_INTERNALS__ = originalGlobalInternals;
      if (originalWindow === undefined) delete (globalThis as any).window;
      else (globalThis as any).window = originalWindow;
      if (originalIsTauri === undefined) delete (globalThis as any).isTauri;
      else (globalThis as any).isTauri = originalIsTauri;
    }
  });
});
