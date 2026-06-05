import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Approval Required flow", () => {
  it("loads pending approval review through the Desktop extension runtime", async () => {
    const { runtime, events } = createAdapterRuntime("safety", {
      id: "safety.approval.review",
      title: "Review Safety Approval",
      surface: "drawer",
      handler: ({ input, emit }) => {
        emit({ type: "safety.approval.reviewed", payload: { approvalId: input.approvalId } });
        if (input.decision === "timeout") return { decision: "timeout-denied" };
        if (input.decision === "unavailable") return { decision: "unavailable-denied" };
        return { decision: input.decision };
      },
    });

    await expect(runtime.invoke("safety.approval.review", {
      approvalId: "approval-1",
      decision: "approved",
    })).resolves.toEqual({ decision: "approved" });
    await expect(runtime.invoke("safety.approval.review", {
      approvalId: "approval-2",
      decision: "timeout",
    })).resolves.toEqual({ decision: "timeout-denied" });
    expect(events).toEqual([
      { type: "safety.approval.reviewed", payload: { approvalId: "approval-1" } },
      { type: "safety.approval.reviewed", payload: { approvalId: "approval-2" } },
    ]);
  });
});
