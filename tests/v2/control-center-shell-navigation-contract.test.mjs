import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center shell navigation", () => {
  it("renders local-first task navigation for the seven Control Center areas", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");
    const css = readFileSync(join(root, "apps", "desktop-v2", "src", "styles.css"), "utf8");

    for (const area of ["companion", "gateway", "skills", "sessions", "costs", "safety", "settings"]) {
      assert.match(source, new RegExp(`data-nav-target="${area}"`));
      assert.match(source, new RegExp(`data-control-area="${area}"`));
    }

    assert.match(source, /Control Center task navigation/);
    assert.match(source, /Local-first/);
    assert.match(source, /cloud login not required/i);
    assert.match(css, /overflow-wrap:\s*anywhere/);
    assert.match(css, /@media \(max-width: 640px\)/);
    assert.match(readFileSync(join(root, "apps", "desktop-v2", "tests", "browser-visual.test.mjs"), "utf8"), /horizontal overflow/);
    assert.match(readFileSync(join(root, "apps", "desktop-v2", "tests", "browser-visual.test.mjs"), "utf8"), /screenshot/);
  });

  it("verifies the desktop app shell tests cover task navigation and settings", () => {
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /Control Center task navigation/);
    assert.match(output, /Control Center Settings area/);
    assert.match(output, /Control Center browser visual smoke/);
  });
});
