import { describe, expect, it } from "vitest";
import { createAdapterRuntime, expectRetiredCapability } from "./extension-runtime-contract-helpers.mjs";

describe("AgentSoul v2 MCP adapter", () => {
  it("registers MCP tools through Desktop extension runtime instead of a required workspace package", async () => {
    expectRetiredCapability("mcp.server.manage");

    const { runtime, events } = createAdapterRuntime("mcp-adapter", {
      id: "mcp.server.manage",
      title: "Manage MCP Server",
      surface: "drawer",
      handler: ({ input, emit }) => {
        emit({ type: "mcp.tool.invoked", payload: { tool: input.tool } });
        return {
          controlledEntryPoint: "mcp-server",
          tool: input.tool,
          safetyPolicy: input.requiresApproval ? "approval-required" : "fully-authorized",
        };
      },
    });

    await expect(runtime.invoke("mcp.server.manage", {
      tool: "agentsoul_request_controlled_action",
      requiresApproval: true,
    })).resolves.toEqual({
      controlledEntryPoint: "mcp-server",
      tool: "agentsoul_request_controlled_action",
      safetyPolicy: "approval-required",
    });
    expect(events).toEqual([
      { type: "mcp.tool.invoked", payload: { tool: "agentsoul_request_controlled_action" } },
    ]);
  });
});
