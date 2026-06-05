import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

function readDesktopBodyShellSources() {
  return [
    "main.ts",
    "renderers.ts",
    "controller.ts",
    "desktop-body/index.ts",
    "desktop-body/bootstrap.ts",
    "desktop-body/surface.ts",
    "desktop-body/menu.ts",
    "agent-mind/index.ts",
    "memory/index.ts",
    "extension-runtime/index.ts",
  ]
    .map((file) => readFileSync(join(appRoot, "src", ...file.split("/")), "utf8"))
    .join("\n");
}

describe("AgentSoul v2 Desktop Body shell", () => {
  it("uses a thin Desktop Body default entrypoint", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(source).toMatch(/bootstrapDesktopBody/);
    expect(source).toMatch(/\.\/desktop-body/);
    expect(source).not.toMatch(/shellMode/);
    expect(source).not.toMatch(/URLSearchParams/);
    expect(source).not.toMatch(/renderAgentSoulShell/);
  });

  it("keeps the shell vocabulary aligned with Desktop Body-first architecture", () => {
    const source = readDesktopBodyShellSources();

    expect(source).toMatch(/Desktop Body|bootstrapDesktopBody/);
    expect(source).toMatch(/Agent Mind|agent-mind|buildAgentMindPromptLayers/);
    expect(source).toMatch(/Memory|masterModel|memory/);
    expect(source).toMatch(/Extension Runtime|createExtensionRuntime/);
    expect(source).not.toMatch(/Control Center task navigation/);
    expect(source).not.toMatch(/data-nav-target/);
  });
});

describe("Desktop Body i18n resources", () => {
  it("keeps bilingual resources available without routing through Control Center renderers", () => {
    const i18nSource = readFileSync(join(appRoot, "src", "i18n", "index.ts"), "utf8");
    const en = readFileSync(join(appRoot, "src", "i18n", "en.json"), "utf8");
    const zh = readFileSync(join(appRoot, "src", "i18n", "zh.json"), "utf8");

    expect(i18nSource).toMatch(/i18next/);
    expect(i18nSource).toMatch(/zh/);
    expect(i18nSource).toMatch(/en/);
    expect(en).toMatch(/Desktop Body|desktop companion/i);
    expect(zh).toMatch(/Desktop Body|桌面|伴侣/);
  });
});
