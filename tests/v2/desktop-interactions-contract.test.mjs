import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Desktop Companion interactions", () => {
  it("verifies Feed, Play, Pet, and Sleep command flow through the desktop app boundary", () => {
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Desktop Companion interaction command flow/);
  }, 120000);
});
