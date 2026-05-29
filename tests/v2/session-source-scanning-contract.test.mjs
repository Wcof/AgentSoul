import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Session Source scanning", () => {
  it("exposes Session Source scanning as a v2 workspace package", () => {
    const packageJson = readFileSync(join(root, "package.json"), "utf8");
    const source = readFileSync(join(root, "packages", "sessions", "src", "index.ts"), "utf8");

    expect(packageJson).toMatch(/packages\/sessions/);
    expect(packageJson).toMatch(/sessions:test/);
    expect(source).toMatch(/createSessionSourceScanner/);
    expect(source).toMatch(/scanJsonlSessionSource/);
    expect(source).toMatch(/listWorkSessions/);
    expect(source).toMatch(/resumable: row\.resumable === 1/);
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

    expect(packageTest).toMatch(/scans a local JSONL Session Source into searchable Work Sessions with evidence/);
    expect(packageTest).toMatch(/normalizes representative Claude/);
    expect(packageTest).toMatch(/skippedMalformed/);
    expect(output).toMatch(/Session Source scanning/);
  });
});
