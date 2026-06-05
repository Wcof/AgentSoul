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
        fps: 8,
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

    expect(normalized.validation.level).toBe("error");
    expect(normalized.states.idle.frames).toEqual([0]);
    expect(normalized.states.sleep.frames).toEqual([0]);
    expect(normalized.validation.messages.join(" ")).toMatch(/frame config missing/);
    expect(normalized.validation.messages.join(" ")).toMatch(/states missing/);
  });

  it("rejects thin codex-pet manifests instead of guessing frame grids", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "thin",
        displayName: "Thin",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
      },
      "/tmp/thin.codex-pet",
    );

    expect(normalized.validation.level).toBe("error");
    expect(normalized.validation.messages).toContain("error: frame config missing in pet.json");
    expect(normalized.validation.messages).toContain("error: states missing in pet.json");
    expect(normalized.states.idle.frames).toEqual([0]);
  });

  it("accepts state supersets without treating custom states as validation noise", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "superset",
        displayName: "Superset",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
        frame: { width: 128, height: 128, count: 8 },
        fps: 8,
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

  it("rejects default-only manifests that do not declare every core state", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "default-only",
        displayName: "Default Only",
        spritesheetPath: "spritesheet.webp",
        kind: "person",
        frame: { width: 128, height: 128, count: 24 },
        fps: 3,
        states: {
          default: { frames: [9], loop: true, fps: 3 },
        } as any,
      },
      "/tmp/default-only.codex-pet",
    );

    expect(normalized.validation.level).toBe("error");
    expect(normalized.states.idle.frames).toEqual([0]);
    expect(normalized.states.attention.frames).toEqual([0]);
    expect(normalized.states.sleep.fps).toBe(3);
    expect(normalized.validation.messages.filter((message) => message.includes("missing"))).toEqual([
      "error: states idle, blink, happy, attention, sleep, degraded missing in pet.json",
    ]);
  });

  it("rejects missing spritesheet paths while resolving to the stable default filename", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "no-sprite",
        displayName: "No Sprite",
        kind: "person",
        frame: { width: 128, height: 128, count: 1 },
        fps: 8,
        states: {
          idle: { frames: [0], loop: true },
          blink: { frames: [0], loop: true },
          happy: { frames: [0], loop: true },
          attention: { frames: [0], loop: true },
          sleep: { frames: [0], loop: true },
          degraded: { frames: [0], loop: true },
        },
      },
      "/tmp/no-sprite.codex-pet",
    );

    expect(normalized.validation.level).toBe("error");
    expect(normalized.manifest.spritesheetPath).toBe("/tmp/no-sprite.codex-pet/spritesheet.webp");
    expect(normalized.validation.messages).toContain(
      "error: spritesheetPath missing in pet.json",
    );
  });

  it("keeps nested relative spritesheet paths relative to the asset pack folder", () => {
    const normalized = normalizePetAssetPack(
      {
        id: "relative",
        displayName: "Relative",
        spritesheetPath: "sprites/main sheet.webp",
        kind: "person",
        frame: { width: 128, height: 128, count: 1 },
        fps: 8,
        states: {
          idle: { frames: [0], loop: true },
          blink: { frames: [0], loop: true },
          happy: { frames: [0], loop: true },
          attention: { frames: [0], loop: true },
          sleep: { frames: [0], loop: true },
          degraded: { frames: [0], loop: true },
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
