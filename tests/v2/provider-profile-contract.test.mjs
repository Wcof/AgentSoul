import { describe, it, expect } from "vitest";
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

    expect(rootPackage.workspaces.includes("packages/provider")).toBe(true);
    expect(rootPackage.scripts["provider:test"]).toMatch(/vitest run/);
    expect(rootPackage.scripts["provider:typecheck"]).toMatch(/typecheck/);
    expect(providerPackage.name).toBe("@agentsoul/provider");
    expect(providerPackage.dependencies["@agentsoul/domain"]).toBe("2.0.0-alpha.0");
    expect(providerPackage.dependencies["@agentsoul/persistence"]).toBe("2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "provider", "src", "index.ts"), "utf8");
    expect(source).toMatch(/getActiveProviderProfile/);
    expect(source).not.toMatch(/plaintext|apiKey|secret/i);
  });

  it("verifies Provider Profile lifecycle and Active Provider Profile selection", () => {
    const output = execFileSync("npm", ["run", "provider:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Provider Profile service/);
  });

  it("typechecks the provider package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "provider:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/provider@2\.0\.0-alpha\.0 typecheck/);
  });
});
