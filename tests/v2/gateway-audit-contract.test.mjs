import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Audit Records", () => {
  it("exposes metadata-only Gateway Audit persistence boundaries", () => {
    const indexSource = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");
    const auditSource = readFileSync(join(root, "packages", "gateway", "src", "audit", "repository.ts"), "utf8");

    // Audit repository and re-exports
    expect(indexSource).toMatch(/createGatewayAuditRepository/);
    expect(indexSource).toMatch(/TrafficMetadata/);
    // Implementation details live in audit/repository.ts
    expect(auditSource).toMatch(/estimatedCost/);
    expect(auditSource).toMatch(/summarizeCostTrends/);
    expect(auditSource).toMatch(/dailyCosts/);
    expect(auditSource).toMatch(/modelMix/);
    expect(auditSource).toMatch(/providerMix/);
    expect(auditSource).not.toMatch(/requestBody|responseBody|promptBody/i);
  });

  it("verifies metadata inclusion and body exclusion", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway Audit Records/);
  });
});
