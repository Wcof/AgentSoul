import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Derived Hunger", () => {
  it("derives Hunger from baseline state and system time with caps and anomaly handling", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Derived Hunger/);
  });
});
