import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Events to Growth Events", () => {
  it("exposes Runtime-owned Gateway Growth conversion", () => {
    const runtimeSource = readFileSync(join(root, "packages", "runtime", "src", "index.ts"), "utf8");
    const gatewaySource = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");

    expect(runtimeSource).toMatch(/applyGatewayTrafficGrowth/);
    expect(runtimeSource).toMatch(/gateway-traffic-v1/);
    expect(gatewaySource).not.toMatch(/writeRuntimeState|companion_state|applyGatewayTrafficGrowth/);
  });

  it("verifies successful and failed Gateway traffic growth behavior", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway Events to Growth Events/);
  });
});
