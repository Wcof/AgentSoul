import { describe, it, expect } from "vitest";
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

    expect(rootPackage.workspaces.includes("packages/gateway")).toBe(true);
    expect(rootPackage.scripts["gateway:test"]).toMatch(/vitest run/);
    expect(rootPackage.scripts["gateway:typecheck"]).toMatch(/typecheck/);
    expect(gatewayPackage.name).toBe("@agentsoul/gateway");
    expect(gatewayPackage.dependencies["@agentsoul/provider"]).toBe("2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "gateway", "src", "index.ts"), "utf8");
    const launcher = readFileSync(join(root, "apps", "desktop-v2", "launcher.mjs"), "utf8");
    expect(source).toMatch(/startLocalGateway/);
    expect(source).toMatch(/createLocalCompanionKernel/);
    expect(source).toMatch(/companionChat/);
    expect(launcher).toMatch(/createMemoryStore/);
    expect(launcher).toMatch(/createSkillSourceStore/);
    expect(launcher).toMatch(/createLocalCompanionKernel/);
    expect(launcher).toMatch(/companionChat/);
    expect(source).toMatch(/getActiveProviderProfile/);
    expect(source).not.toMatch(/hardcodedCredential|sk-[a-zA-Z0-9]{20,}|api[_-]?key[_-]?=.*["'][a-zA-Z0-9]{20,}/i);
    // Field names like apiKeys are allowed; only hardcoded credential values are forbidden
  });

  it("verifies startup, health, and no-profile behavior", () => {
    const output = execFileSync("npm", ["run", "gateway:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Gateway server shell/);
  });

  it("typechecks the gateway package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "gateway:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/gateway@2\.0\.0-alpha\.0 typecheck/);
  });
});
