import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Scoped Trust Grants", () => {
  it("loads scoped trust matching as adapter-owned state", async () => {
    const { runtime } = createAdapterRuntime("safety", {
      id: "safety.trust.match",
      title: "Match Scoped Trust",
      surface: "drawer",
      handler: ({ input }) => {
        const grant = input.grants.find((candidate) =>
          input.targetPath.startsWith(candidate.targetPathPrefix)
          && input.providerProfileId === candidate.providerProfileId
          && input.now < candidate.expiresAt
          && input.actionRiskClass !== "critical",
        );
        return grant ? { trusted: true, grantId: grant.id } : { trusted: false };
      },
    });

    await expect(runtime.invoke("safety.trust.match", {
      targetPath: "/workspace/project/file.ts",
      providerProfileId: "profile-1",
      now: "2026-06-05T09:00:00.000Z",
      actionRiskClass: "medium",
      grants: [{
        id: "trust-1",
        targetPathPrefix: "/workspace/project",
        providerProfileId: "profile-1",
        expiresAt: "2026-06-05T10:00:00.000Z",
      }],
    })).resolves.toEqual({ trusted: true, grantId: "trust-1" });
    await expect(runtime.invoke("safety.trust.match", {
      targetPath: "/workspace/project/file.ts",
      providerProfileId: "profile-1",
      now: "2026-06-05T09:00:00.000Z",
      actionRiskClass: "critical",
      grants: [{
        id: "trust-1",
        targetPathPrefix: "/workspace/project",
        providerProfileId: "profile-1",
        expiresAt: "2026-06-05T10:00:00.000Z",
      }],
    })).resolves.toEqual({ trusted: false });
  });
});
