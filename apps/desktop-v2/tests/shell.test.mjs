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
    expect(i18nSource).toMatch(/react-i18next/);
    expect(i18nSource).toMatch(/zh/);
    expect(i18nSource).toMatch(/en/);
  });

  it("includes locale switcher in the UI", () => {
    const source = readFileSync(join(appRoot, "src", "App.tsx"), "utf8");

    expect(source).toMatch(/locale/i);
    expect(source).toMatch(/toggleLocale/i);
  });
});
