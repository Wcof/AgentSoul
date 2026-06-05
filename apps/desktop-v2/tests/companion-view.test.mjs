import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

function readDesktopBodySources() {
  let combined = "";
  for (const file of [
    "main.ts",
    "renderers.ts",
    "controller.ts",
    "types.ts",
    "desktop-body/index.ts",
    "desktop-body/bootstrap.ts",
    "desktop-body/surface.ts",
    "desktop-body/menu.ts",
    "agent-mind/interaction-turn.ts",
    "agent-mind/autonomy-loop.ts",
    "memory/correction.ts",
    "memory/index.ts",
    "agent-mind/index.ts",
    "extension-runtime/index.ts",
    "data/defaultSnapshot.ts",
  ]) {
    combined += readFileSync(join(appRoot, "src", ...file.split("/")), "utf8") + "\n";
  }
  return combined;
}

function readDesktopBodyImplementationSources() {
  let combined = "";
  for (const file of [
    "main.ts",
    "renderers.ts",
    "controller.ts",
    "desktop-body/index.ts",
    "desktop-body/bootstrap.ts",
    "desktop-body/surface.ts",
    "desktop-body/menu.ts",
    "agent-mind/interaction-turn.ts",
    "agent-mind/autonomy-loop.ts",
    "memory/correction.ts",
    "memory/index.ts",
    "agent-mind/index.ts",
    "extension-runtime/index.ts",
  ]) {
    combined += readFileSync(join(appRoot, "src", ...file.split("/")), "utf8") + "\n";
  }
  return combined;
}

describe("Desktop Companion appearance view", () => {
  it("renders Desktop Body surface and basic Companion states from runtime snapshots", () => {
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");
    const renderersSource = readDesktopBodySources();

    expect(renderersSource).toMatch(/renderDesktopCompanionSurface/);
    expect(renderersSource).toMatch(/buildDesktopCompanionExperience/);
    expect(renderersSource).toMatch(/PetAppearanceSnapshot/);
    expect(typesSource).toMatch(/idle/);
    expect(typesSource).toMatch(/positive/);
    expect(typesSource).toMatch(/fatigue/);
    expect(typesSource).toMatch(/sleep/);
    expect(typesSource).toMatch(/attention/);
  });

  it("keeps rendering terms aligned with the AgentSoul Companion glossary", () => {
    const renderersSource = readDesktopBodySources();

    expect(renderersSource).toMatch(/Companion/);
    expect(renderersSource).toMatch(/bootstrapDesktopBody/);
    expect(renderersSource).toMatch(/projectAutonomyRuntime/);
    expect(renderersSource).toMatch(/createExtensionRuntime/);
    expect(renderersSource).not.toMatch(/separate character|active pet/i);
  });
});

describe("Desktop Companion interaction command flow", () => {
  it("routes user interaction through Desktop Body and Agent Mind modules", () => {
    const renderersSource = readDesktopBodySources();
    const controllerSource = readDesktopBodySources();
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");

    expect(controllerSource).toMatch(/bootstrapDesktopBody/);
    expect(controllerSource).toMatch(/bindDesktopCompanionSurface/);
    expect(controllerSource).toMatch(/runCompanionInteractionTurn/);
    expect(renderersSource).toMatch(/Feed/);
    expect(renderersSource).toMatch(/Play/);
    expect(renderersSource).toMatch(/Pet/);
    expect(renderersSource).toMatch(/Sleep/);
    expect(typesSource).toMatch(/blocked-low-energy/);
    expect(controllerSource).toMatch(/performInteraction/);
  });
});

describe("Desktop Companion approval flow", () => {
  it("keeps high-risk follow-up outside the old page shell", () => {
    const renderersSource = readDesktopBodySources();
    const controllerSource = readDesktopBodySources();

    expect(renderersSource).toMatch(/projectAutonomyRuntime/);
    expect(controllerSource).not.toMatch(/data-approval-decision="allowed"/);
    expect(controllerSource).not.toMatch(/data-approval-decision="denied"/);
    expect(controllerSource).not.toMatch(/renderAgentSoulShell/);
  });
});

describe("Desktop Companion risk notice flow", () => {
  it("does not reintroduce the old Risk Notice page shell into Desktop Body", () => {
    const renderersSource = readDesktopBodyImplementationSources();

    expect(renderersSource).toMatch(/runCompanionInteractionTurn/);
    expect(renderersSource).not.toMatch(/renderRiskNotices/);
    expect(renderersSource).not.toMatch(/Risk Notice/);
    expect(renderersSource).not.toMatch(/Approval Required/);
    expect(renderersSource).not.toMatch(/Client Authorization Mode/);
    expect(renderersSource).not.toMatch(/data-risk-notice-decision/);
  });
});

describe("Desktop Body-first core modules", () => {
  it("exposes Desktop Body, Agent Mind, Memory, and Extension Runtime without Control Center areas", () => {
    const source = readDesktopBodySources();

    expect(source).toMatch(/bootstrapDesktopBody/);
    expect(source).toMatch(/renderDesktopCompanionSurface/);
    expect(source).toMatch(/runCompanionInteractionTurn/);
    expect(source).toMatch(/applyMasterModelEdit/);
    expect(source).toMatch(/createExtensionRuntime/);
    expect(source).not.toMatch(/renderControlCenter/);
    expect(source).not.toMatch(/data-nav-target/);
    for (const area of ["gateway", "costs", "sessions", "skills", "mcp", "prompts", "safety", "conversations", "settings-full"]) {
      expect(source).not.toMatch(new RegExp(`data-control-area="${area}"`));
    }
  });
});

describe("Canvas 2D animation engine", () => {
  it("exports Canvas renderer and animation loop functions", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "desktop-body", "animation.ts"), "utf8");

    expect(canvasSource).toMatch(/Canvas 2D 动画引擎/);
    expect(canvasSource).toMatch(/createCanvasRenderer/);
    expect(canvasSource).toMatch(/startAnimationLoop/);
    expect(canvasSource).toMatch(/drawSlime/);
    expect(canvasSource).toMatch(/drawCat/);
    expect(canvasSource).toMatch(/drawStatusBubble/);
    expect(canvasSource).toMatch(/drawInteractionButtons/);
  });

  it("uses codex-pet asset packs as the primary desktop pet renderer", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "desktop-body", "animation.ts"), "utf8");
    const assetSource = readFileSync(join(appRoot, "src", "utils", "petAssetPack.ts"), "utf8");
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");

    expect(canvasSource).toMatch(/drawFromAssetPack/);
    expect(canvasSource).toMatch(/normalizePetAssetPack/);
    expect(canvasSource).toMatch(/chromaKey/);
    expect(canvasSource).toMatch(/clean-avatar/);
    expect(assetSource).toMatch(/REQUIRED_STATES/);
    for (const state of ["idle", "blink", "happy", "attention", "sleep", "degraded"]) {
      expect(assetSource).toMatch(new RegExp(state));
      expect(typesSource).toMatch(new RegExp(state));
    }
  });

  it("keeps codex-pet desktop rendering faithful without extra motion effects", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "desktop-body", "animation.ts"), "utf8");
    const surfaceSource = readFileSync(join(appRoot, "src", "desktop-body", "surface.ts"), "utf8");
    const stylesSource = readFileSync(join(appRoot, "src", "styles.css"), "utf8");

    expect(canvasSource).not.toMatch(/bounce/);
    expect(canvasSource).not.toMatch(/globalAlpha = state === "fatigue"/);
    expect(surfaceSource).not.toMatch(/performInteraction\("pet"\)/);
    expect(stylesSource).not.toMatch(/drop-shadow/);
    expect(stylesSource).not.toMatch(/pulseAura/);
  });

  it("supports slime and cat appearance rendering", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "desktop-body", "animation.ts"), "utf8");
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");

    expect(canvasSource).toMatch(/slime/);
    expect(canvasSource).toMatch(/cat/);
    expect(typesSource).toMatch(/custom/);
    expect(canvasSource).toMatch(/appearance\.kind/);
  });

  it("renders status bubbles for all visual states", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "desktop-body", "animation.ts"), "utf8");

    expect(canvasSource).toMatch(/idle/);
    expect(canvasSource).toMatch(/positive/);
    expect(canvasSource).toMatch(/fatigue/);
    expect(canvasSource).toMatch(/sleep/);
    expect(canvasSource).toMatch(/attention/);
  });

  it("includes interaction button rendering", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "desktop-body", "animation.ts"), "utf8");

    expect(canvasSource).toMatch(/Feed/);
    expect(canvasSource).toMatch(/Play/);
    expect(canvasSource).toMatch(/Pet/);
    expect(canvasSource).toMatch(/Sleep/);
  });
});

describe("Codex-like desktop pet window", () => {
  it("declares Desktop Body as the only transparent frameless always-on-top product window", () => {
    const config = JSON.parse(readFileSync(join(appRoot, "src-tauri", "tauri.conf.json"), "utf8"));
    const companionWindow = config.app.windows.find((window) => window.label === "desktop-companion");
    const surfaceSource = readFileSync(join(appRoot, "src", "desktop-body", "surface.ts"), "utf8");

    expect(companionWindow).toMatchObject({
      alwaysOnTop: true,
      transparent: true,
      decorations: false,
      resizable: false,
    });
    expect(config.app.macOSPrivateApi).toBe(true);
    expect(companionWindow.width).toBeLessThanOrEqual(340);
    expect(companionWindow.height).toBeLessThanOrEqual(280);
    expect(config.app.windows.map((window) => window.label)).toEqual(["desktop-companion"]);
    expect(surfaceSource).toMatch(/pet-widget__character/);
    expect(surfaceSource).toMatch(/contextmenu/);
    expect(surfaceSource).toMatch(/switchPetAssetPackInteractively/);
    expect(surfaceSource).toMatch(/showDesktopBodyStatus/);
    expect(surfaceSource).toMatch(/hideDesktopBodyWindow/);
    expect(surfaceSource).toMatch(/pet-widget-hit/);
    expect(surfaceSource).toMatch(/bindDesktopCompanionSurface/);
  });
});
