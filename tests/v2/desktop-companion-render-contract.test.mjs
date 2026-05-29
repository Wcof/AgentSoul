import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Desktop Companion rendering", () => {
  it("verifies Pet Appearance and state-to-render behavior through the desktop app boundary", () => {
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Desktop Companion appearance view/);
    assert.match(output, /Control Center browser visual smoke/);
  });
});
