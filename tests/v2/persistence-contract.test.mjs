import { describe, it, expect } from "vitest";
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

    expect(rootPackage.workspaces.includes("packages/persistence")).toBe(true);
    expect(rootPackage.scripts["persistence:typecheck"]).toMatch(/typecheck/);
    expect(rootPackage.scripts["persistence:test"]).toMatch(/vitest run/);
    expect(persistencePackage.name).toBe("@agentsoul/persistence");
    expect(persistencePackage.dependencies["@agentsoul/domain"]).toBe("2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "persistence", "src", "index.ts"), "utf8");
    expect(source).not.toMatch(/src\/agentsoul\/storage|from ['"]sqlite3['"]|python/i);
  });

  it("declares a public package test command for schema behavior", () => {
    const persistencePackage = readJson(join(root, "packages", "persistence", "package.json"));

    expect(persistencePackage.scripts.test).toMatch(/vitest/);
  });

  it("typechecks the persistence package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "persistence:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/persistence@2\.0\.0-alpha\.0 typecheck/);
  });
});
