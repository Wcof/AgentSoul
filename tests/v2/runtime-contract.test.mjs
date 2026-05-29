import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 Companion Runtime State", () => {
  it("exposes a runtime workspace that depends on domain and persistence", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const runtimePackage = readJson(join(root, "packages", "runtime", "package.json"));

    expect(rootPackage.workspaces.includes("packages/runtime")).toBe(true);
    expect(rootPackage.scripts["runtime:test"]).toMatch(/vitest run/);
    expect(rootPackage.scripts["runtime:typecheck"]).toMatch(/typecheck/);
    expect(runtimePackage.name).toBe("@agentsoul/runtime");
    expect(runtimePackage.dependencies["@agentsoul/domain"]).toBe("2.0.0-alpha.0");
    expect(runtimePackage.dependencies["@agentsoul/persistence"]).toBe("2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "runtime", "src", "index.ts"), "utf8");
    expect(source).not.toMatch(/persona\\.ya?ml|src\/agentsoul\/config|python/i);
  });

  it("creates and updates Companion Runtime State through the public runtime service", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/AgentSoul v2 runtime/);
  });

  it("typechecks the runtime package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "runtime:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/runtime@2\.0\.0-alpha\.0 typecheck/);
  });
});
