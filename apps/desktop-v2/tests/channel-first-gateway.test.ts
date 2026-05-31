import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

function readAllSources() {
  let combined = "";
  const areasDir = join(appRoot, "src", "areas");
  for (const area of readdirSync(areasDir)) {
    const areaPath = join(areasDir, area);
    if (!statSync(areaPath).isDirectory()) continue;
    for (const file of readdirSync(areaPath)) {
      if (file.endsWith(".ts")) combined += readFileSync(join(areaPath, file), "utf8") + "\n";
    }
  }
  const sharedDir = join(appRoot, "src", "shared");
  for (const file of readdirSync(sharedDir)) {
    if (file.endsWith(".ts")) combined += readFileSync(join(sharedDir, file), "utf8") + "\n";
  }
  combined += readFileSync(join(appRoot, "src", "renderers.ts"), "utf8") + "\n";
  combined += readFileSync(join(appRoot, "src", "controller.ts"), "utf8") + "\n";
  return combined;
}

describe("Issue #98: Channel-first Gateway", () => {
  it("does not expose Provider Management as a separate area", () => {
    const renderersSource = readAllSources();

    // Provider management should not be a standalone area
    expect(renderersSource).not.toMatch(/renderControlCenterProvidersArea/);
    expect(renderersSource).not.toMatch(/Provider Management/);
    expect(renderersSource).not.toMatch(/provider-card/);
  });

  it("does not have Provider navigation link", () => {
    const renderersSource = readAllSources();

    // No nav link to providers area
    expect(renderersSource).not.toMatch(/data-nav-target="providers"/);
    expect(renderersSource).not.toMatch(/nav\.prov/);
  });

  it("does not have Provider CRUD controls", () => {
    const controllerSource = readAllSources();

    // No provider-specific CRUD handlers
    expect(controllerSource).not.toMatch(/bindProviderControls/);
    expect(controllerSource).not.toMatch(/data-provider-add/);
    expect(controllerSource).not.toMatch(/data-provider-health-check/);
    expect(controllerSource).not.toMatch(/data-provider-toggle/);
    expect(controllerSource).not.toMatch(/data-provider-failover/);
    expect(controllerSource).not.toMatch(/data-provider-delete/);
  });

  it("channel cards have enable/disable, delete, and edit actions", () => {
    const renderersSource = readAllSources();

    // Channel cards should have real action controls
    expect(renderersSource).toMatch(/data-channel-edit/);
    expect(renderersSource).toMatch(/data-channel-delete/);
  });
});
