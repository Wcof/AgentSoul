import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 Credential Store bridge", () => {
  it("exposes credential store through the provider workspace", () => {
    const rootPackage = readJson(join(root, "package.json"));

    expect(rootPackage.workspaces.includes("packages/provider")).toBe(true);
    expect(rootPackage.workspaces.includes("packages/security")).toBe(false);
    expect(rootPackage.scripts["security:test"]).toBeUndefined();
    expect(rootPackage.scripts["security:typecheck"]).toBeUndefined();

    const providerPackage = readJson(join(root, "packages", "provider", "package.json"));
    expect(providerPackage.name).toBe("@agentsoul/provider");
    expect(providerPackage.dependencies["@agentsoul/domain"]).toBe("2.0.0-alpha.0");

    const credentialStoreSource = readFileSync(
      join(root, "packages", "provider", "src", "credential-store.ts"),
      "utf8",
    );
    expect(credentialStoreSource).toMatch(/Credential Store bridge/);
    expect(credentialStoreSource).not.toMatch(/portableSecret|plaintextProviderSecret/i);
  });

  it("verifies controlled credential access and routine secret exclusion", () => {
    const output = execFileSync("npm", ["run", "provider:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Credential Store bridge/);
  });

  it("typechecks the provider package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "provider:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/provider@2\.0\.0-alpha\.0 typecheck/);
  });
});
