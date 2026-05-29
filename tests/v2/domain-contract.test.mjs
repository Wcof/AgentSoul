import { describe, it, expect } from "vitest";
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

    expect(rootPackage.workspaces.includes("packages/domain")).toBe(true);
    expect(rootPackage.scripts["domain:typecheck"]).toMatch(/typecheck/);
    expect(domainPackage.name).toBe("@agentsoul/domain");
    expect(domainPackage.dependencies ?? {}).toEqual({});

    const source = readFileSync(join(root, "packages", "domain", "src", "index.ts"), "utf8");
    expect(source).not.toMatch(/@tauri-apps|sqlite|better-sqlite3|express|fetch\(/);
    expect(existsSync(join(root, "packages", "domain", "tests", "domain-contract.ts"))).toBe(true);
  });

  it("typechecks glossary distinctions through the public domain interface", () => {
    const output = execFileSync("npm", ["run", "domain:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/domain@2\.0\.0-alpha\.0 typecheck/);
  });
});
