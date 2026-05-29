import { describe, it, expect } from "vitest";
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

    expect(rootPackage.workspaces.includes("packages/security")).toBe(true);
    expect(rootPackage.scripts["security:test"]).toMatch(/vitest run/);
    expect(rootPackage.scripts["security:typecheck"]).toMatch(/typecheck/);
    expect(securityPackage.name).toBe("@agentsoul/security");
    expect(securityPackage.dependencies["@agentsoul/domain"]).toBe("2.0.0-alpha.0");

    const source = readFileSync(join(root, "packages", "security", "src", "index.ts"), "utf8");
    expect(source).toMatch(/Credential Store bridge/);
    expect(source).not.toMatch(/portableSecret|plaintextProviderSecret/i);
  });

  it("verifies controlled credential access and routine secret exclusion", () => {
    const output = execFileSync("npm", ["run", "security:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Credential Store bridge/);
  });

  it("typechecks the security package through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "security:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/security@2\.0\.0-alpha\.0 typecheck/);
  });
});
