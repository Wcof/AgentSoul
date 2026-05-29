import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Audit Records", () => {
  it("exposes metadata-only Gateway Audit persistence boundaries", () => {
    const source = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");

    expect(source).toMatch(/createGatewayAuditRepository/);
    expect(source).toMatch(/TrafficMetadata/);
    expect(source).toMatch(/estimatedCost/);
    expect(source).toMatch(/summarizeCostTrends/);
    expect(source).toMatch(/dailyCosts/);
    expect(source).toMatch(/modelMix/);
    expect(source).toMatch(/providerMix/);
    expect(source).not.toMatch(/requestBody|responseBody|promptBody/i);
  });

  it("verifies metadata inclusion and body exclusion", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway Audit Records/);
  });
});
