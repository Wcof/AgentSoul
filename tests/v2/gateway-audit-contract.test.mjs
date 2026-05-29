import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Audit Records", () => {
  it("exposes metadata-only Gateway Audit persistence boundaries", () => {
    const source = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");

    assert.match(source, /createGatewayAuditRepository/);
    assert.match(source, /TrafficMetadata/);
    assert.match(source, /estimatedCost/);
    assert.match(source, /summarizeCostTrends/);
    assert.match(source, /dailyCosts/);
    assert.match(source, /modelMix/);
    assert.match(source, /providerMix/);
    assert.doesNotMatch(source, /requestBody|responseBody|promptBody/i);
  });

  it("verifies metadata inclusion and body exclusion", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Gateway Audit Records/);
  });
});
