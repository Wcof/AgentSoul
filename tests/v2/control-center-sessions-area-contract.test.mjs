import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Sessions area", () => {
  it("exposes Sessions Area rendering for Work Session search and safety-gated launching", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Sessions Area/);
    assert.match(source, /renderControlCenterSessionsAreaViewModel/);
    assert.match(source, /renderControlCenterSessionsArea/);
    assert.match(source, /data-control-area="sessions"/);
    assert.match(source, /data-session-search/);
    assert.match(source, /data-session-launch/);
    assert.match(source, /launch-session/);
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

    assert.match(appTest, /Work Session search/);
    assert.match(appTest, /Session Source/);
    assert.match(appTest, /Session Resume Command/);
    assert.match(appTest, /safety-gated/);
    assert.match(output, /Control Center Sessions area/);
  });
});
