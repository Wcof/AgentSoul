import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 safety-gated Session Launcher", () => {
  it("keeps launch-session as an adapter-owned capability gated by runtime invocation", async () => {
    const { runtime } = createAdapterRuntime("sessions", {
      id: "sessions.resume",
      title: "Resume Session",
      surface: "drawer",
      handler: ({ input }) => {
        if (!input.resumable) return { kind: "blocked", reason: "non-resumable" };
        if (input.safetyPolicy === "approval-required") return { kind: "approval-required" };
        return { kind: "launched", action: "launch-session", command: input.resumeCommand };
      },
    });

    await expect(runtime.invoke("sessions.resume", { resumable: false })).resolves.toEqual({
      kind: "blocked",
      reason: "non-resumable",
    });
    await expect(runtime.invoke("sessions.resume", {
      resumable: true,
      safetyPolicy: "approval-required",
    })).resolves.toEqual({ kind: "approval-required" });
    await expect(runtime.invoke("sessions.resume", {
      resumable: true,
      safetyPolicy: "fully-authorized",
      resumeCommand: "codex resume s1",
    })).resolves.toEqual({
      kind: "launched",
      action: "launch-session",
      command: "codex resume s1",
    });
  });
});
