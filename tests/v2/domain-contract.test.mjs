import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 domain contract", () => {
  it("exposes the domain package as a workspace independent from app/runtime adapters", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const domainPackage = readJson(join(root, "packages", "domain", "package.json"));

    assert.equal(rootPackage.workspaces.includes("packages/domain"), true);
    assert.equal(rootPackage.scripts["domain:typecheck"], "npm --workspace @agentsoul/domain run typecheck");
    assert.equal(domainPackage.name, "@agentsoul/domain");
    assert.deepEqual(domainPackage.dependencies ?? {}, {});

    const source = readFileSync(join(root, "packages", "domain", "src", "index.ts"), "utf8");
    assert.doesNotMatch(source, /@tauri-apps|sqlite|better-sqlite3|express|fetch\(/);
    assert.equal(existsSync(join(root, "packages", "domain", "tests", "domain-contract.ts")), true);
  });

  it("typechecks glossary distinctions through the public domain interface", () => {
    const output = execFileSync("npm", ["run", "domain:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/domain@2\.0\.0-alpha\.0 typecheck/);
  });
});
