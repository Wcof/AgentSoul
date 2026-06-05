import { describe, expect, it } from "vitest";
import { createAdapterRuntime, expectRetiredCapability } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 Skill Source Store and Installation", () => {
  it("loads skill installation as a Desktop adapter capability without requiring a skills workspace", async () => {
    expectRetiredCapability("skills.activate");

    const { runtime } = createAdapterRuntime("skills", {
      id: "skills.install",
      title: "Install Skill Pack",
      surface: "drawer",
      handler: ({ input }) => ({
        installed: true,
        source: input.source,
        metadata: input.metadata,
        workspaceRuleDeploymentsCreated: false,
      }),
    });

    await expect(runtime.invoke("skills.install", {
      source: "local-skill-pack",
      metadata: { name: "diagnose" },
    })).resolves.toEqual({
      installed: true,
      source: "local-skill-pack",
      metadata: { name: "diagnose" },
      workspaceRuleDeploymentsCreated: false,
    });
  });
});
