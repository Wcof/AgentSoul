import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Gateway Audit Records", () => {
  it("can load a metadata-only audit adapter without requiring a built-in gateway package", async () => {
    const { runtime } = createAdapterRuntime("gateway-audit", {
      id: "gateway.audit.summarize",
      title: "Summarize Gateway Audit",
      surface: "drawer",
      handler: ({ input }) => ({
        dailyCosts: [{ date: "2026-06-05", estimatedCost: input.estimatedCost }],
        modelMix: { [input.model]: 1 },
        providerMix: { [input.provider]: 1 },
      }),
    });

    const summary = await runtime.invoke("gateway.audit.summarize", {
      provider: "local",
      model: "test-model",
      estimatedCost: 0.02,
      requestBody: "must-not-be-returned",
    });

    expect(summary).toEqual({
      dailyCosts: [{ date: "2026-06-05", estimatedCost: 0.02 }],
      modelMix: { "test-model": 1 },
      providerMix: { local: 1 },
    });
    expect(JSON.stringify(summary)).not.toMatch(/requestBody|responseBody|promptBody/i);
  });
});
