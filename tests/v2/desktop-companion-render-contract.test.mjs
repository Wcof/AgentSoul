import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Desktop Companion rendering", () => {
  it("verifies Pet Appearance and state-to-render behavior through the desktop app boundary", () => {
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Desktop Companion appearance view/);
    expect(output).toMatch(/Control Center browser visual smoke/);
  });
});
