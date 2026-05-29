import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Safety Policy", () => {
  it("exposes policy language for approval, risk notice, timeout, unavailable, and trust grants", () => {
    const source = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");

    assert.match(source, /classifyActionRisk/);
    assert.match(source, /decideSafetyPolicy/);
    assert.match(source, /resolveApprovalTimeout/);
    assert.match(source, /ScopedTrustGrant/);
    assert.match(source, /approval-required/);
    assert.match(source, /risk-notice/);
    assert.match(source, /timeout-denied/);
    assert.match(source, /unavailable-denied/);
  });

  it("verifies Safety Policy decision outcomes through the package test suite", () => {
    const output = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Safety Policy decision engine/);
  });
});
