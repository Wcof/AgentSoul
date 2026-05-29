import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Work Session search", () => {
  it("exposes searchable and resumable Work Session states separately", () => {
    const source = readFileSync(join(root, "packages", "sessions", "src", "index.ts"), "utf8");

    assert.match(source, /searchWorkSessions/);
    assert.match(source, /SearchWorkSessionsInput/);
    assert.match(source, /availableActions/);
    assert.match(source, /session\.resumable && session\.resumeCommand/);
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

    assert.match(packageTest, /searches Work Sessions by project, source, time, and keyword/);
    assert.match(packageTest, /availableActions: \[\]/);
    assert.match(packageTest, /availableActions: \["resume"\]/);
    assert.match(output, /Session Source scanning/);
  });
});
