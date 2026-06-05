import { describe, expect, it } from "vitest";
import { createAdapterRuntime } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Project Skill Activation", () => {
  it("loads project-scoped activation lookup through a Desktop adapter", async () => {
    const { runtime } = createAdapterRuntime("skills", {
      id: "skills.activate",
      title: "Activate Skill",
      surface: "drawer",
      handler: ({ input }) => {
        const projectOverride = input.projectOverrides[input.skillId];
        return {
          skillId: input.skillId,
          enabled: projectOverride ?? input.globalDefaultEnabled,
          source: projectOverride === undefined ? "global-default" : "project",
          workspaceRuleDeploymentsCreated: false,
        };
      },
    });

    await expect(runtime.invoke("skills.activate", {
      skillId: "diagnose",
      globalDefaultEnabled: true,
      projectOverrides: { diagnose: false },
    })).resolves.toEqual({
      skillId: "diagnose",
      enabled: false,
      source: "project",
      workspaceRuleDeploymentsCreated: false,
    });
    await expect(runtime.invoke("skills.activate", {
      skillId: "tdd",
      globalDefaultEnabled: true,
      projectOverrides: {},
    })).resolves.toMatchObject({ enabled: true, source: "global-default" });
  });
});
