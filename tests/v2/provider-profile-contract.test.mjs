import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 Provider Profile service", () => {
  it("exposes a Provider Profile workspace backed by persistence and Credential references", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const providerPackage = readJson(join(root, "packages", "provider", "package.json"));

    assert.equal(rootPackage.workspaces.includes("packages/provider"), true);
    assert.equal(rootPackage.scripts["provider:test"], "npm --workspace @agentsoul/provider run test");
    assert.equal(
      rootPackage.scripts["provider:typecheck"],
      "npm --workspace @agentsoul/provider run typecheck",
    );
    assert.equal(providerPackage.name, "@agentsoul/provider");
    assert.equal(providerPackage.dependencies["@agentsoul/domain"], "2.0.0-alpha.0");
    assert.equal(providerPackage.dependencies["@agentsoul/persistence"], "2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "provider", "src", "index.ts"), "utf8");
    assert.match(source, /getActiveProviderProfile/);
    assert.doesNotMatch(source, /plaintext|apiKey|secret/i);
  });

  it("verifies Provider Profile lifecycle and Active Provider Profile selection", () => {
    const output = execFileSync("npm", ["run", "provider:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Provider Profile service/);
  });

  it("typechecks the provider package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "provider:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/provider@2\.0\.0-alpha\.0 typecheck/);
  });
});
