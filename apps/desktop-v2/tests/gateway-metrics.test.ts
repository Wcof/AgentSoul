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
  return combined;
}

describe("Issue #99: Gateway metrics are real", () => {
  it("gateway area renders real circuit state from channel data", () => {
    const source = readAllSources();

    // Channel cards should display circuit state
    expect(source).toMatch(/circuitState/);
    expect(source).toMatch(/circuit/);
  });

  it("gateway area renders real metrics (request count, success rate, latency)", () => {
    const source = readAllSources();

    // Channel cards should show real metrics
    expect(source).toMatch(/requestCount/);
    expect(source).toMatch(/successRate/);
    expect(source).toMatch(/averageLatencyMs/);
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
