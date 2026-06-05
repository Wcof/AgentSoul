import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Workspace Rule Deployment", () => {
  it("keeps workspace rule deployment as a future adapter capability, not an intrinsic package", async () => {
    const { runtime } = createAdapterRuntime("skills", {
      id: "skills.rules.deploy",
      title: "Deploy Workspace Rules",
      surface: "drawer",
      handler: ({ input }) => {
        if (input.conflict === "user-authored-file") return { kind: "approval-required" };
        return {
          kind: "managed-rule-files",
          strategy: input.strategy,
          cleanupScope: "owned-files-only",
        };
      },
    });

    await expect(runtime.invoke("skills.rules.deploy", {
      strategy: "copy",
      conflict: "user-authored-file",
    })).resolves.toEqual({ kind: "approval-required" });
    await expect(runtime.invoke("skills.rules.deploy", {
      strategy: "symlink",
      conflict: "none",
    })).resolves.toEqual({
      kind: "managed-rule-files",
      strategy: "symlink",
      cleanupScope: "owned-files-only",
    });
  });
});
