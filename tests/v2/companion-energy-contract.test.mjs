import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Companion Energy behavior", () => {
  it("covers fatigue, XP dampening, rest recovery, and manual Sleep recovery", () => {
    const output = execFileSync("npm", ["run", "companion:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Companion Energy behavior/);
  });
});
