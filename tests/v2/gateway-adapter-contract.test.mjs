import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Provider Adapter", () => {
  it("exposes first Provider Adapter and Unsupported Route handling", () => {
    const source = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");

    expect(source).toMatch(/OpenAICompatibleAdapter/);
    expect(source).toMatch(/unsupported-route/);
    expect(source).not.toMatch(new RegExp("fetch\\(|request\\("));
  });

  it("verifies adapter translation without live provider calls", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway Provider Adapter routing/);
  });
});
