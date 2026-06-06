import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultCompanionSnapshot } from "../src/data/defaultSnapshot";
import { normalizePetAssetPack } from "../src/utils/petAssetPack";

const repoRoot = join(new URL("../../..", import.meta.url).pathname);

/**
 * yuanqi-mianmian spritesheet layout (6 columns × 9 rows, 256×208 per frame):
 *
 *   Row 0 (frames 0-5):   broken — frame 4 is a residual fragment, frame 5 is blank.
 *                          Playing these in sequence causes visible horizontal "scrolling".
 *   Row 1 (frames 6-11):  stable GIF-style idle candidate
 *   Row 2 (frames 12-17): stable GIF-style idle candidate
 *   Row 3 (frames 18-23): happy state
 *   Row 5 (frames 30-35): sleep state
 *   Row 8 (frames 48-53): degraded state
 *
 * The external pet.json ships with idle=[0,1,2,3,4,5] which is the broken row 0.
 * These tests ensure the normalization layer and the default snapshot never expose
 * frame sequences that contain known-blank or fragment frames from row 0.
 */

describe("spritesheet frame sequence sanity", () => {
  /**
   * Test 1: The default snapshot's embedded manifest must NOT include
   * frames 4 or 5 (the broken tail of row 0) in any playable state.
   * After the fix, idle should point to a stable row (e.g. row 1 = frames 6-11,
   * or a safe subset of row 0 like [0,1,2,3] only if verified non-scrolling).
   */
  it("default snapshot idle frames do not include empty padding columns", () => {
    const manifest = defaultCompanionSnapshot.companion.petAppearance.assetManifest;
    expect(manifest).toBeDefined();

    const idleFrames = manifest!.states!.idle!.frames!;
    // Columns 6 and 7 are padding — neither should appear in idle
    for (const f of idleFrames) {
      expect(f % 8).toBeLessThan(6);
    }

    // All idle frames should produce stable, non-scrolling GIF-style animation.
    // They must all sit on the same spritesheet row (same y-offset) so that
    // the character stays in place rather than sliding left-to-right.
    const columns = 8; // 1536px / 192px
    const rows = idleFrames.map((f: number) => Math.floor(f / columns));
    const uniqueRows = [...new Set(rows)];
    expect(uniqueRows).toHaveLength(1);
  });

  /**
   * Test 2: When normalizePetAssetPack receives the external yuanqi-mianmian
   * pet.json (which has idle=[0,1,2,3,4,5] and width=256), the normalization must
   * correct the grid to 192px width and remap state frames.
   */
  it("normalizePetAssetPack corrects yuanqi-mianmian grid layout and remaps frames", () => {
    const rawManifest = JSON.parse(
      readFileSync("/Users/ldh/Downloads/yuanqi-mianmian.codex-pet/pet.json", "utf8"),
    );

    const normalized = normalizePetAssetPack(
      rawManifest,
      "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet",
    );

    // Frame width should be corrected to 192, count to 72
    expect(normalized.manifest.frame?.width).toBe(192);
    expect(normalized.manifest.frame?.count).toBe(72);

    // After normalization, the idle sequence must be safe (no columns 6 or 7)
    const idleFrames = normalized.states.idle.frames!;
    for (const f of idleFrames) {
      expect(f % 8).toBeLessThan(6);
    }

    // Normalization should still leave the pack in a playable state
    expect(normalized.validation.level).not.toBe("error");
    expect(idleFrames.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * Bonus: no state in the default snapshot should reference the empty padding
   * columns (columns 6 and 7, i.e., f % 8 >= 6).
   */
  it("no default snapshot state references the empty columns 6 or 7", () => {
    const states = defaultCompanionSnapshot.companion.petAppearance.assetManifest?.states;
    expect(states).toBeDefined();

    for (const [stateName, sequence] of Object.entries(states!)) {
      if (sequence?.frames) {
        for (const f of sequence.frames) {
          expect(f % 8, `state '${stateName}' must not contain padding frame ${f}`).toBeLessThan(6);
        }
      }
    }
  });
});
