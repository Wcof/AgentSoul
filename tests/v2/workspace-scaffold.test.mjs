import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

describe("AgentSoul v2 workspace scaffold", () => {
  it("exposes a same-repo TypeScript/Tauri workspace without removing the legacy reference implementation", () => {
    const rootPackage = readJson(join(root, "package.json"));
    const appPackage = readJson(join(root, "apps", "desktop-v2", "package.json"));

    assert.equal(rootPackage.private, true);
    assert.deepEqual(rootPackage.workspaces.slice(0, 3), [
      "apps/desktop-v2",
      "packages/domain",
      "packages/persistence",
    ]);
    assert.equal(rootPackage.scripts["v2:test"], "npm --workspace @agentsoul/desktop-v2 run test");
    assert.equal(rootPackage.scripts["v2:typecheck"], "npm --workspace @agentsoul/desktop-v2 run typecheck");
    assert.equal(rootPackage.scripts["v2:dev"], "npm --workspace @agentsoul/desktop-v2 run dev");
    assert.equal(rootPackage.scripts["v2:build"], "npm --workspace @agentsoul/desktop-v2 run build");

    assert.equal(appPackage.name, "@agentsoul/desktop-v2");
    assert.equal(appPackage.scripts.test.startsWith("node --test tests/*.test.mjs"), true);
    assert.equal(appPackage.scripts.typecheck, "tsc --noEmit");
    assert.equal(appPackage.scripts.dev, "vite --host 127.0.0.1");
    assert.equal(appPackage.scripts.build, "vite build");
    assert.equal(appPackage.scripts.tauri, "tauri");

    assert.equal(existsSync(join(root, "apps", "desktop-v2", "src", "main.ts")), true);
    assert.equal(existsSync(join(root, "apps", "desktop-v2", "src-tauri", "tauri.conf.json")), true);
    assert.equal(existsSync(join(root, "src", "gateway", "proxy_server.py")), true);
    assert.equal(existsSync(join(root, "src", "desktop_pet", "widget.py")), true);
    assert.equal(existsSync(join(root, "apps", "mcp-server", "src", "index.ts")), true);
  });

  it("runs a v2 command through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "v2:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /@agentsoul\/desktop-v2@2\.0\.0-alpha\.0 typecheck/);
  });

  it("builds the minimal v2 web shell through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "v2:build"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(output, /vite/);
    assert.equal(existsSync(join(root, "apps", "desktop-v2", "dist", "index.html")), true);
  });
});
