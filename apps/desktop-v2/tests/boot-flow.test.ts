import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("desktop-v2 boot flow", () => {
  it("boots through the Desktop Body bootstrap instead of legacy Control Center hydration", () => {
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");
    const bootstrapSource = readFileSync(join(appRoot, "src", "desktop-body", "bootstrap.ts"), "utf8");

    expect(mainSource).toMatch(/bootstrapDesktopBody/);
    expect(mainSource).not.toMatch(/createLocalControlClient/);
    expect(mainSource).not.toMatch(/controlClient\.loadSnapshot/);
    expect(mainSource).not.toMatch(/hydrateLocalPanelState/);
    expect(bootstrapSource).toMatch(/loadDesktopBodySnapshot/);
    expect(bootstrapSource).toMatch(/mergeDesktopBodyNativeState/);
  });

  it("does not restore retired dashboard modules from the product entrypoint", () => {
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(mainSource).not.toMatch(/keyTrend:\s*authoritativeSnapshot/);
    expect(mainSource).not.toMatch(/modelStats:\s*authoritativeSnapshot/);
    expect(mainSource).not.toMatch(/usageFooter:\s*authoritativeSnapshot/);
    expect(mainSource).not.toMatch(/backupList:\s*authoritativeSnapshot/);
    expect(mainSource).not.toMatch(/conversationDashboard:\s*authoritativeSnapshot/);
  });
});
