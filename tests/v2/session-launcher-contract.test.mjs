import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 safety-gated Session Launcher", () => {
  it("exposes Session Launcher as a Safety Policy controlled launch-session action", () => {
    const source = readFileSync(join(root, "packages", "sessions", "src", "index.ts"), "utf8");

    assert.match(source, /createSessionLauncher/);
    assert.match(source, /launchWorkSession/);
    assert.match(source, /kind: "launch-session"/);
    assert.match(source, /decideSafetyPolicy/);
    assert.match(source, /executeTerminalCommand/);
  });

  it("verifies approval, denial, trust, and non-resumable launch behavior", () => {
    const packageTest = readFileSync(
      join(root, "packages", "sessions", "tests", "session-source-scanner.test.ts"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "sessions:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(packageTest, /gates Session Launcher execution through approval decisions or scoped trust/);
    assert.match(packageTest, /reason: "non-resumable"/);
    assert.match(packageTest, /approval-required/);
    assert.match(packageTest, /approvalDecisionKind: "denied"/);
    assert.match(packageTest, /trust:launch-session/);
    assert.match(output, /Session Source scanning/);
  });
});
