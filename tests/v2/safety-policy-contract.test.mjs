import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Safety Policy", () => {
  it("exposes policy language for approval, risk notice, timeout, unavailable, and trust grants", () => {
    const source = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");

    expect(source).toMatch(/classifyActionRisk/);
    expect(source).toMatch(/decideSafetyPolicy/);
    expect(source).toMatch(/resolveApprovalTimeout/);
    expect(source).toMatch(/ScopedTrustGrant/);
    expect(source).toMatch(/approval-required/);
    expect(source).toMatch(/risk-notice/);
    expect(source).toMatch(/timeout-denied/);
    expect(source).toMatch(/unavailable-denied/);
  });

  it("verifies Safety Policy decision outcomes through the package test suite", () => {
    const output = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Safety Policy decision engine/);
  });
});
