import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

    assert.equal(existsSync(cargoTomlPath), true);
    assert.equal(existsSync(mainPath), true);
    assert.equal(existsSync(libPath), true);

    const cargoToml = readFileSync(cargoTomlPath, "utf8");
    const lib = readFileSync(libPath, "utf8");
    const frontend = readFileSync(frontendPath, "utf8");
    const config = JSON.parse(readFileSync(configPath, "utf8"));

    assert.match(cargoToml, /tauri/);
    assert.match(lib, /get_companion_runtime_state/);
    assert.match(lib, /show_desktop_companion/);
    assert.match(lib, /show_control_center/);
    assert.match(lib, /Approval Required/);
    assert.match(lib, /Risk Notice/);
    assert.match(frontend, /loadCompanionRuntimeSnapshot/);
    assert.match(frontend, /get_companion_runtime_state/);
    assert.match(frontend, /@tauri-apps\/api\/core/);

    const windowLabels = config.app.windows.map((window) => window.label);
    assert.deepEqual(windowLabels.sort(), ["control-center", "desktop-companion"]);
  });
});
