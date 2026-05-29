import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Work Session search", () => {
  it("exposes searchable and resumable Work Session states separately", () => {
    const source = readFileSync(join(root, "packages", "sessions", "src", "index.ts"), "utf8");

    expect(source).toMatch(/searchWorkSessions/);
    expect(source).toMatch(/SearchWorkSessionsInput/);
    expect(source).toMatch(/availableActions/);
    expect(source).toMatch(/session\.resumable && session\.resumeCommand/);
  });

  it("verifies project, client, source, time, keyword, and resume-action search behavior", () => {
    const packageTest = readFileSync(
      join(root, "packages", "sessions", "tests", "session-source-scanner.test.ts"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "sessions:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(packageTest).toMatch(/searches Work Sessions by project/);
    expect(packageTest).toMatch(/availableActions: \[\]/);
    expect(packageTest).toMatch(/availableActions: \["resume"\]/);
    expect(output).toMatch(/Session Source scanning/);
  });
});
