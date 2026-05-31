import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

function readAllBindSources() {
  let combined = "";
  const areasDir = join(appRoot, "src", "areas");
  for (const area of readdirSync(areasDir)) {
    const areaPath = join(areasDir, area);
    if (!statSync(areaPath).isDirectory()) continue;
    try { combined += readFileSync(join(areaPath, "bind.ts"), "utf8") + "\n"; } catch {}
  }
  const sharedDir = join(appRoot, "src", "shared");
  for (const file of readdirSync(sharedDir)) {
    if (file.endsWith(".ts")) try { combined += readFileSync(join(sharedDir, file), "utf8") + "\n"; } catch {}
  }
  return combined;
}

describe("Issue #104: Remote-only controls downgraded", () => {
  it("WebDAV handlers show local-mode notice instead of fake success", () => {
    const source = readAllBindSources();

    // Must not contain fake success messages
    expect(source).not.toMatch(/WebDAV configured successfully/);
    expect(source).not.toMatch(/Configuration reset/);
  });

  it("Deep Link handlers show local-mode notice instead of fake import", () => {
    const source = readAllBindSources();

    // Must not contain fake import messages
    expect(source).not.toMatch(/Importing configurations/);
    expect(source).not.toMatch(/Parsed.*URLs/);
  });

  it("remote controls show consistent local-mode notice", () => {
    const source = readAllBindSources();

    // Both WebDAV and Deep Link should show the same notice
    expect(source).toMatch(/not available in local mode/i);
  });
});
