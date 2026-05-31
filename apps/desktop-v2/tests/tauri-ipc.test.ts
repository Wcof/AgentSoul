import { afterEach, describe, expect, it, vi } from "vitest";

describe("tauri IPC wrapper", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete (globalThis as any).__TAURI__;
    delete (globalThis as any).__TAURI_INTERNALS__;
  });

  it("uses the Tauri v2 core invoke bridge when it is present", async () => {
    const invoke = vi.fn(async (command: string, args?: Record<string, unknown>) => ({ command, args }));
    (globalThis as any).__TAURI__ = { core: { invoke } };

    const { hasTauriIpc, tauriInvoke } = await import("../src/utils/tauriIpc.ts");

    expect(hasTauriIpc()).toBe(true);
    await expect(tauriInvoke("pick_pet_asset_pack_folder", { from: "test" })).resolves.toEqual({
      command: "pick_pet_asset_pack_folder",
      args: { from: "test" },
    });
  });

  it("fails with a stable unavailable error outside the desktop bridge", async () => {
    const { hasTauriIpc, tauriInvoke } = await import("../src/utils/tauriIpc.ts");

    expect(hasTauriIpc()).toBe(false);
    await expect(tauriInvoke("pick_pet_asset_pack_folder")).rejects.toThrow("tauri_invoke_unavailable");
  });
});
