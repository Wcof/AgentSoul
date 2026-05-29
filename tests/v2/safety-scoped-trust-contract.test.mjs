import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Scoped Trust Grants", () => {
  it("exposes scoped trust creation, matching, expiry, and Critical Action boundaries", () => {
    const source = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");

    assert.match(source, /createScopedTrustGrantStore/);
    assert.match(source, /CreateScopedTrustGrantInput/);
    assert.match(source, /targetPathPrefix/);
    assert.match(source, /providerProfileId/);
    assert.match(source, /expiresAt/);
    assert.match(source, /maxRiskClass/);
    assert.match(source, /input\.actionRiskClass === "critical"/);
  });

  it("verifies Scoped Trust Grant behavior through the Safety package suite", () => {
    const output = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Scoped Trust Grants/);
  });
});
