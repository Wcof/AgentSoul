import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Risk Notice flow", () => {
  it("exposes Risk Notice as readable non-blocking state, separate from Approval Required", () => {
    const safetySource = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");
    const desktopSource = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(safetySource, /createRiskNoticeFlow/);
    assert.match(safetySource, /blocking: false/);
    assert.match(safetySource, /getRiskNotices/);
    assert.match(safetySource, /fully-authorized/);
    assert.match(desktopSource, /renderRiskNotices/);
    assert.match(desktopSource, /Risk Notice/);
    assert.doesNotMatch(desktopSource, /data-risk-notice-decision/);
  });

  it("verifies Risk Notice behavior through Safety and Desktop Companion suites", () => {
    const safetyOutput = execFileSync("npm", ["run", "safety:test"], {
      cwd: root,
      encoding: "utf8",
    });
    const desktopOutput = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(safetyOutput, /Risk Notice flow/);
    assert.match(desktopOutput, /Desktop Companion risk notice flow/);
  });
});
