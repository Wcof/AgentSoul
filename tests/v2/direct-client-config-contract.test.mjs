import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Direct Client Config fallback", () => {
  it("exposes fallback metadata without Gateway Route guarantees", () => {
    const source = readFileSync(join(root, "packages", "provider", "src", "index.ts"), "utf8");

    assert.match(source, /createDirectClientConfigFallback/);
    assert.match(source, /getProviderActivationSupportMatrix/);
    assert.match(source, /Claude Code/);
    assert.match(source, /Cursor/);
    assert.match(source, /Codex/);
    assert.match(source, /Trae/);
    assert.match(source, /direct-client-config/);
    assert.match(source, /fullAudit: false/);
    assert.match(source, /growthConversion: false/);
    assert.match(source, /approvalControl: false/);
  });

  it("verifies fallback activation status and limitations", () => {
    const output = execFileSync("npm", ["run", "provider:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Direct Client Config fallback/);
  });
});
