import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Events to Growth Events", () => {
  it("exposes Runtime-owned Gateway Growth conversion", () => {
    const runtimeSource = readFileSync(join(root, "packages", "runtime", "src", "index.ts"), "utf8");
    const gatewaySource = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");

    assert.match(runtimeSource, /applyGatewayTrafficGrowth/);
    assert.match(runtimeSource, /gateway-traffic-v1/);
    assert.doesNotMatch(gatewaySource, /writeRuntimeState|companion_state|applyGatewayTrafficGrowth/);
  });

  it("verifies successful and failed Gateway traffic growth behavior", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Gateway Events to Growth Events/);
  });
});
