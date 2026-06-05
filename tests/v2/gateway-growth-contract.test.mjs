import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 external traffic events to Growth Events", () => {
  it("keeps external traffic growth conversion inside Companion without requiring an embedded gateway package", () => {
    const companionSource = readFileSync(join(root, "packages", "companion", "src", "index.ts"), "utf8");
    const rootPackage = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));

    expect(companionSource).toMatch(/applyGatewayTrafficGrowth/);
    expect(companionSource).toMatch(/gateway-traffic-v1/);
    expect(rootPackage.workspaces).not.toContain("packages/gateway");
    expect(rootPackage.scripts["gateway:test"]).toBeUndefined();
  });

  it("verifies successful and failed Gateway traffic growth behavior", () => {
    const output = execFileSync("npm", ["run", "companion:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway Events to Growth Events/);
  });
});
