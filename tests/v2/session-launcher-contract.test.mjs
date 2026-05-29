import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 safety-gated Session Launcher", () => {
  it("exposes Session Launcher as a Safety Policy controlled launch-session action", () => {
    const source = readFileSync(join(root, "packages", "sessions", "src", "index.ts"), "utf8");

    expect(source).toMatch(/createSessionLauncher/);
    expect(source).toMatch(/launchWorkSession/);
    expect(source).toMatch(/kind: "launch-session"/);
    expect(source).toMatch(/decideSafetyPolicy/);
    expect(source).toMatch(/executeTerminalCommand/);
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

    expect(packageTest).toMatch(/gates Session Launcher execution through approval decisions or scoped trust/);
    expect(packageTest).toMatch(/reason: "non-resumable"/);
    expect(packageTest).toMatch(/approval-required/);
    expect(packageTest).toMatch(/approvalDecisionKind: "denied"/);
    expect(packageTest).toMatch(/trust:launch-session/);
    expect(output).toMatch(/Session Source scanning/);
  });
});
