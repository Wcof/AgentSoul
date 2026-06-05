import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(new URL("../../..", import.meta.url).pathname);

describe("desktop body-first architecture", () => {
  it("adds the new top-level architecture seams", () => {
    const desktopBody = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "index.ts"), "utf8");
    const agentMind = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "agent-mind", "index.ts"), "utf8");
    const memory = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "memory", "index.ts"), "utf8");
    const extensionRuntime = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "extension-runtime", "index.ts"), "utf8");

    expect(desktopBody).toContain("renderDesktopCompanionSurface");
    expect(agentMind).toContain("runCompanionInteractionTurn");
    expect(memory).toContain("applyMasterModelEdit");
    expect(extensionRuntime).toContain("createExtensionRuntime");
  });

  it("documents the desktop body-first implementation plan", () => {
    const plan = readFileSync(join(repoRoot, "docs", "superpowers", "plans", "2026-06-03-desktop-body-first-implementation-plan.md"), "utf8");

    expect(plan).toContain("Desktop Body-first AgentSoul Implementation Plan");
    expect(plan).toContain("Desktop Body");
    expect(plan).toContain("Agent Mind");
    expect(plan).toContain("Extension Runtime");
  });

  it("routes the default entrypoint through Desktop Body instead of legacy control-center modules", () => {
    const main = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    expect(main).toContain("./desktop-body");
    expect(main).not.toContain("./shared/shell");
    expect(main).not.toContain("./shared/app-controller");
    expect(main).not.toContain("./utils/localControlClient");
    expect(main).not.toContain("GATEWAY_BASE");
    expect(main).not.toContain("gatewayAvailable");
    expect(main).not.toContain("authoritativeSnapshot");
  });

  it("keeps Desktop Body snapshot hydration focused on companion body state", () => {
    const bootstrap = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "desktop-body", "bootstrap.ts"), "utf8");
    const defaultSnapshot = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "data", "defaultSnapshot.ts"), "utf8");

    expect(bootstrap).toContain("loadDesktopBodySnapshot");
    expect(bootstrap).toContain("get_companion_runtime_state");
    expect(bootstrap).toContain("mergeDesktopBodyNativeState");
    for (const legacyTerm of [
      "localControlClient",
      "loadSnapshot",
      "authoritativeSnapshot",
      "gatewayAvailable",
      "costs:",
      "gateway:",
      "sessions:",
      "skills:",
      "mcpServers:",
      "prompts:",
      "safety:",
      "conversationDashboard:",
      "settings-full",
    ]) {
      expect(bootstrap).not.toContain(legacyTerm);
      expect(defaultSnapshot).not.toContain(legacyTerm);
    }
  });

  it("uses a narrow Desktop Body snapshot on the product path", () => {
    const types = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "types.ts"), "utf8");
    const productSources = [
      "desktop-body/bootstrap.ts",
      "desktop-body/interaction-actions.ts",
      "desktop-body/appearance-pack.ts",
      "desktop-body/status-actions.ts",
      "desktop-body/surface.ts",
      "desktop-body/menu.ts",
      "agent-mind/interaction-turn.ts",
      "agent-mind/autonomy-loop.ts",
      "shared/utils.ts",
    ].map((file) => readFileSync(join(repoRoot, "apps", "desktop-v2", "src", ...file.split("/")), "utf8")).join("\n");

    expect(types).toContain("interface DesktopBodySnapshot");
    expect(productSources).toContain("DesktopBodySnapshot");
    expect(productSources).not.toContain("CompanionRuntimeSnapshot");
    for (const legacyField of [
      "gateway",
      "costs",
      "skills",
      "sessions",
      "safety",
      "settings-full",
      "conversationDashboard",
      "mcpServers",
      "prompts",
    ]) {
      expect(productSources).not.toMatch(new RegExp(`snapshot\\.${legacyField}`));
    }
  });

  it("removes native control-center window and command from the product shell", () => {
    const config = JSON.parse(readFileSync(join(repoRoot, "apps", "desktop-v2", "src-tauri", "tauri.conf.json"), "utf8"));
    const rust = readFileSync(join(repoRoot, "apps", "desktop-v2", "src-tauri", "src", "lib.rs"), "utf8");

    expect(config.app.windows.map((window: { label: string }) => window.label)).toEqual(["desktop-companion"]);
    expect(rust).toContain("show_desktop_companion");
    expect(rust).not.toContain("show_control_center");
    expect(rust).not.toContain('"control-center"');
    expect(rust).not.toContain('"open-control-center"');
  });

  it("does not expose legacy Control Center modules through public frontend barrels", () => {
    const renderers = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "renderers.ts"), "utf8");
    const controller = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "controller.ts"), "utf8");
    const publicApi = `${renderers}\n${controller}`;

    expect(publicApi).toContain("./desktop-body");
    expect(publicApi).toContain("./agent-mind");
    expect(publicApi).toContain("./memory");
    expect(publicApi).toContain("./extension-runtime");
    for (const legacyTerm of [
      "renderAgentSoulShell",
      "renderControlCenter",
      "bindControlCenter",
      "createDesktopCompanionController",
      "./areas/gateway",
      "./areas/costs",
      "./areas/sessions",
      "./areas/skills",
      "./areas/mcp",
      "./areas/prompts",
      "./areas/safety",
      "./areas/conversations",
      "./areas/settings-full",
      "./shared/shell",
      "./shared/app-controller",
    ]) {
      expect(publicApi).not.toContain(legacyTerm);
    }
  });

  it("removes legacy Control Center area source modules from the desktop app", () => {
    const areasDir = join(repoRoot, "apps", "desktop-v2", "src", "areas");
    const legacyClientFiles = [
      "utils/localControlClient.ts",
      "utils/gatewayClient.ts",
      "shared/app-switcher.ts",
      "shared/usage-footer.ts",
      "shared/backup-controls.ts",
      "utils/channelModal.ts",
      "utils/dragReorder.ts",
      "utils/quickInputParser.ts",
    ].map((file) => join(repoRoot, "apps", "desktop-v2", "src", ...file.split("/")));
    const sharedSources = [
      "renderers.ts",
      "controller.ts",
    ].map((file) => readFileSync(join(repoRoot, "apps", "desktop-v2", "src", ...file.split("/")), "utf8")).join("\n");

    expect(existsSync(areasDir)).toBe(false);
    for (const legacyFile of legacyClientFiles) {
      expect(existsSync(legacyFile)).toBe(false);
    }
    expect(sharedSources).not.toContain("../areas/");
    expect(sharedSources).not.toContain("./areas/");
  });

  it("removes legacy Control Center vocabulary from product styles and resources", () => {
    const styles = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "styles.css"), "utf8");
    const en = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "i18n", "en.json"), "utf8");
    const zh = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "i18n", "zh.json"), "utf8");
    const types = readFileSync(join(repoRoot, "apps", "desktop-v2", "src", "types.ts"), "utf8");

    expect(styles).not.toMatch(/control-center|data-active-tab|settings-full|sessions-mgr/);
    expect(en).not.toMatch(/openControlCenter|controlCenter|Control Center/);
    expect(zh).not.toMatch(/openControlCenter|controlCenter|控制中心/);
    expect(types).not.toMatch(/ControlCenter|AreaContext|shellMode\?: "desktop-companion" \| "control-center"/);
  });
});
