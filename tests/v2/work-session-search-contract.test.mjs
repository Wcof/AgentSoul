import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Work Session search", () => {
  it("loads searchable and resumable Work Session states through a Desktop adapter", async () => {
    const { runtime } = createAdapterRuntime("sessions", {
      id: "sessions.search",
      title: "Search Work Sessions",
      surface: "drawer",
      handler: ({ input }) => input.sessions
        .filter((session) => session.project === input.project)
        .map((session) => ({
          id: session.id,
          project: session.project,
          availableActions: session.resumable && session.resumeCommand ? ["resume"] : [],
        })),
    });

    await expect(runtime.invoke("sessions.search", {
      project: "AgentSoul",
      sessions: [
        { id: "s1", project: "AgentSoul", resumable: true, resumeCommand: "codex resume s1" },
        { id: "s2", project: "AgentSoul", resumable: false },
        { id: "s3", project: "Other", resumable: true, resumeCommand: "codex resume s3" },
      ],
    })).resolves.toEqual([
      { id: "s1", project: "AgentSoul", availableActions: ["resume"] },
      { id: "s2", project: "AgentSoul", availableActions: [] },
    ]);
  });
});
