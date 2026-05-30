import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("Issue #98: Channel-first Gateway", () => {
  it("does not expose Provider Management as a separate area", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // Provider management should not be a standalone area
    expect(renderersSource).not.toMatch(/renderControlCenterProvidersArea/);
    expect(renderersSource).not.toMatch(/Provider Management/);
    expect(renderersSource).not.toMatch(/provider-card/);
  });

  it("does not have Provider navigation link", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // No nav link to providers area
    expect(renderersSource).not.toMatch(/data-nav-target="providers"/);
    expect(renderersSource).not.toMatch(/nav\.prov/);
  });

  it("does not have Provider CRUD controls", () => {
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    // No provider-specific CRUD handlers
    expect(controllerSource).not.toMatch(/bindProviderControls/);
    expect(controllerSource).not.toMatch(/data-provider-add/);
    expect(controllerSource).not.toMatch(/data-provider-health-check/);
    expect(controllerSource).not.toMatch(/data-provider-toggle/);
    expect(controllerSource).not.toMatch(/data-provider-failover/);
    expect(controllerSource).not.toMatch(/data-provider-delete/);
  });

  it("channel cards have enable/disable, delete, and edit actions", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // Channel cards should have real action controls
    expect(renderersSource).toMatch(/data-channel-edit/);
    expect(renderersSource).toMatch(/data-channel-delete/);
  });
});
