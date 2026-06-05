import { describe, expect, it } from "vitest";
import { createAdapterRuntime, expectRetiredCapability } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Session Source scanning", () => {
  it("exposes session source scanning as a future Desktop adapter capability", async () => {
    expectRetiredCapability("sessions.resume");

    const { runtime } = createAdapterRuntime("sessions", {
      id: "sessions.scan",
      title: "Scan Session Source",
      surface: "drawer",
      handler: ({ input }) => ({
        sourceId: input.sourceId,
        sessions: input.rows
          .filter((row) => row.kind === "message")
          .map((row) => ({ id: row.id, resumable: row.resumable === true })),
        skippedMalformed: input.rows.filter((row) => row.kind !== "message").length,
      }),
    });

    await expect(runtime.invoke("sessions.scan", {
      sourceId: "claude-jsonl",
      rows: [
        { id: "s1", kind: "message", resumable: true },
        { id: "bad", kind: "malformed" },
      ],
    })).resolves.toEqual({
      sourceId: "claude-jsonl",
      sessions: [{ id: "s1", resumable: true }],
      skippedMalformed: 1,
    });
  });
});
