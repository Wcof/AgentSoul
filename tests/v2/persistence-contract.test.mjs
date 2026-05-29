import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 persistence foundation", () => {
  it("exposes a persistence workspace independent from old Python storage", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const persistencePackage = readJson(join(root, "packages", "persistence", "package.json"));

    assert.equal(rootPackage.workspaces.includes("packages/persistence"), true);
    assert.equal(
      rootPackage.scripts["persistence:typecheck"],
      "npm --workspace @agentsoul/persistence run typecheck",
    );
    assert.equal(
      rootPackage.scripts["persistence:test"],
      "npm --workspace @agentsoul/persistence run test",
    );
    assert.equal(persistencePackage.name, "@agentsoul/persistence");
    assert.equal(persistencePackage.dependencies["@agentsoul/domain"], "2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "persistence", "src", "index.ts"), "utf8");
    assert.doesNotMatch(source, /src\/agentsoul\/storage|from ['"]sqlite3['"]|python/i);
  });

  it("declares a public package test command for schema behavior", () => {
    const persistencePackage = readJson(join(root, "packages", "persistence", "package.json"));

    assert.equal(persistencePackage.scripts.test, "node --test --import tsx tests/*.test.ts");
  });

  it("typechecks the persistence package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "persistence:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/persistence@2\.0\.0-alpha\.0 typecheck/);
  });
});
