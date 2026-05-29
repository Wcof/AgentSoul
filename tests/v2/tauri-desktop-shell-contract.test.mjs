import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const tauriRoot = join(root, "apps", "desktop-v2", "src-tauri");

describe("AgentSoul v2 Tauri Desktop Companion shell", () => {
  it("declares a buildable Tauri native shell with companion and control-center windows", () => {
    const cargoTomlPath = join(tauriRoot, "Cargo.toml");
    const mainPath = join(tauriRoot, "src", "main.rs");
    const libPath = join(tauriRoot, "src", "lib.rs");
    const configPath = join(tauriRoot, "tauri.conf.json");
    const frontendPath = join(root, "apps", "desktop-v2", "src", "main.ts");

    expect(existsSync(cargoTomlPath)).toBe(true);
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(libPath)).toBe(true);

    const cargoToml = readFileSync(cargoTomlPath, "utf8");
    const lib = readFileSync(libPath, "utf8");
    const frontend = readFileSync(frontendPath, "utf8");
    const config = JSON.parse(readFileSync(configPath, "utf8"));

    expect(cargoToml).toMatch(/tauri/);
    expect(lib).toMatch(/get_companion_runtime_state/);
    expect(lib).toMatch(/show_desktop_companion/);
    expect(lib).toMatch(/show_control_center/);
    expect(lib).toMatch(/Approval Required/);
    expect(lib).toMatch(/Risk Notice/);
    expect(frontend).toMatch(/loadCompanionRuntimeSnapshot/);
    expect(frontend).toMatch(/get_companion_runtime_state/);
    expect(frontend).toMatch(/@tauri-apps\/api\/core/);

    const windowLabels = config.app.windows.map((window) => window.label);
    expect(windowLabels.sort()).toEqual(["control-center", "desktop-companion"]);
  });
});
