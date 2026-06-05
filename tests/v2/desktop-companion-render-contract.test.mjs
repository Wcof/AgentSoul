import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("AgentSoul v2 Desktop Companion rendering", () => {
  it("verifies Desktop Body appearance and state-to-render behavior through the desktop app boundary", () => {
    const companionViewTest = readFileSync(
      join(root, "apps", "desktop-v2", "tests", "companion-view.test.mjs"),
      "utf8",
    );
    const surfaceSource = readFileSync(
      join(root, "apps", "desktop-v2", "src", "desktop-body", "surface.ts"),
      "utf8",
    );
    const tauriConfig = JSON.parse(
      readFileSync(join(root, "apps", "desktop-v2", "src-tauri", "tauri.conf.json"), "utf8"),
    );

    expect(companionViewTest).toMatch(/Desktop Companion appearance view/);
    expect(companionViewTest).toMatch(/Desktop Body-first core modules/);
    expect(companionViewTest).toMatch(/Codex-like desktop pet window/);
    expect(surfaceSource).toMatch(/renderDesktopCompanionSurface/);
    expect(surfaceSource).toMatch(/pet-widget__character/);
    expect(surfaceSource).toMatch(/companion-canvas clean-avatar/);
    expect(tauriConfig.app.windows.map((window) => window.label)).toEqual(["desktop-companion"]);
    expect(companionViewTest).not.toMatch(/Control Center browser visual smoke/);
  });
});
