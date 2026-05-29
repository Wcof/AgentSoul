import { describe, it, expect } from "vitest";
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

    expect(rootPackage.private).toBe(true);
    expect(rootPackage.workspaces).toContain("apps/desktop-v2");
    expect(rootPackage.workspaces).toContain("packages/domain");
    expect(rootPackage.workspaces.length).toBeGreaterThanOrEqual(14);
    expect(rootPackage.scripts["v2:test"]).toMatch(/vitest run/);
    expect(rootPackage.scripts["v2:typecheck"]).toMatch(/typecheck/);
    expect(rootPackage.scripts["v2:dev"]).toBe("npm --workspace @agentsoul/desktop-v2 run dev");
    expect(rootPackage.scripts["v2:build"]).toBe("npm --workspace @agentsoul/desktop-v2 run build");

    expect(appPackage.name).toBe("@agentsoul/desktop-v2");
    expect(appPackage.scripts.test).toMatch(/vitest/);
    expect(appPackage.scripts.typecheck).toBe("tsc --noEmit");
    expect(appPackage.scripts.dev).toBe("vite --host 127.0.0.1");
    expect(appPackage.scripts.build).toBe("vite build");
    expect(appPackage.scripts.tauri).toBe("tauri");

    expect(existsSync(join(root, "apps", "desktop-v2", "src", "main.ts"))).toBe(true);
    expect(existsSync(join(root, "apps", "desktop-v2", "src-tauri", "tauri.conf.json"))).toBe(true);
    expect(existsSync(join(root, "src", "gateway", "proxy_server.py"))).toBe(true);
    expect(existsSync(join(root, "src", "desktop_pet", "widget.py"))).toBe(true);
    expect(existsSync(join(root, "apps", "mcp-server", "src", "index.ts"))).toBe(true);
  });

  it("runs a v2 command through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "v2:typecheck"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/@agentsoul\/desktop-v2@2\.0\.0-alpha\.0 typecheck/);
  }, 30000);

  it("builds the minimal v2 web shell through the root workspace script", () => {
    const output = execFileSync("npm", ["run", "v2:build"], {
      cwd: root,
      encoding: "utf8",
    });

    expect(output).toMatch(/vite/);
    expect(existsSync(join(root, "apps", "desktop-v2", "dist", "index.html"))).toBe(true);
  }, 30000);
});
