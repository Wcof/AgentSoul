import { describe, expect, it, vi, beforeEach } from "vitest";

// We test the module through its public interface — loading snapshots, CRUD ops.
// The client abstracts between Tauri invoke and HTTP fetch.

describe("local control client", () => {
  it("attaches bearer authorization header when accessKey is provided", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        channels: [],
      }),
    }));

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      accessKey: "test-access-key",
      fetchImpl: fetchMock,
    });

    await client.listSessions();
    expect(fetchMock).toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer test-access-key");
  });

  it("updates authorization header after setAccessKey without recreating client", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (url.includes("/sessions")) {
        return { ok: true, status: 200, json: async () => ({ sessions: [] }) };
      }
      return { ok: false, status: 404, json: async () => ({}) };
    });

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      fetchImpl: fetchMock,
    });

    await client.listSessions();
    let [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBeUndefined();

    client.setAccessKey("runtime-key");
    await client.listSessions();
    [, init] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer runtime-key");
  });

  it("loads channels from gateway HTTP surface", async () => {
    const fetchMock = vi.fn(async (url, init) => {
      if (url.includes("/channels") && (!init || init.method === "GET")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            channels: [
              {
                id: "ch-1",
                name: "OpenAI Primary",
                type: "openai-chat",
                baseUrl: "http://127.0.0.1:8787/v1",
                apiKeys: ["local-key"],
                priority: 0,
                status: "active",
                createdAt: "2026-01-01T00:00:00Z",
                updatedAt: "2026-01-01T00:00:00Z",
              },
            ],
          }),
        };
      }
      if (url.includes("/dashboard")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            channels: [],
            metrics: [],
            costSummary: {
              totalEstimatedCost: 0,
              totalInputTokens: 0,
              totalOutputTokens: 0,
              totalRequests: 0,
              byChannel: [],
              byModel: [],
              dailyTrend: [],
            },
            gatewayHealth: { status: "ok" },
          }),
        };
      }
      if (url.includes("/settings")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            settings: {
              autoFailover: false,
              failoverThreshold: 9,
              circuitBreakerTimeout: 180,
            },
          }),
        };
      }
      if (url.includes("/skills")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            skills: {
              projectPath: "/workspace/project",
              installedSkillPacks: [{ id: "tdd", name: "TDD", source: "local", installedAt: "2026-01-01T00:00:00Z" }],
              projectActivations: [{ skillPackId: "tdd", enabled: true, source: "project" }],
              workspaceRuleDeployments: [],
            },
          }),
        };
      }
      if (url.includes("/sessions")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            sessions: [
              {
                id: "sess-1",
                provider: "codex",
                projectDir: "/workspace/project-a",
                summary: "Gateway wiring refactor",
                lastActiveAt: "2026-01-01T00:00:00Z",
                messageCount: 12,
                isResumable: true,
                resumeCommand: "codex resume sess-1",
              },
            ],
          }),
        };
      }
      if (url.includes("/approval-requests")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            approvalRequests: [
              {
                id: "approval-1",
                title: "Write File",
                message: "Need confirmation",
                actionRiskClass: "high-risk",
                createdAt: "2026-01-01T00:00:00Z",
                status: "Approval Required",
              },
            ],
          }),
        };
      }
      if (url.includes("/risk-notices")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            riskNotices: [
              {
                id: "risk-1",
                message: "CLI elevated",
                observedAt: "2026-01-01T00:00:00Z",
                clientAuthorizationMode: "elevated",
              },
            ],
          }),
        };
      }
      if (url.includes("/trust-grants")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            trustGrants: [
              {
                id: "trust-1",
                actionKinds: ["write-file"],
                maxRiskClass: "high-risk",
                expiresAt: "2026-01-02T00:00:00Z",
              },
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
    expect(snapshot.channels).toHaveLength(1);
    expect(snapshot.channels[0].id).toBe("ch-1");
    expect(snapshot.channels[0].name).toBe("OpenAI Primary");
    expect(snapshot.appSettings.autoFailover).toBe(false);
    expect(snapshot.appSettings.failoverThreshold).toBe(9);
    expect(snapshot.appSettings.circuitBreakerTimeout).toBe(180);
    expect(snapshot.skills.projectPath).toBe("/workspace/project");
    expect(snapshot.skills.projectActivations[0].enabled).toBe(true);
    expect(snapshot.safety.approvalRequests[0].id).toBe("approval-1");
    expect(snapshot.safety.riskNotices[0].id).toBe("risk-1");
    expect(snapshot.safety.scopedTrustGrants[0].id).toBe("trust-1");
    expect(snapshot.sessions.workSessions[0].id).toBe("sess-1");
    expect(snapshot.sessions.workSessions[0].projectPath).toBe("/workspace/project-a");
  });

  it("creates a channel through gateway HTTP", async () => {
    let createdBody = null;
    const fetchMock = vi.fn(async (url, init) => {
      if (url.includes("/channels") && init?.method === "POST") {
        createdBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 201,
          json: async () => ({
            channel: {
              id: "ch-new",
              name: createdBody.name,
              type: createdBody.type,
              baseUrl: createdBody.baseUrl,
              apiKeys: createdBody.apiKeys,
              priority: 0,
              status: "active",
              createdAt: "2026-01-01T00:00:00Z",
              updatedAt: "2026-01-01T00:00:00Z",
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

    const channel = await client.createChannel({
      name: "New Channel",
      type: "openai-chat",
      baseUrl: "http://localhost:3000",
      apiKeys: ["key-1"],
    });

    expect(channel.id).toBe("ch-new");
    expect(channel.name).toBe("New Channel");
    expect(createdBody).not.toBeNull();
    expect(createdBody.name).toBe("New Channel");
  });

  it("deletes a channel through gateway HTTP", async () => {
    let deleteUrl = null;
    const fetchMock = vi.fn(async (url, init) => {
      if (url.includes("/channels/") && init?.method === "DELETE") {
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

    await client.deleteChannel("ch-1");
    expect(deleteUrl).toContain("/channels/ch-1");
  });

  it("returns empty snapshot when gateway is unreachable", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("Connection refused");
    });

    const { createLocalControlClient } = await import("../src/utils/localControlClient.ts");
    const client = createLocalControlClient({
      gatewayBase: "http://127.0.0.1:9999",
      fetchImpl: fetchMock,
    });

    const snapshot = await client.loadSnapshot();
    expect(snapshot.channels).toHaveLength(0);
  });

  it("keeps partial snapshot data when channels endpoint fails", async () => {
    const fetchMock = vi.fn(async (url) => {
      if (url.includes("/channels")) {
        return { ok: false, status: 503, json: async () => ({ error: "unavailable" }) };
      }
      if (url.includes("/settings")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            settings: {
              autoFailover: false,
              failoverThreshold: 7,
              circuitBreakerTimeout: 99,
            },
          }),
        };
      }
      if (url.includes("/skills")) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            skills: {
              projectPath: "/workspace/partial",
              installedSkillPacks: [],
              projectActivations: [],
              workspaceRuleDeployments: [],
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

    const snapshot = await client.loadSnapshot();
    expect(snapshot.channels).toHaveLength(0);
    expect(snapshot.appSettings.autoFailover).toBe(false);
    expect(snapshot.appSettings.failoverThreshold).toBe(7);
    expect(snapshot.skills.projectPath).toBe("/workspace/partial");
  });
});
