import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Provider Adapter", () => {
  it("exposes first Provider Adapter and Unsupported Route handling", () => {
    const indexSource = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");
    const providersSource = readFileSync(join(root, "packages", "gateway", "src", "providers", "index.ts"), "utf8");

    // Adapter and route handling live in providers module, re-exported from index
    expect(providersSource).toMatch(/OpenAICompatibleAdapter/);
    expect(providersSource).toMatch(/unsupported-route/);
    expect(indexSource).toMatch(/translateGatewayRoute/);
    expect(indexSource).not.toMatch(new RegExp("fetch\\(|request\\("));
  });

  it("verifies adapter translation without live provider calls", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway Provider Adapter routing/);
  });
});
