import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Direct Client Config fallback", () => {
  it("exposes fallback metadata without Gateway Route guarantees", () => {
    const source = readFileSync(join(root, "packages", "provider", "src", "index.ts"), "utf8");

    expect(source).toMatch(/createDirectClientConfigFallback/);
    expect(source).toMatch(/getProviderActivationSupportMatrix/);
    expect(source).toMatch(/Claude Code/);
    expect(source).toMatch(/Cursor/);
    expect(source).toMatch(/Codex/);
    expect(source).toMatch(/Trae/);
    expect(source).toMatch(/direct-client-config/);
    expect(source).toMatch(/fullAudit: false/);
    expect(source).toMatch(/growthConversion: false/);
    expect(source).toMatch(/approvalControl: false/);
  });

  it("verifies fallback activation status and limitations", () => {
    const output = execFileSync("npm", ["run", "provider:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Direct Client Config fallback/);
  });
});
