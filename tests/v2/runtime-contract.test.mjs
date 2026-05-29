import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

    assert.equal(rootPackage.workspaces.includes("packages/runtime"), true);
    assert.equal(rootPackage.scripts["runtime:test"], "npm --workspace @agentsoul/runtime run test");
    assert.equal(
      rootPackage.scripts["runtime:typecheck"],
      "npm --workspace @agentsoul/runtime run typecheck",
    );
    assert.equal(runtimePackage.name, "@agentsoul/runtime");
    assert.equal(runtimePackage.dependencies["@agentsoul/domain"], "2.0.0-alpha.0");
    assert.equal(runtimePackage.dependencies["@agentsoul/persistence"], "2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "runtime", "src", "index.ts"), "utf8");
    assert.doesNotMatch(source, /persona\\.ya?ml|src\/agentsoul\/config|python/i);
  });

  it("creates and updates Companion Runtime State through the public runtime service", () => {
    const output = execFileSync("npm", ["run", "runtime:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /AgentSoul v2 runtime/);
  });

  it("typechecks the runtime package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "runtime:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/runtime@2\.0\.0-alpha\.0 typecheck/);
  });
});
