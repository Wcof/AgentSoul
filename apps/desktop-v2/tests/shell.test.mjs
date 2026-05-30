import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("AgentSoul v2 desktop shell", () => {
  it("declares the local-first companion shell copy", () => {
    const source = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(source).toMatch(/AgentSoul v2 desktop shell/);
    expect(source).toMatch(/Local-first AI Agent Companion/);
    expect(source).toMatch(/Desktop Companion and Control Center/);
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
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/locale/i);
    expect(renderersSource).toMatch(/data-locale-toggle/);
  });

  it("includes channel orchestration UI in the gateway area", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/channel-orchestration/);
    expect(renderersSource).toMatch(/channel-card/);
    expect(renderersSource).toMatch(/data-channel-action/);
    expect(renderersSource).toMatch(/data-channel-edit/);
  });

  it("includes companion customization UI", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/companion-customization/);
    expect(renderersSource).toMatch(/skin-preview/);
    expect(renderersSource).toMatch(/data-companion-field/);
    expect(renderersSource).toMatch(/data-skin-select/);
  });

  it("includes persona template cards in settings", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/persona-grid/);
    expect(renderersSource).toMatch(/persona-card/);
    expect(renderersSource).toMatch(/data-persona-select/);
  });

  it("includes cost breakdown table with per-channel data", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/cost-breakdown/);
    expect(renderersSource).toMatch(/cost-table/);
    expect(renderersSource).toMatch(/perChannel/);
  });
});
