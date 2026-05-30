import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center shell navigation", () => {
  it("renders local-first task navigation for the seven Control Center areas", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "renderers.ts"), "utf8");
    const css = readFileSync(join(root, "apps", "desktop-v2", "src", "styles.css"), "utf8");

    for (const area of ["companion", "gateway", "skills", "sessions", "costs", "safety", "settings"]) {
      expect(source).toMatch(new RegExp(`data-nav-target="${area}"`));
      expect(source).toMatch(new RegExp(`data-control-area="${area}"`));
    }

    expect(source).toMatch(/Control Center task navigation/);
    expect(source).toMatch(/Local-first/);
    expect(source).toMatch(/cloud login not required/i);
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
    expect(css).toMatch(/@media \(max-width: 640px\)/);
    expect(readFileSync(join(root, "apps", "desktop-v2", "tests", "browser-visual.test.mjs"), "utf8")).toMatch(/horizontal overflow/);
    expect(readFileSync(join(root, "apps", "desktop-v2", "tests", "browser-visual.test.mjs"), "utf8")).toMatch(/screenshot/);
  });

  it("verifies the desktop app shell tests cover task navigation and settings", () => {
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/Control Center task navigation/);
    expect(output).toMatch(/Control Center Settings area/);
    expect(output).toMatch(/Control Center browser visual smoke/);
  }, 120000);
});
