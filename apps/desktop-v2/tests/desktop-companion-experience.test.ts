import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { defaultCompanionSnapshot } from "../src/data/defaultSnapshot";
import { buildDesktopCompanionExperience } from "../src/desktop-body";
import { projectAutonomyRuntime } from "../src/agent-mind";
import { runCompanionInteractionTurn } from "../src/agent-mind";
import { bindDesktopCompanionSurface, renderDesktopCompanionSurface } from "../src/desktop-body";
import { applyMasterModelEdit } from "../src/memory";

const repoRoot = join(new URL("../../..", import.meta.url).pathname);

describe("desktop companion experience", () => {
  it("uses the yuanqi-mianmian codex-pet asset pack as the default desktop appearance", () => {
    const experience = buildDesktopCompanionExperience(defaultCompanionSnapshot);

    expect(experience.appearance.assetPackPath).toBe("/Users/ldh/Downloads/yuanqi-mianmian.codex-pet");
    expect(experience.appearance.spritesheetPath).toBe("/Users/ldh/Downloads/yuanqi-mianmian.codex-pet/spritesheet.webp");
    expect(experience.appearance.assetPackId).toBe("yuanqi-mianmian");
  });

  it("keeps the default yuanqi-mianmian fallback manifest aligned with the real asset pack", () => {
    const manifest = JSON.parse(readFileSync("/Users/ldh/Downloads/yuanqi-mianmian.codex-pet/pet.json", "utf8"));
    const fallback = defaultCompanionSnapshot.companion.petAppearance.assetManifest;

    expect(fallback?.frame).toEqual(manifest.frame);
    expect(fallback?.fps).toBe(manifest.fps);
    expect(fallback?.states?.idle?.frames).toEqual([0, 1, 2, 3]);
    expect(fallback?.states?.happy?.frames).toEqual([18, 19, 20]);
    expect(fallback?.states?.attention?.frames).toEqual([0, 1, 2, 3]);
    expect(fallback?.states?.degraded?.frames).toEqual([48, 49, 50, 51]);
    expect(defaultCompanionSnapshot.companion.petAppearance.assetValidation?.level).toBe("ok");
  });

  it("uses embedded spritesheet data URLs for native pet rendering without reintroducing a control-center shortcut", () => {
    const typesSource = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "types.ts"), "utf8");
    const canvasSource = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "animation.ts"), "utf8");
    const rustSource = readFileSync(join(repoRoot, "apps", "desktop-v2", "src-tauri", "src", "lib.rs"), "utf8");
    const surfaceSource = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "surface.ts"), "utf8");

    expect(typesSource).toContain("spritesheetDataUrl");
    expect(canvasSource).toMatch(/spritesheetDataUrl[\s\S]*resolveRenderableSpriteSrc/);
    expect(rustSource).toContain("read_spritesheet_data_url");
    expect(rustSource).toContain("data:{mime};base64");
    expect(surfaceSource).not.toContain('data-pet-tool="control-center"');
    expect(surfaceSource).not.toContain('addEventListener("dblclick"');
    expect(surfaceSource).not.toContain("surfaceOpenControlCenterWindow");
  });

  it("builds a Hermes-style three-layer prompt context for inline desktop chat", () => {
    const experience = buildDesktopCompanionExperience(defaultCompanionSnapshot);

    expect(experience.chatContext.companionId).toBe("active-companion");
    expect(experience.chatContext.companionName).toBe("元气眠眠");
    expect(experience.promptLayers.stable).toContain("Soul Document");
    expect(experience.promptLayers.stable).toContain("身份：元气眠眠");
    expect(experience.promptLayers.context).toContain("PAD");
    expect(experience.promptLayers.context).toContain("情感状态");
    expect(experience.promptLayers.context).toContain("主人画像");
    expect(experience.promptLayers.volatile).toContain("session");
    expect(experience.promptLayers.volatile).toContain("memory");
    expect(experience.promptLayers.volatile).toContain("会话上下文");
  });

  it("uses browser-safe companion prompt imports in the desktop bundle", () => {
    const source = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "menu.ts"), "utf8");
    const companionPackage = JSON.parse(readFileSync(join(repoRoot, "packages", "companion", "package.json"), "utf8"));

    expect(source).toContain("@agentsoul/companion/prompt");
    expect(source).toContain("@agentsoul/companion/soul");
    expect(source).not.toContain('from "@agentsoul/companion"');
    expect(companionPackage.exports["./prompt"]).toBeTruthy();
    expect(companionPackage.exports["./soul"]).toBeTruthy();
  });

  it("keeps desktop surface rendering separate from Desktop Body runtime actions", () => {
    const surfaceSource = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "surface.ts"), "utf8");
    const desktopBodyIndex = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "index.ts"), "utf8");

    expect(desktopBodyIndex).toContain("./appearance-pack");
    expect(desktopBodyIndex).toContain("./window");
    expect(desktopBodyIndex).toContain("./status-actions");
    expect(desktopBodyIndex).toContain("./interaction-actions");
    expect(surfaceSource).toContain("./appearance-pack");
    expect(surfaceSource).toContain("./window");
    expect(surfaceSource).toContain("./status-actions");
    expect(surfaceSource).toContain("./interaction-actions");
    expect(surfaceSource).not.toContain("./utils/tauriIpc");
    expect(surfaceSource).not.toContain("./utils/modal");
    expect(surfaceSource).not.toContain("./companion-interaction-turn");
    expect(surfaceSource).not.toContain("tauriInvoke");
    expect(surfaceSource).not.toContain("runCompanionInteractionTurn");
    expect(surfaceSource).not.toContain("window.location.reload");
    expect(surfaceSource).not.toContain("import_pet_asset_pack");
    expect(surfaceSource).not.toContain("load_pet_asset_pack");
    expect(surfaceSource).not.toContain("hide_desktop_companion");
  });

  it("renders desktop surface as pet-only until the context menu is opened", () => {
    const target = { innerHTML: "" };
    renderDesktopCompanionSurface({ target: target as HTMLElement, snapshot: defaultCompanionSnapshot });

    expect(target.innerHTML).toContain("pet-widget__character");
    expect(target.innerHTML).toContain("data-tauri-drag-region");
    expect(target.innerHTML).not.toContain("pet-widget__status");
    expect(target.innerHTML).not.toContain("data-companion-inline-form");
    expect(target.innerHTML).not.toContain("data-companion-inline-input");
    expect(target.innerHTML).not.toContain("data-companion-inline-submit");
    for (const action of ["feed", "play", "pet", "sleep"]) {
      expect(target.innerHTML).not.toContain(`data-interaction="${action}"`);
    }
  });

  it("sizes the native desktop window as a compact pet-only surface", () => {
    const config = JSON.parse(readFileSync(join(repoRoot, "apps", "desktop-v2", "src-tauri", "tauri.conf.json"), "utf8"));
    const companionWindow = config.app.windows.find((window: { label: string }) => window.label === "desktop-companion");

    expect(companionWindow.width).toBeLessThanOrEqual(280);
    expect(companionWindow.height).toBeLessThanOrEqual(280);
    expect(companionWindow.minWidth).toBeGreaterThanOrEqual(240);
    expect(companionWindow.minHeight).toBeGreaterThanOrEqual(240);
    expect(companionWindow.transparent).toBe(true);
    expect(companionWindow.decorations).toBe(false);
    expect(companionWindow.alwaysOnTop).toBe(true);
  });

  it("keeps manual desktop pet placement instead of auto-snapping after drag", () => {
    const source = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "utils", "windowSnap.ts"), "utf8");

    expect(source).toContain("saveWindowPosition");
    expect(source).toContain("restoreWindowPosition");
    expect(source).not.toContain("SNAP_THRESHOLD");
    expect(source).not.toContain("saveSnapEdge");
  });

  it("binds inline desktop text submission through the companion chat endpoint", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ body: any }> = [];
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push({ body: init?.body ? JSON.parse(init.body as string) : null });
      return new Response(JSON.stringify({ choices: [{ message: { content: "收到，我在桌面陪你。" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    let submitHandler: ((event: Event) => void) | undefined;
    let bubbleText = "";
    const input = { value: "陪我工作" };
    const form = {
      addEventListener: (_event: string, handler: (event: Event) => void) => {
        submitHandler = handler;
      },
      querySelector: (selector: string) => selector === "[data-companion-inline-input]" ? input : null,
    };
    const bubble = {
      set textContent(value: string) { bubbleText = value; },
      get textContent() { return bubbleText; },
    };
    const target = {
      innerHTML: "",
      querySelectorAll: (selector: string) => selector === "[data-companion-inline-form]" ? [form] : [],
      querySelector: (selector: string) => selector === ".pet-widget__bubble" ? bubble : null,
    } as unknown as HTMLElement;

    const renders: string[] = [];
    const controller = {
      performInteraction: async () => {},
      render: (_snapshot: typeof defaultCompanionSnapshot, status?: string) => {
        renders.push(status ?? "");
      },
    };

    try {
      bindDesktopCompanionSurface({
        target,
        controller,
        getSnapshot: () => defaultCompanionSnapshot,
        applySnapshot: (_snapshot, status) => {
          renders.push(status);
        },
      });
      submitHandler?.({ preventDefault() {} } as Event);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(calls[0].body.message).toBe("陪我工作");
      expect(calls[0].body.companionName).toBe("元气眠眠");
      expect(bubbleText).toContain("收到，我在桌面陪你。");
      expect(renders.some((status) => status.includes("收到"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("runs a companion interaction turn that owns chat payload, bubble, and snapshot updates", async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ body: any }> = [];
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push({ body: init?.body ? JSON.parse(init.body as string) : null });
      return new Response(JSON.stringify({ choices: [{ message: { content: "收到，继续专注。" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const turn = await runCompanionInteractionTurn({
        message: "陪我写代码",
        snapshot: defaultCompanionSnapshot,
      });

      expect(calls[0].body.message).toBe("陪我写代码");
      expect(calls[0].body.companionName).toBe("元气眠眠");
      expect(calls[0].body.companionContext.pad).toEqual({ pleasure: 0, arousal: 0, dominance: 0 });
      expect(calls[0].body.companionContext.vitals.energy).toBe(100);
      expect(calls[0].body.companionContext.masterModel.basic.name).toBe("主人");
      expect(turn.bubbleText).toBe("收到，继续专注。");
      expect(turn.nextSnapshot.companion.summary).toBe("收到，继续专注。");
      expect(turn.nextSnapshot.companion.activityState).toBe("happy");
      expect(turn.nextSnapshot.companion.autonomy?.companionMode).toBe("CONVERSING");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("projects autonomy runtime into one desktop-ready view", () => {
    const projected = projectAutonomyRuntime({
      snapshot: {
        ...defaultCompanionSnapshot,
        companion: {
          ...defaultCompanionSnapshot.companion,
          summary: "Local runtime pending",
          vitals: { ...defaultCompanionSnapshot.companion.vitals, companionEnergy: 12 },
          autonomy: {
            userPresence: "ACTIVE",
            companionMode: "QUEUING",
            lastEventPriority: "HIGH",
            lastOutputStrategy: "queue",
            queuedOutputCount: 2,
            lastAction: "surface-memory-or-status",
          },
        },
      },
    });

    expect(projected.autonomy.queuedOutputCount).toBe(2);
    expect(projected.bubbleText).toContain("2");
    expect(projected.visualState).toBe("attention");
    expect(projected.labels.userPresence).toBe("正在交互");
    expect(projected.labels.companionMode).toBe("等待输出");
    expect(projected.labels.outputStrategy).toBe("排队");
  });

  it("renders and binds desktop companion context menu surface through one module", async () => {
    let submitHandler: ((event: Event) => void) | undefined;
    let bubbleText = "";
    const input = { value: "你好" };
    const form = {
      addEventListener: (_event: string, handler: (event: Event) => void) => {
        submitHandler = handler;
      },
      querySelector: (selector: string) => selector === "[data-companion-inline-input]" ? input : null,
      dispatchEvent: (event: Event) => {
        submitHandler?.(event);
        return true;
      },
    };
    const bubble = {
      set textContent(value: string) { bubbleText = value; },
      get textContent() { return bubbleText; },
    };
    const target = {
      innerHTML: "",
      querySelectorAll: (selector: string) => selector === "[data-companion-inline-form]" ? [form] : [],
      querySelector: (selector: string) => {
        if (selector === "[data-companion-inline-input]") return input;
        if (selector === "[data-companion-inline-form]") return form;
        if (selector === ".pet-widget__bubble") return bubble;
        return null;
      },
    } as unknown as HTMLElement;
    renderDesktopCompanionSurface({ target, snapshot: defaultCompanionSnapshot, menuOpen: true });

    expect(target.innerHTML).toContain("pet-widget__bubble");
    expect(target.innerHTML).toContain("data-companion-inline-form");
    expect(target.innerHTML).toContain('data-interaction="feed"');

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => new Response(JSON.stringify({ choices: [{ message: { content: "桌面收到。" } }] }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
    const statuses: string[] = [];
    const controller = { performInteraction: async () => {}, render: () => {} };

    try {
      bindDesktopCompanionSurface({
        target,
        controller,
        getSnapshot: () => defaultCompanionSnapshot,
        applySnapshot: (_snapshot, status) => statuses.push(status),
      });
      form.dispatchEvent({ preventDefault() {} } as Event);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(bubbleText).toContain("桌面收到。");
      expect(statuses.some((status) => status.includes("桌面收到"))).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("applies Master Model record, advance, and forget edits to the runtime snapshot", () => {
    const recorded = applyMasterModelEdit({
      snapshot: defaultCompanionSnapshot,
      action: { kind: "record", claim: "主人喜欢短句反馈", evidence: ["桌面对话"], confidence: 0.8 },
    });
    const observation = recorded.companion.masterModel?.learningState.observations[0];

    expect(observation?.claim).toBe("主人喜欢短句反馈");

    const verified = applyMasterModelEdit({
      snapshot: recorded,
      action: { kind: "advance", observationId: observation!.id, stage: "verification" },
    });

    expect(verified.companion.masterModel?.learningState.verifiedFacts[0].claim).toBe("主人喜欢短句反馈");

    const forgotten = applyMasterModelEdit({
      snapshot: verified,
      action: { kind: "forget", observationId: observation!.id },
    });

    expect(forgotten.companion.masterModel?.learningState.verifiedFacts).toHaveLength(0);
  });
});
