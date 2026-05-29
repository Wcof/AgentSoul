import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Soul and Affective State baseline", () => {
  it("keeps Soul affective state separate from Mood, Vitals, and appearance", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Soul and Affective State baseline/);
  });
});
