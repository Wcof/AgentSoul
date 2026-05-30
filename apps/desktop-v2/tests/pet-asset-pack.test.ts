import { describe, expect, it } from "vitest";
import { normalizePetAssetPack } from "../src/utils/petAssetPack";

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
});
