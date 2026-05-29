import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 Credential Store bridge", () => {
  it("exposes a local security workspace for Credential references", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const securityPackage = readJson(join(root, "packages", "security", "package.json"));

    assert.equal(rootPackage.workspaces.includes("packages/security"), true);
    assert.equal(rootPackage.scripts["security:test"], "npm --workspace @agentsoul/security run test");
    assert.equal(
      rootPackage.scripts["security:typecheck"],
      "npm --workspace @agentsoul/security run typecheck",
    );
    assert.equal(securityPackage.name, "@agentsoul/security");
    assert.equal(securityPackage.dependencies["@agentsoul/domain"], "2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "security", "src", "index.ts"), "utf8");
    assert.match(source, /Credential Store bridge/);
    assert.doesNotMatch(source, /portableSecret|plaintextProviderSecret/i);
  });

  it("verifies controlled credential access and routine secret exclusion", () => {
    const output = execFileSync("npm", ["run", "security:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Credential Store bridge/);
  });

  it("typechecks the security package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "security:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/security@2\.0\.0-alpha\.0 typecheck/);
  });
});
