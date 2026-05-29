import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Approval Required flow", () => {
  it("exposes pending approval, explicit decision, timeout, and unavailable-denied boundaries", () => {
    const safetySource = readFileSync(join(root, "packages", "safety", "src", "index.ts"), "utf8");
    const desktopSource = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    expect(safetySource).toMatch(/createApprovalFlow/);
    expect(safetySource).toMatch(/getPendingApproval/);
    expect(safetySource).toMatch(/decideApproval/);
    expect(safetySource).toMatch(/timeoutPendingApproval/);
    expect(safetySource).toMatch(/unavailable-denied/);
    expect(desktopSource).toMatch(/Approval Required/);
    expect(desktopSource).toMatch(/data-approval-decision="allowed"/);
    expect(desktopSource).toMatch(/data-approval-decision="denied"/);
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

    expect(safetyOutput).toMatch(/Approval Required flow/);
    expect(desktopOutput).toMatch(/Desktop Companion approval flow/);
  }, 30000);
});
