import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Gateway Provider Adapter", () => {
  it("exposes first Provider Adapter and Unsupported Route handling", () => {
    const source = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");

    assert.match(source, /OpenAICompatibleAdapter/);
    assert.match(source, /unsupported-route/);
    assert.doesNotMatch(source, new RegExp("fetch\\(|request\\("));
  });

  it("verifies adapter translation without live provider calls", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Gateway Provider Adapter routing/);
  });
});
