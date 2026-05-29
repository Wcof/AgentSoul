import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Sessions area", () => {
  it("exposes Sessions Area rendering for Work Session search and safety-gated launching", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    expect(source).toMatch(/Control Center Sessions Area/);
    expect(source).toMatch(/renderControlCenterSessionsAreaViewModel/);
    expect(source).toMatch(/renderControlCenterSessionsArea/);
    expect(source).toMatch(/data-control-area="sessions"/);
    expect(source).toMatch(/data-session-search/);
    expect(source).toMatch(/data-session-launch/);
    expect(source).toMatch(/launch-session/);
  });

  it("verifies Work Session search, Session Source, resumable state, and Session Launcher UI coverage", () => {
    const appTest = readFileSync(
      join(root, "apps", "desktop-v2", "tests", "companion-view.test.mjs"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(appTest).toMatch(/Work Session search/);
    expect(appTest).toMatch(/Session Source/);
    expect(appTest).toMatch(/Session Resume Command/);
    expect(appTest).toMatch(/safety-gated/);
    expect(output).toMatch(/Control Center Sessions area/);
  });
});
