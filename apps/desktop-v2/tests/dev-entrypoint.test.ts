import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = join(new URL("../../..", import.meta.url).pathname);
const rootPackageJson = JSON.parse(readFileSync(join(repoRoot, "package.json"), "utf8"));
const devDesktopScript = readFileSync(join(repoRoot, "scripts", "dev-desktop.mjs"), "utf8");
const tauriConfig = JSON.parse(
  readFileSync(join(repoRoot, "apps", "desktop-v2", "src-tauri", "tauri.conf.json"), "utf8"),
);

describe("development entrypoint", () => {
  it("starts the native desktop companion when running npm run dev from the repo root", () => {
    expect(rootPackageJson.scripts.dev).toBe("node scripts/dev-desktop.mjs");
    expect(devDesktopScript).toMatch(/@agentsoul\/desktop-v2/);
    expect(devDesktopScript).toMatch(/"tauri",\s*"--",\s*"dev"/);
  });

  it("adds the default Cargo bin directory before starting Tauri dev", () => {
    expect(devDesktopScript).toMatch(/\.cargo/);
    expect(devDesktopScript).toMatch(/PATH/);
    expect(devDesktopScript).toMatch(/requires Rust\/Cargo/);
    expect(devDesktopScript).toMatch(/fileURLToPath/);
    expect(devDesktopScript).not.toMatch(/import\.meta\.dirname/);
  });

  it("clears a stale repo-owned Vite dev server before Tauri starts", () => {
    expect(devDesktopScript).toMatch(/ensureDevPortAvailable/);
    expect(devDesktopScript).toMatch(/port:\s*"1420"/);
  });

  it("reuses an already-running Vite dev server instead of starting a duplicate", () => {
    expect(devDesktopScript).toMatch(/isDevServerResponding/);
    expect(devDesktopScript).toMatch(/beforeDevCommand/);
    expect(devDesktopScript).toMatch(/--no-dev-server-wait/);
    expect(devDesktopScript).toMatch(/--no-watch/);
  });

  it("keeps Vite as the frontend server used by Tauri dev", () => {
    expect(rootPackageJson.scripts["v2:dev"]).toBe("npm --workspace @agentsoul/desktop-v2 run dev");
    expect(tauriConfig.build.beforeDevCommand).toBe("npm run dev");
    expect(tauriConfig.build.devUrl).toBe("http://127.0.0.1:1420");
  });
});
