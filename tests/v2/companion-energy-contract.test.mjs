import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Companion Energy behavior", () => {
  it("covers fatigue, XP dampening, rest recovery, and manual Sleep recovery", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Companion Energy behavior/);
  });
});
