import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Safety area", () => {
  it("exposes Safety Area rendering for approval, notice, trust, risk, and authorization state", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    expect(source).toMatch(/Control Center Safety Area/);
    expect(source).toMatch(/renderControlCenterSafetyAreaViewModel/);
    expect(source).toMatch(/renderControlCenterSafetyArea/);
    expect(source).toMatch(/data-control-area="safety"/);
    expect(source).toMatch(/data-trust-revoke/);
    expect(source).toMatch(/Client Authorization Mode/);
  });

  it("verifies Approval Requests, Risk Notices, Scoped Trust Grants, Action Risk Classes, and revoke behavior", () => {
    const appTest = readFileSync(
      join(root, "apps", "desktop-v2", "tests", "companion-view.test.mjs"),
      "utf8",
    );
    const safetyTest = readFileSync(
      join(root, "packages", "safety", "tests", "safety-policy.test.ts"),
      "utf8",
    );
    const desktopOutput = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });
    const safetyOutput = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(appTest).toMatch(/Approval Requests/);
    expect(appTest).toMatch(/Risk Notices/);
    expect(appTest).toMatch(/Scoped Trust Grants/);
    expect(appTest).toMatch(/Action Risk Classes/);
    expect(safetyTest).toMatch(/revokeGrant/);
    expect(desktopOutput).toMatch(/Control Center Safety area/);
    expect(safetyOutput).toMatch(/revokes Scoped Trust Grants/);
  }, 30000);
});
