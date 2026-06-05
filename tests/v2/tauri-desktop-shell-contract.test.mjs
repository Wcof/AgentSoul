import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const tauriRoot = join(root, "apps", "desktop-v2", "src-tauri");

describe("AgentSoul v2 Tauri Desktop Companion shell", () => {
  it("declares a buildable Tauri native shell with Desktop Body as the only product window", () => {
    const cargoTomlPath = join(tauriRoot, "Cargo.toml");
    const mainPath = join(tauriRoot, "src", "main.rs");
    const libPath = join(tauriRoot, "src", "lib.rs");
    const configPath = join(tauriRoot, "tauri.conf.json");
    const frontendMainPath = join(root, "apps", "desktop-v2", "src", "main.ts");
    const frontendDesktopBodyPath = join(root, "apps", "desktop-v2", "src", "desktop-body", "bootstrap.ts");
    const frontendTauriIpcPath = join(root, "apps", "desktop-v2", "src", "utils", "tauriIpc.ts");

    expect(existsSync(cargoTomlPath)).toBe(true);
    expect(existsSync(mainPath)).toBe(true);
    expect(existsSync(libPath)).toBe(true);

    const cargoToml = readFileSync(cargoTomlPath, "utf8");
    const lib = readFileSync(libPath, "utf8");
    const frontendMain = readFileSync(frontendMainPath, "utf8");
    const frontendDesktopBody = readFileSync(frontendDesktopBodyPath, "utf8");
    const frontendTauriIpc = readFileSync(frontendTauriIpcPath, "utf8");
    const config = JSON.parse(readFileSync(configPath, "utf8"));

    expect(cargoToml).toMatch(/tauri/);
    expect(lib).toMatch(/get_companion_runtime_state/);
    expect(lib).toMatch(/show_desktop_companion/);
    expect(lib).not.toMatch(/show_control_center/);
    expect(frontendMain).toMatch(/bootstrapDesktopBody/);
    expect(frontendDesktopBody).toMatch(/loadDesktopBodySnapshot/);
    expect(frontendDesktopBody).toMatch(/get_companion_runtime_state/);
    expect(frontendDesktopBody).toMatch(/tauriInvoke/);
    expect(frontendTauriIpc).toMatch(/@tauri-apps\/api\/core/);

    const windowLabels = config.app.windows.map((window) => window.label);
    expect(windowLabels).toEqual(["desktop-companion"]);

    expect(config.app.security.assetProtocol.enable).toBe(true);
    expect(JSON.stringify(config.app.security.assetProtocol.scope)).toMatch(/codex-pet/);
    expect(config.app.security.assetProtocol.scope).toEqual(
      expect.arrayContaining([
        "$DOWNLOAD/*.codex-pet/**",
        "/Users/ldh/Downloads/*.codex-pet/**",
      ]),
    );
    expect(config.app.security.capabilities).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          windows: expect.arrayContaining(["desktop-companion"]),
          permissions: expect.arrayContaining(["core:window:allow-start-dragging"]),
        }),
      ]),
    );
    expect(lib).toMatch(/yuanqi-mianmian\.codex-pet/);
  });
});
