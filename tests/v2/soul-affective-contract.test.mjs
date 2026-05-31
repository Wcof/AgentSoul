import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Soul and Affective State baseline", () => {
  it("keeps Soul affective state separate from Mood, Vitals, and appearance", () => {
    const output = execFileSync("npm", ["run", "companion:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Soul and Affective State baseline/);
  });
});
