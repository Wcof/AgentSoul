import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Risk Notice flow", () => {
  it("loads non-blocking Risk Notice state through a Desktop adapter", async () => {
    const { runtime } = createAdapterRuntime("safety", {
      id: "safety.risk-notice.list",
      title: "List Risk Notices",
      surface: "drawer",
      handler: ({ input }) => ({
        blocking: false,
        notices: input.notices.filter((notice) => notice.status !== "fully-authorized"),
      }),
    });

    await expect(runtime.invoke("safety.risk-notice.list", {
      notices: [
        { id: "notice-1", status: "risk-notice" },
        { id: "notice-2", status: "fully-authorized" },
      ],
    })).resolves.toEqual({
      blocking: false,
      notices: [{ id: "notice-1", status: "risk-notice" }],
    });
  });
});
