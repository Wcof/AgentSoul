import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Risk Notice flow", () => {
  it("exposes Risk Notice as readable non-blocking state, separate from Approval Required", () => {
    const safetySource = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");
    const desktopSource = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    expect(safetySource).toMatch(/createRiskNoticeFlow/);
    expect(safetySource).toMatch(/blocking: false/);
    expect(safetySource).toMatch(/getRiskNotices/);
    expect(safetySource).toMatch(/fully-authorized/);
    expect(desktopSource).toMatch(/renderRiskNotices/);
    expect(desktopSource).toMatch(/Risk Notice/);
    expect(desktopSource).not.toMatch(/data-risk-notice-decision/);
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

    expect(safetyOutput).toMatch(/Risk Notice flow/);
    expect(desktopOutput).toMatch(/Desktop Companion risk notice flow/);
  }, 30000);
});
