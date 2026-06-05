import { describe, expect, it } from "vitest";
import { createAdapterRuntime, expectRetiredCapability } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Safety Policy", () => {
  it("loads safety policy decisions through a Desktop adapter capability", async () => {
    expectRetiredCapability("safety.approval.review");

    const { runtime } = createAdapterRuntime("safety", {
      id: "safety.policy.decide",
      title: "Decide Safety Policy",
      surface: "drawer",
      handler: ({ input }) => {
        if (input.unavailable) return { decision: "unavailable-denied" };
        if (input.timedOut) return { decision: "timeout-denied" };
        if (input.trusted) return { decision: "fully-authorized" };
        return { decision: input.riskClass === "critical" ? "approval-required" : "risk-notice" };
      },
    });

    await expect(runtime.invoke("safety.policy.decide", { riskClass: "critical" })).resolves.toEqual({
      decision: "approval-required",
    });
    await expect(runtime.invoke("safety.policy.decide", { riskClass: "medium" })).resolves.toEqual({
      decision: "risk-notice",
    });
    await expect(runtime.invoke("safety.policy.decide", { trusted: true })).resolves.toEqual({
      decision: "fully-authorized",
    });
  });
});
