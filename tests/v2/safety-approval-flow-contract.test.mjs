import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Approval Required flow", () => {
  it("exposes pending approval, explicit decision, timeout, and unavailable-denied boundaries", () => {
    const safetySource = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");
    const desktopSource = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(safetySource, /createApprovalFlow/);
    assert.match(safetySource, /getPendingApproval/);
    assert.match(safetySource, /decideApproval/);
    assert.match(safetySource, /timeoutPendingApproval/);
    assert.match(safetySource, /unavailable-denied/);
    assert.match(desktopSource, /Approval Required/);
    assert.match(desktopSource, /data-approval-decision="allowed"/);
    assert.match(desktopSource, /data-approval-decision="denied"/);
  });

  it("verifies Approval Required package and Desktop Companion behavior", () => {
    const safetyOutput = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });
    const desktopOutput = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(safetyOutput, /Approval Required flow/);
    assert.match(desktopOutput, /Desktop Companion approval flow/);
  });
});
