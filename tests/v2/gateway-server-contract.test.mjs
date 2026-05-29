import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 Gateway server shell", () => {
  it("exposes a local Gateway workspace that depends on Active Provider Profile lookup", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const gatewayPackage = readJson(join(root, "packages", "gateway", "package.json"));

    assert.equal(rootPackage.workspaces.includes("packages/gateway"), true);
    assert.equal(rootPackage.scripts["gateway:test"], "npm --workspace @agentsoul/gateway run test");
    assert.equal(
      rootPackage.scripts["gateway:typecheck"],
      "npm --workspace @agentsoul/gateway run typecheck",
    );
    assert.equal(gatewayPackage.name, "@agentsoul/gateway");
    assert.equal(gatewayPackage.dependencies["@agentsoul/provider"], "2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");
    assert.match(source, /startLocalGateway/);
    assert.match(source, /getActiveProviderProfile/);
    assert.doesNotMatch(source, /hardcodedCredential|sk-|apiKey/i);
  });

  it("verifies startup, health, and no-profile behavior", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Gateway server shell/);
  });

  it("typechecks the gateway package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "gateway:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/gateway@2\.0\.0-alpha\.0 typecheck/);
  });
});
