import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Scoped Trust Grants", () => {
  it("exposes scoped trust creation, matching, expiry, and Critical Action boundaries", () => {
    const source = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");

    expect(source).toMatch(/createScopedTrustGrantStore/);
    expect(source).toMatch(/CreateScopedTrustGrantInput/);
    expect(source).toMatch(/targetPathPrefix/);
    expect(source).toMatch(/providerProfileId/);
    expect(source).toMatch(/expiresAt/);
    expect(source).toMatch(/maxRiskClass/);
    expect(source).toMatch(/input\.actionRiskClass === "critical"/);
  });

  it("verifies Scoped Trust Grant behavior through the Safety package suite", () => {
    const output = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Scoped Trust Grants/);
  });
});
