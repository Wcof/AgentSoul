import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

describe("AgentSoul v2 User-managed Export", () => {
  it("exposes Portable Data and Sensitive Export boundaries as a v2 workspace package", () => {
    const rootPackage = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8"));
    const source = readFileSync(
      join(process.cwd(), "packages", "export", "src", "index.ts"),
      "utf8",
    );

    expect(rootPackage.workspaces.includes("packages/export")).toBeTruthy();
    expect(source).toMatch(/createUserManagedExportService/);
    expect(source).toMatch(/createPortableDataExport/);
    expect(source).toMatch(/createSensitiveExport/);
    expect(source).toMatch(/agentsoul-export-v1/);
    expect(source).toMatch(/schemaVersion/);
    expect(source).toMatch(/export-secret/);
    expect(source).toMatch(/decideSafetyPolicy/);
  });

  it("verifies inclusion, exclusion, and explicit sensitive confirmation behavior", () => {
    const output = execFileSync("npm", ["run", "export:test"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    expect(output).toMatch(/User-managed Export/);
    expect(output).toMatch(/Portable Data boundaries/);
    expect(output).toMatch(/Sensitive Export confirmation/);
  });
});
