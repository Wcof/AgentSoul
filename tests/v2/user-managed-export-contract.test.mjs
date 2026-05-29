import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

    assert.ok(rootPackage.workspaces.includes("packages/export"));
    assert.match(source, /createUserManagedExportService/);
    assert.match(source, /createPortableDataExport/);
    assert.match(source, /createSensitiveExport/);
    assert.match(source, /agentsoul-export-v1/);
    assert.match(source, /schemaVersion/);
    assert.match(source, /export-secret/);
    assert.match(source, /decideSafetyPolicy/);
  });

  it("verifies inclusion, exclusion, and explicit sensitive confirmation behavior", () => {
    const output = execFileSync("npm", ["run", "export:test"], {
      cwd: process.cwd(),
      encoding: "utf8",
    });

    assert.match(output, /User-managed Export/);
    assert.match(output, /Portable Data boundaries/);
    assert.match(output, /Sensitive Export confirmation/);
  });
});
