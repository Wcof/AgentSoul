import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Gateway Provider Adapter", () => {
  it("can be loaded as an external capability adapter with unsupported-route behavior", async () => {
    const { runtime } = createAdapterRuntime("gateway-provider", {
      id: "gateway.provider.route",
      title: "Route Provider Request",
      surface: "drawer",
      handler: ({ input }) => {
        if (input.route !== "chat.completions") return { kind: "unsupported-route", route: input.route };
        return { kind: "translated", provider: input.provider };
      },
    });

    await expect(runtime.invoke("gateway.provider.route", {
      provider: "openai-compatible",
      route: "chat.completions",
    })).resolves.toEqual({ kind: "translated", provider: "openai-compatible" });
    await expect(runtime.invoke("gateway.provider.route", { route: "images.generate" })).resolves.toEqual({
      kind: "unsupported-route",
      route: "images.generate",
    });
  });
});
