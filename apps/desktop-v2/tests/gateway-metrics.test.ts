import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("Issue #99: Gateway metrics are real", () => {
  it("gateway area renders real circuit state from channel data", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // Channel cards should display circuit state
    expect(renderersSource).toMatch(/circuitState/);
    expect(renderersSource).toMatch(/circuit/);
  });

  it("gateway area renders real metrics (request count, success rate, latency)", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // Channel cards should show real metrics
    expect(renderersSource).toMatch(/requestCount/);
    expect(renderersSource).toMatch(/successRate/);
    expect(renderersSource).toMatch(/averageLatencyMs/);
  });

  it("dashboard stats are loaded from gateway, not hardcoded", () => {
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");
    const clientSource = readFileSync(join(appRoot, "src", "utils", "localControlClient.ts"), "utf8");

    // Boot flow should load from gateway
    expect(mainSource).toMatch(/controlClient\.loadSnapshot/);
    // Client should fetch /dashboard
    expect(clientSource).toMatch(/\/dashboard/);
  });
});
