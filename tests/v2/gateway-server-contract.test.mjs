import { describe, expect, it } from "vitest";
import {
  createAdapterRuntime,
  expectExtensionRuntimeAdapterSurface,
  expectRetiredCapability,
} from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Gateway server shell", () => {
  it("treats Gateway as a future Desktop extension adapter, not a required workspace package", async () => {
    expectExtensionRuntimeAdapterSurface();
    expectRetiredCapability("gateway.status");

    const { runtime, events } = createAdapterRuntime("gateway", {
      id: "gateway.status",
      title: "Gateway Status",
      surface: "drawer",
      handler: ({ input, emit }) => {
        emit({ type: "gateway.status.checked", payload: input });
        return { online: true, profileId: input.profileId };
      },
    });

    expect(runtime.listCapabilities()).toEqual([
      {
        id: "gateway.status",
        extensionId: "gateway",
        title: "Gateway Status",
        surface: "drawer",
      },
    ]);
    await expect(runtime.invoke("gateway.status", { profileId: "active-profile" })).resolves.toEqual({
      online: true,
      profileId: "active-profile",
    });
    expect(events).toEqual([
      { type: "gateway.status.checked", payload: { profileId: "active-profile" } },
    ]);
  });
});
