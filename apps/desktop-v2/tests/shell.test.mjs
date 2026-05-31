import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

/** Read all area + shared source files concatenated */
function readAllSources() {
  let combined = "";
  const areasDir = join(appRoot, "src", "areas");
  for (const area of readdirSync(areasDir)) {
    const areaPath = join(areasDir, area);
    if (!statSync(areaPath).isDirectory()) continue;
    for (const file of readdirSync(areaPath)) {
      if (file.endsWith(".ts")) {
        combined += readFileSync(join(areaPath, file), "utf8") + "\n";
      }
    }
  }
  const sharedDir = join(appRoot, "src", "shared");
  for (const file of readdirSync(sharedDir)) {
    if (file.endsWith(".ts")) {
      combined += readFileSync(join(sharedDir, file), "utf8") + "\n";
    }
  }
  // Also include barrel files
  combined += readFileSync(join(appRoot, "src", "renderers.ts"), "utf8") + "\n";
  combined += readFileSync(join(appRoot, "src", "controller.ts"), "utf8") + "\n";
  return combined;
}

describe("AgentSoul v2 desktop shell", () => {
  it("declares the local-first companion shell copy", () => {
    const source = readAllSources();

    expect(source).toMatch(/AgentSoul v2 desktop shell/);
    expect(source).toMatch(/Local-first AI Agent Companion/);
    expect(source).toMatch(/Desktop Companion and Control Center/);
  });

  it("supports a desktop-companion shell mode URL override for visual smoke testing", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(source).toMatch(/shellMode/);
    expect(source).toMatch(/desktop-companion/);
    expect(source).toMatch(/URLSearchParams/);
  });
});

describe("Control Center i18n integration", () => {
  it("imports i18n module and supports locale switching", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");
    const i18nSource = readFileSync(join(appRoot, "src", "i18n", "index.ts"), "utf8");

    expect(i18nSource).toMatch(/i18next/);
    expect(i18nSource).toMatch(/zh/);
    expect(i18nSource).toMatch(/en/);
  });

  it("includes locale switcher in the renderers", () => {
    const source = readAllSources();

    expect(source).toMatch(/locale/i);
    expect(source).toMatch(/data-locale-toggle/);
  });

  it("includes channel orchestration UI in the gateway area", () => {
    const source = readAllSources();

    expect(source).toMatch(/channel-orchestration/);
    expect(source).toMatch(/channel-card/);
    expect(source).toMatch(/data-channel-action/);
    expect(source).toMatch(/data-channel-edit/);
  });

  it("includes companion customization UI", () => {
    const source = readAllSources();

    expect(source).toMatch(/companion-customization/);
    expect(source).toMatch(/skin-preview/);
    expect(source).toMatch(/data-companion-field/);
    expect(source).toMatch(/data-skin-select/);
  });

  it("includes persona template cards in settings", () => {
    const source = readAllSources();

    expect(source).toMatch(/persona-grid/);
    expect(source).toMatch(/persona-card/);
    expect(source).toMatch(/data-persona-select/);
  });

  it("includes cost breakdown table with per-channel data", () => {
    const source = readAllSources();

    expect(source).toMatch(/cost-breakdown/);
    expect(source).toMatch(/cost-table/);
    expect(source).toMatch(/perChannel/);
  });
});
