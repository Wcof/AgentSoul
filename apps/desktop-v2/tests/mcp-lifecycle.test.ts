import { describe, expect, it, vi } from "vitest";

describe("Issue #100: MCP server lifecycle", () => {
  it("creates an MCP server through the control plane", async () => {
    let createdBody: any = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/mcp-servers") && init?.method === "POST") {
        createdBody = JSON.parse(init.body as string);
        return {
          ok: true,
          status: 201,
          json: async () => ({
            server: {
              id: "mcp-new",
              name: createdBody.name,
              command: createdBody.command,
              args: createdBody.args,
              status: "stopped",
            },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      fetchImpl: fetchMock,
    });

    const server = await client.createMcpServer({
      name: "Filesystem MCP",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
    });

    expect(server).not.toBeNull();
    expect(server!.id).toBe("mcp-new");
    expect(server!.name).toBe("Filesystem MCP");
    expect(createdBody).not.toBeNull();
    expect(createdBody.command).toBe("npx");
  });

  it("toggles MCP server status through the control plane", async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/mcp-servers/") && init?.method === "PUT") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            server: { id: "mcp-1", name: "FS", command: "npx", status: "running" },
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      fetchImpl: fetchMock,
    });

    const server = await client.toggleMcpServer("mcp-1");
    expect(server).not.toBeNull();
    expect(server!.status).toBe("running");
  });

  it("deletes MCP server through the control plane", async () => {
    let deleteUrl: string | null = null;
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("/mcp-servers/") && init?.method === "DELETE") {
        deleteUrl = url;
        return { ok: true, status: 204, json: async () => ({}) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      fetchImpl: fetchMock,
    });

    await client.deleteMcpServer("mcp-1");
    expect(deleteUrl).toContain("/mcp-servers/mcp-1");
  });

  it("loads MCP servers in the boot snapshot", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels") && !url.includes("/mcp")) {
        return { ok: true, status: 200, json: async () => ({ channels: [] }) };
      }
      if (url.includes("/dashboard")) {
        return { ok: true, status: 200, json: async () => ({ channels: [], metrics: [], costSummary: {}, gatewayHealth: {} }) };
      }
      if (url.includes("/mcp-servers")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            servers: [
              { id: "mcp-1", name: "Filesystem", command: "npx", status: "running", toolCount: 5 },
            ],
          }),
        };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      fetchImpl: fetchMock,
    });

    const snapshot = await client.loadSnapshot();
    expect(snapshot.mcpServers).toHaveLength(1);
    expect(snapshot.mcpServers[0].name).toBe("Filesystem");
  });
});
