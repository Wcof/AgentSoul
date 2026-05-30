import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("Issue #104: Remote-only controls downgraded", () => {
  it("WebDAV handlers show local-mode notice instead of fake success", () => {
    const source = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    // Must not contain fake success messages
    expect(source).not.toMatch(/WebDAV configured successfully/);
    expect(source).not.toMatch(/Configuration reset/);
  });

  it("Deep Link handlers show local-mode notice instead of fake import", () => {
    const source = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    // Must not contain fake import messages
    expect(source).not.toMatch(/Importing configurations/);
    expect(source).not.toMatch(/Parsed.*URLs/);
  });

  it("remote controls show consistent local-mode notice", () => {
    const source = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    // Both WebDAV and Deep Link should show the same notice
    expect(source).toMatch(/not available in local mode/i);
  });
});
