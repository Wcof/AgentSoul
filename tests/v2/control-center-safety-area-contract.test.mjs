import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Safety area", () => {
  it("exposes Safety Area rendering for approval, notice, trust, risk, and authorization state", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Safety Area/);
    assert.match(source, /renderControlCenterSafetyAreaViewModel/);
    assert.match(source, /renderControlCenterSafetyArea/);
    assert.match(source, /data-control-area="safety"/);
    assert.match(source, /data-trust-revoke/);
    assert.match(source, /Client Authorization Mode/);
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

    assert.match(appTest, /Approval Requests/);
    assert.match(appTest, /Risk Notices/);
    assert.match(appTest, /Scoped Trust Grants/);
    assert.match(appTest, /Action Risk Classes/);
    assert.match(safetyTest, /revokeGrant/);
    assert.match(desktopOutput, /Control Center Safety area/);
    assert.match(safetyOutput, /revokes Scoped Trust Grants/);
  });
});
