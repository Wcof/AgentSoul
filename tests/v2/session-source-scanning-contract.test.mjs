import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Session Source scanning", () => {
  it("exposes Session Source scanning as a v2 workspace package", () => {
    const packageJson = readFileSync(join(root, "package.json"), "utf8");
    const source = readFileSync(join(root, "packages", "sessions", "src", "index.ts"), "utf8");

    assert.match(packageJson, /packages\/sessions/);
    assert.match(packageJson, /sessions:test/);
    assert.match(source, /createSessionSourceScanner/);
    assert.match(source, /scanJsonlSessionSource/);
    assert.match(source, /listWorkSessions/);
    assert.match(source, /resumable: row\.resumable === 1/);
  });

  it("verifies local JSONL sources become searchable Work Sessions with evidence", () => {
    const packageTest = readFileSync(
      join(root, "packages", "sessions", "tests", "session-source-scanner.test.ts"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "sessions:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(packageTest, /scans a local JSONL Session Source into searchable Work Sessions with evidence/);
    assert.match(packageTest, /normalizes representative Claude, Codex, and IDE JSONL history formats/);
    assert.match(packageTest, /skippedMalformed/);
    assert.match(output, /Session Source scanning/);
  });
});
