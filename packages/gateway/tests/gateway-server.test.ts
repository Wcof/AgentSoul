import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGatewayAuditRepository, startLocalGateway, createChannelStore, createCostTracker } from "@agentsoul/gateway";
import { createProviderProfileService } from "@agentsoul/provider";
import { createControlPlaneStore, SessionRepository, initializeV2Database } from "@agentsoul/persistence";
import Database from "better-sqlite3";

describe("Gateway server shell", () => {
  it("starts locally and reports no-profile route readiness without live provider calls", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const health = await getJson(gateway.url("/health"));

        expect(health.status).toBe("ok");
        expect(health.routeReady).toBe(false);
        expect(health.activeProviderProfile).toBe(null);
        expect(health.liveProviderCallRequired).toBe(false);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("reports the Active Provider Profile through the Gateway health boundary", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "gpt-4.1",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const health = await getJson(gateway.url("/health"));

        expect(health.routeReady).toBe(true);
        expect(health.activeProviderProfile.id).toBe("openai");
        expect(health.activeProviderProfile.credentialRef).toBe("credential:openai:primary");
        expect(JSON.stringify(health)).not.toMatch(/sk-|api[_-]?key|secret/i);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("returns OpenAI-compatible model list at /v1/models", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "gpt-4.1",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");
      const channelStore = createChannelStore({ dbPath });
      channelStore.createChannel({
        name: "Models",
        type: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKeys: ["key-1"],
        supportedModels: ["gpt-4.1-mini", "gpt-4.1"],
      });
      const gateway = await startLocalGateway({ providerProfiles, channelStore, port: 0 });

      try {
        const res = await fetch(gateway.url("/v1/models"));
        expect(res.status).toBe(200);
        const body = (await res.json()) as any;
        expect(body.object).toBe("list");
        expect(body.data.map((m: any) => m.id)).toEqual(["gpt-4.1", "gpt-4.1-mini"]);
      } finally {
        await gateway.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });

  it("enforces proxy access key for /v1 routes when configured", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({
        providerProfiles,
        proxyAccessKey: "proxy-test-key",
        port: 0,
      });

      try {
        const unauthorized = await fetch(gateway.url("/v1/models"));
        expect(unauthorized.status).toBe(401);

        const authorized = await fetch(gateway.url("/v1/models"), {
          headers: { Authorization: "Bearer proxy-test-key" },
        });
        expect(authorized.status).toBe(200);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("enforces admin access key for control-plane routes when configured", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({
        providerProfiles,
        adminAccessKey: "admin-test-key",
        port: 0,
      });

      try {
        const unauthorized = await fetch(gateway.url("/channels"));
        expect(unauthorized.status).toBe(401);

        const authorized = await fetch(gateway.url("/channels"), {
          headers: { Authorization: "Bearer admin-test-key" },
        });
        expect(authorized.status).toBe(503);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("falls back to proxy key for control-plane auth when admin key is omitted", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({
        providerProfiles,
        proxyAccessKey: "shared-key",
        port: 0,
      });

      try {
        const unauthorized = await fetch(gateway.url("/channels"));
        expect(unauthorized.status).toBe(401);

        const authorized = await fetch(gateway.url("/channels"), {
          headers: { Authorization: "Bearer shared-key" },
        });
        expect(authorized.status).toBe(503);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway Provider Adapter routing", () => {
  it("translates an OpenAI-compatible route without live provider calls", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "gpt-4.1",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const route = await postJson(gateway.url("/route"), {
          clientProtocol: "openai-chat",
          messages: [{ role: "user", content: "hello" }],
        });

        expect(route.status).toBe("translated");
        expect(route.adapter).toBe("openai-chat");
        expect(route.liveProviderCallRequired).toBe(false);
        expect(route.providerRequest.url).toBe("https://api.openai.com/v1/chat/completions");
        expect(route.providerRequest.body.model).toBe("gpt-4.1");
        expect(route.providerRequest.body.messages).toEqual([{ role: "user", content: "hello" }]);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("rejects Unsupported Routes explicitly", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "anthropic",
        name: "Anthropic",
        activationMode: "gateway-route",
        credentialRef: "credential:anthropic:primary",
        clientProtocol: "claude-messages",
        providerProtocol: "anthropic",
        targetModel: "claude-sonnet-4",
        endpoint: "https://api.anthropic.com",
      });
      providerProfiles.selectActiveProviderProfile("anthropic");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/route"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientProtocol: "openai-chat",
            messages: [{ role: "user", content: "hello" }],
          }),
        });
        const route = (await response.json()) as any;

        expect(response.status).toBe(422);
        expect(route.status).toBe("unsupported-route");
        expect(route.reason).toMatch(/openai-chat -> anthropic/);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("accepts OpenAI-compatible requests via /v1/chat/completions", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "gpt-4.1",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [{ role: "user", content: "hello through openai route" }],
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.status).toBe("translated");
        expect(body.providerRequest.url).toBe("https://api.openai.com/v1/chat/completions");
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("accepts Codex-compatible requests via /v1/responses", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "codex-openai",
        name: "Codex OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "codex-responses",
        providerProtocol: "openai-chat",
        targetModel: "gpt-4.1",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("codex-openai");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/responses"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.1",
            input: [{ role: "user", content: "hello through responses route" }],
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.status).toBe("translated");
        expect(body.adapter).toBe("codex-responses");
        expect(body.providerRequest.url).toBe("https://api.openai.com/v1/responses");
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("accepts OpenAI Images-compatible requests via /v1/images/generations", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai-images",
        name: "OpenAI Images",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:images",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "gpt-image-1",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai-images");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/images/generations"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-image-1",
            prompt: "cat with sunglasses",
            size: "1024x1024",
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.status).toBe("translated");
        expect(body.adapter).toBe("openai-images");
        expect(body.providerRequest.url).toBe("https://api.openai.com/v1/images/generations");
        expect(body.providerRequest.body.model).toBe("gpt-image-1");
        expect(body.providerRequest.body.prompt).toBe("cat with sunglasses");
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("accepts Claude-compatible requests via /v1/messages", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "anthropic",
        name: "Anthropic",
        activationMode: "gateway-route",
        credentialRef: "credential:anthropic:primary",
        clientProtocol: "claude-messages",
        providerProtocol: "anthropic",
        targetModel: "claude-sonnet-4",
        endpoint: "https://api.anthropic.com",
      });
      providerProfiles.selectActiveProviderProfile("anthropic");
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/messages"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4",
            messages: [{ role: "user", content: "hello through messages route" }],
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.status).toBe("translated");
        expect(body.adapter).toBe("anthropic-messages");
        expect(body.providerRequest.url).toBe("https://api.anthropic.com/v1/messages");
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("prefers higher-priority channel and applies model mapping for /v1/chat/completions", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "fallback-model",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");

      const channelStore = createChannelStore({ dbPath });
      channelStore.createChannel({
        name: "Low Priority",
        type: "openai",
        baseUrl: "https://low.example.com/v1",
        apiKeys: ["low-key"],
        priority: 1,
        supportedModels: ["gpt-4.1-mini"],
      });
      channelStore.createChannel({
        name: "High Priority",
        type: "openai",
        baseUrl: "https://high.example.com/v1",
        apiKeys: ["high-key"],
        priority: 10,
        modelMapping: {
          "gpt-5": "deepseek-v4-pro",
        },
      });

      const gateway = await startLocalGateway({ providerProfiles, channelStore, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-5",
            messages: [{ role: "user", content: "route by channel priority and mapping" }],
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.status).toBe("translated");
        expect(body.providerRequest.url).toBe("https://high.example.com/v1/chat/completions");
        expect(body.providerRequest.body.model).toBe("deepseek-v4-pro");
      } finally {
        await gateway.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });

  it("fails over to the next channel when the highest-priority channel circuit is open", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "fallback-model",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");

      const channelStore = createChannelStore({ dbPath });
      const high = channelStore.createChannel({
        name: "High Priority Broken",
        type: "openai",
        baseUrl: "https://high-broken.example.com/v1",
        apiKeys: ["high-key"],
        priority: 10,
        supportedModels: ["gpt-4.1"],
      });
      const low = channelStore.createChannel({
        name: "Lower Priority Healthy",
        type: "openai",
        baseUrl: "https://low-healthy.example.com/v1",
        apiKeys: ["low-key"],
        priority: 1,
        supportedModels: ["gpt-4.1"],
      });

      // Drive high-priority channel into open circuit.
      for (let i = 0; i < 5; i += 1) {
        channelStore.recordRequest(high.id, {
          success: false,
          latencyMs: 100,
          inputTokens: 10,
          outputTokens: 0,
          estimatedCost: 0,
        });
      }

      const gateway = await startLocalGateway({ providerProfiles, channelStore, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [{ role: "user", content: "trigger failover" }],
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.status).toBe("translated");
        expect(body.providerRequest.url).toBe("https://low-healthy.example.com/v1/chat/completions");

        const highMetrics = channelStore.getChannelMetrics(high.id);
        const lowMetrics = channelStore.getChannelMetrics(low.id);
        expect(highMetrics?.circuitState).toBe("open");
        expect((lowMetrics?.requestCount ?? 0) >= 1).toBe(true);
      } finally {
        await gateway.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });

  it("respects autoFailover=false from control plane settings", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "fallback-model",
        endpoint: "https://api.openai.com/v1",
      });
      providerProfiles.selectActiveProviderProfile("openai");

      const channelStore = createChannelStore({ dbPath });
      const high = channelStore.createChannel({
        name: "High Priority",
        type: "openai",
        baseUrl: "https://high-no-failover.example.com/v1",
        apiKeys: ["high-key"],
        priority: 10,
        supportedModels: ["gpt-4.1"],
      });
      channelStore.createChannel({
        name: "Lower Priority",
        type: "openai",
        baseUrl: "https://low-no-failover.example.com/v1",
        apiKeys: ["low-key"],
        priority: 1,
        supportedModels: ["gpt-4.1"],
      });

      for (let i = 0; i < 5; i += 1) {
        channelStore.recordRequest(high.id, {
          success: false,
          latencyMs: 100,
          inputTokens: 10,
          outputTokens: 0,
          estimatedCost: 0,
        });
      }

      const store = createControlPlaneStore(dbPath);
      store.settings.save({
        autoFailover: false,
        failoverThreshold: 5,
        circuitBreakerTimeout: 60,
        mcpAutoStart: true,
        workspaceDir: "/workspace",
      });

      const gateway = await startLocalGateway({
        providerProfiles,
        channelStore,
        controlPlaneStore: store,
        port: 0,
      });

      try {
        const response = await fetch(gateway.url("/v1/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4.1",
            messages: [{ role: "user", content: "no auto failover" }],
          }),
        });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.providerRequest.url).toBe("https://high-no-failover.example.com/v1/chat/completions");
      } finally {
        await gateway.close();
        store.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway Audit Records", () => {
  it("persists metadata-only Audit Records for successful and failed Gateway traffic", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      providerProfiles.createProviderProfile({
        id: "openai",
        name: "OpenAI",
        activationMode: "gateway-route",
        credentialRef: "credential:openai:primary",
        clientProtocol: "openai-chat",
        providerProtocol: "openai-chat",
        targetModel: "gpt-4.1",
        endpoint: "https://api.openai.com/v1",
        pricing: { inputTokenUsd: 0.000002, outputTokenUsd: 0.000008 },
      });
      providerProfiles.selectActiveProviderProfile("openai");
      const audit = createGatewayAuditRepository({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, audit, port: 0 });

      try {
        await postJson(gateway.url("/route"), {
          clientProtocol: "openai-chat",
          tokenUsage: { inputTokens: 1200, outputTokens: 300 },
          messages: [{ role: "user", content: "private prompt body" }],
        });
        await fetch(gateway.url("/route"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            clientProtocol: "gemini",
            tokenUsage: { inputTokens: 10, outputTokens: 0 },
            messages: [{ role: "user", content: "failed private prompt body" }],
          }),
        });

        const records = audit.listAuditRecords();
        expect(records.length).toBe(2);
        expect(records[0].trafficMetadata.model).toBe("gpt-4.1");
        expect(records[0].trafficMetadata.providerProfileId).toBe("openai");
        expect(records[0].trafficMetadata.inputTokens).toBe(1200);
        expect(records[0].trafficMetadata.outputTokens).toBe(300);
        expect(records[0].outcome).toBe("translated");
        expect(records[0].estimatedCost).toBe(0.0048);
        expect(records[1].outcome).toBe("unsupported-route");

        const serialized = JSON.stringify(records);
        expect(serialized).not.toMatch(/private prompt body/);
        expect(serialized).not.toMatch(/failed private prompt body/);
      } finally {
        await gateway.close();
        audit.close();
        providerProfiles.close();
      }
    });
  });

  it("reads historical cost trends from persisted Audit Records within a retention window", async () => {
    await withGateway(async (dbPath) => {
      const audit = createGatewayAuditRepository({ dbPath });

      try {
        audit.recordAudit({
          trafficMetadata: {
            gatewayEventId: "event-1",
            clientProtocol: "openai-chat",
            providerProtocol: "openai-chat",
            providerProfileId: "openai-main",
            model: "gpt-4.1",
            route: "openai-chat -> openai-chat",
            inputTokens: 1000,
            outputTokens: 250,
            latencyMs: 800,
            outcome: "translated",
          },
          estimatedCost: 0.004,
          outcome: "translated",
          occurredAt: "2026-05-27T10:00:00.000Z",
        });
        audit.recordAudit({
          trafficMetadata: {
            gatewayEventId: "event-2",
            clientProtocol: "claude-messages",
            providerProtocol: "anthropic",
            providerProfileId: "anthropic-main",
            model: "claude-sonnet",
            route: "claude-messages -> anthropic",
            inputTokens: 2000,
            outputTokens: 500,
            latencyMs: 1200,
            outcome: "translated",
          },
          estimatedCost: 0.009,
          outcome: "translated",
          occurredAt: "2026-05-28T10:00:00.000Z",
        });
        audit.recordAudit({
          trafficMetadata: {
            gatewayEventId: "event-3",
            clientProtocol: "openai-chat",
            providerProtocol: "openai-chat",
            providerProfileId: "openai-main",
            model: "gpt-4.1",
            route: "openai-chat -> openai-chat",
            inputTokens: 500,
            outputTokens: 100,
            latencyMs: 400,
            outcome: "translated",
          },
          estimatedCost: 0.002,
          outcome: "translated",
          occurredAt: "2026-05-28T12:00:00.000Z",
        });

        const trends = audit.summarizeCostTrends({
          from: "2026-05-28T00:00:00.000Z",
          to: "2026-05-29T00:00:00.000Z",
        });

        expect(trends.dailyCosts).toEqual([
          {
            date: "2026-05-28",
            estimatedCost: 0.011,
            inputTokens: 2500,
            outputTokens: 600,
            requestCount: 2,
            averageLatencyMs: 800,
          },
        ]);
        expect(trends.modelMix).toEqual([
          { model: "claude-sonnet", requestCount: 1, estimatedCost: 0.009 },
          { model: "gpt-4.1", requestCount: 1, estimatedCost: 0.002 },
        ]);
        expect(trends.providerMix).toEqual([
          { providerProfileId: "anthropic-main", requestCount: 1, estimatedCost: 0.009 },
          { providerProfileId: "openai-main", requestCount: 1, estimatedCost: 0.002 },
        ]);
      } finally {
        audit.close();
      }
    });
  });
});

async function withGateway(assertions: (dbPath: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-gateway-"));
  const dbPath = join(dir, "agentsoul-v2.sqlite");

  try {
    await assertions(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function getJson(url: string): Promise<any> {
  const response = await fetch(url);
  expect(response.status).toBe(200);
  return response.json();
}

async function postJson(url: string, body: unknown, expectedStatus = 200): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(expectedStatus);
  if (response.status === 204) return null;
  return response.json();
}

async function putJson(url: string, body: unknown, expectedStatus = 200): Promise<any> {
  const response = await fetch(url, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(expectedStatus);
  if (response.status === 204) return null;
  return response.json();
}

describe("Gateway channel management API", () => {
  it("lists channels through the HTTP API", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const channelStore = createChannelStore({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, channelStore, port: 0 });

      try {
        channelStore.createChannel({
          name: "Test Channel",
          type: "claude",
          baseUrl: "https://api.anthropic.com/v1",
          apiKeys: ["test-key"],
        });

        const resp = await getJson(gateway.url("/channels"));
        expect(resp.channels).toHaveLength(1);
        expect(resp.channels[0].name).toBe("Test Channel");
      } finally {
        await gateway.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });

  it("creates a channel through POST /channels", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const channelStore = createChannelStore({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, channelStore, port: 0 });

      try {
        const resp = await postJson(gateway.url("/channels"), {
          name: "New Channel",
          type: "codex",
          baseUrl: "https://api.openai.com/v1",
          apiKeys: ["key-1"],
        }, 201);

        expect(resp.channel.name).toBe("New Channel");
        expect(resp.channel.type).toBe("codex");
      } finally {
        await gateway.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });

  it("returns dashboard data with channels and metrics", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const channelStore = createChannelStore({ dbPath });
      const audit = createGatewayAuditRepository({ dbPath });
      const costTracker = createCostTracker({ channelStore, audit });
      const gateway = await startLocalGateway({ providerProfiles, channelStore, costTracker, port: 0 });

      try {
        channelStore.createChannel({
          name: "Dashboard Test",
          type: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKeys: ["key-1"],
        });

        const resp = await getJson(gateway.url("/dashboard"));
        expect(resp.channels).toHaveLength(1);
        expect(resp.gatewayHealth.status).toBe("ok");
      } finally {
        await gateway.close();
        costTracker.close();
        audit.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });

  it("returns model mix and daily trend from audit records in cost summary", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const channelStore = createChannelStore({ dbPath });
      const audit = createGatewayAuditRepository({ dbPath });
      const costTracker = createCostTracker({ channelStore, audit });
      const gateway = await startLocalGateway({ providerProfiles, channelStore, costTracker, port: 0 });

      try {
        channelStore.createChannel({
          name: "Trend Channel",
          type: "openai",
          baseUrl: "https://api.openai.com/v1",
          apiKeys: ["key-1"],
        });
        channelStore.recordRequest(channelStore.listChannels()[0].id, {
          success: true,
          latencyMs: 120,
          inputTokens: 400,
          outputTokens: 100,
          estimatedCost: 0.0025,
        });
        audit.recordAudit({
          trafficMetadata: {
            gatewayEventId: "evt-trend-1",
            clientProtocol: "openai-chat",
            providerProtocol: "openai-chat",
            providerProfileId: "openai",
            model: "gpt-4.1",
            route: "openai-chat->openai-chat",
            inputTokens: 400,
            outputTokens: 100,
            latencyMs: 120,
            outcome: "translated",
          },
          estimatedCost: 0.0025,
          outcome: "translated",
          occurredAt: "2026-05-30T10:00:00.000Z",
        });

        const resp = await getJson(gateway.url("/costs/summary"));
        expect(resp.summary.byModel).toEqual([
          {
            model: "gpt-4.1",
            estimatedCost: 0.0025,
            requestCount: 1,
          },
        ]);
        expect(resp.summary.dailyTrend).toEqual([
          {
            date: "2026-05-30",
            estimatedCost: 0.0025,
            requestCount: 1,
          },
        ]);
      } finally {
        await gateway.close();
        costTracker.close();
        audit.close();
        channelStore.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway session management API", () => {
  it("lists real sessions from SessionRepository", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      initializeV2Database(dbPath);
      const db = new Database(dbPath);
      const sessionRepo = new SessionRepository(db);

      // Seed a session
      sessionRepo.upsertWorkSession(
        "session-1", "claude-code", "/project/test",
        1, 1, JSON.stringify({ summary: "Test session", messageCount: 5, resumeCommand: "claude -r test" }),
        "2026-05-28T12:00:00.000Z",
      );

      const gateway = await startLocalGateway({ providerProfiles, sessionRepository: sessionRepo, port: 0 });

      try {
        const resp = await getJson(gateway.url("/sessions"));
        expect(resp.sessions).toHaveLength(1);
        expect(resp.sessions[0].id).toBe("session-1");
        expect(resp.sessions[0].provider).toBe("claude-code");
        expect(resp.sessions[0].projectDir).toBe("/project/test");
        expect(resp.sessions[0].isResumable).toBe(true);
        expect(resp.sessions[0].resumeCommand).toBe("claude -r test");
      } finally {
        await gateway.close();
        db.close();
        providerProfiles.close();
      }
    });
  });

  it("deletes a session through DELETE /sessions/:id", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      initializeV2Database(dbPath);
      const db = new Database(dbPath);
      const sessionRepo = new SessionRepository(db);

      sessionRepo.upsertWorkSession(
        "session-1", "claude-code", "/project/test",
        1, 1, JSON.stringify({ summary: "Test" }),
        "2026-05-28T12:00:00.000Z",
      );

      const gateway = await startLocalGateway({ providerProfiles, sessionRepository: sessionRepo, port: 0 });

      try {
        // Verify session exists
        const before = await getJson(gateway.url("/sessions"));
        expect(before.sessions).toHaveLength(1);

        // Delete
        const delResp = await fetch(gateway.url("/sessions/session-1"), { method: "DELETE" });
        expect(delResp.status).toBe(204);

        // Verify gone
        const after = await getJson(gateway.url("/sessions"));
        expect(after.sessions).toHaveLength(0);
      } finally {
        await gateway.close();
        db.close();
        providerProfiles.close();
      }
    });
  });

  it("resumes a session using quoted command and project cwd", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      initializeV2Database(dbPath);
      const db = new Database(dbPath);
      const sessionRepo = new SessionRepository(db);

      sessionRepo.upsertWorkSession(
        "session-quoted",
        "codex",
        "/tmp",
        1,
        1,
        JSON.stringify({
          summary: "Quoted command session",
          messageCount: 3,
          resumeCommand: `node -e "process.stdout.write('resumed-ok')"`,
        }),
        "2026-05-30T12:00:00.000Z",
      );

      const gateway = await startLocalGateway({ providerProfiles, sessionRepository: sessionRepo, port: 0 });

      try {
        const response = await fetch(gateway.url("/sessions/session-quoted/resume"), { method: "POST" });
        expect(response.status).toBe(200);
        const body = (await response.json()) as any;
        expect(body.resumed).toBe(true);
        expect(body.stdout).toContain("resumed-ok");
      } finally {
        await gateway.close();
        db.close();
        providerProfiles.close();
      }
    });
  });

  it("returns explicit error when resumable session has empty resume command", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      initializeV2Database(dbPath);
      const db = new Database(dbPath);
      const sessionRepo = new SessionRepository(db);

      sessionRepo.upsertWorkSession(
        "session-empty",
        "claude-code",
        "/project/test",
        1,
        1,
        JSON.stringify({ summary: "Empty resume command", messageCount: 2, resumeCommand: "   " }),
        "2026-05-30T12:00:00.000Z",
      );

      const gateway = await startLocalGateway({ providerProfiles, sessionRepository: sessionRepo, port: 0 });

      try {
        const response = await fetch(gateway.url("/sessions/session-empty/resume"), { method: "POST" });
        expect(response.status).toBe(400);
        const body = (await response.json()) as any;
        expect(body.error).toBe("No resume command available");
      } finally {
        await gateway.close();
        db.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway backup management API", () => {
  it("creates a backup with real serialized state", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const store = createControlPlaneStore(dbPath);

      // Seed MCP server state
      store.mcpServers.save({ id: "mcp-1", name: "Test MCP", command: "npx", status: "running" });
      store.settings.save({ autoFailover: true, failoverThreshold: 5, circuitBreakerTimeout: 30, mcpAutoStart: true, workspaceDir: "/workspace" });

      const gateway = await startLocalGateway({ providerProfiles, controlPlaneStore: store, port: 0 });

      try {
        const resp = await postJson(gateway.url("/backups"), { name: "Test Backup" }, 201);
        expect(resp.backup.name).toBe("Test Backup");

        // Verify snapshot contains real state
        const snapshot = JSON.parse(resp.backup.snapshotJson);
        expect(snapshot.mcpServers).toHaveLength(1);
        expect(snapshot.mcpServers[0].name).toBe("Test MCP");
        expect(snapshot.appSettings.autoFailover).toBe(true);
      } finally {
        await gateway.close();
        store.close();
        providerProfiles.close();
      }
    });
  });

  it("restores state from a backup", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const store = createControlPlaneStore(dbPath);

      // Create initial state and backup
      store.mcpServers.save({ id: "mcp-1", name: "Original MCP", command: "npx", status: "running" });

      const gateway = await startLocalGateway({ providerProfiles, controlPlaneStore: store, port: 0 });

      try {
        // Create backup
        const backupResp = await postJson(gateway.url("/backups"), { name: "Before Change" }, 201);
        const backupId = backupResp.backup.id;

        // Modify state
        store.mcpServers.delete("mcp-1");
        store.mcpServers.save({ id: "mcp-2", name: "New MCP", command: "node", status: "stopped" });

        // Verify modified
        const mid = await getJson(gateway.url("/mcp-servers"));
        expect(mid.servers).toHaveLength(1);
        expect(mid.servers[0].name).toBe("New MCP");

        // Restore from backup
        const restoreResp = await fetch(gateway.url(`/backups/${backupId}/restore`), { method: "POST" });
        expect(restoreResp.status).toBe(200);

        // Verify restored state
        const after = await getJson(gateway.url("/mcp-servers"));
        expect(after.servers).toHaveLength(1);
        expect(after.servers[0].name).toBe("Original MCP");
      } finally {
        await gateway.close();
        store.close();
        providerProfiles.close();
      }
    });
  });

  it("deletes a backup through DELETE /backups/:id", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const store = createControlPlaneStore(dbPath);

      const gateway = await startLocalGateway({ providerProfiles, controlPlaneStore: store, port: 0 });

      try {
        const createResp = await postJson(gateway.url("/backups"), { name: "Temp Backup" }, 201);
        const backupId = createResp.backup.id;

        const before = await getJson(gateway.url("/backups"));
        expect(before.backups.length).toBeGreaterThanOrEqual(1);

        const delResp = await fetch(gateway.url(`/backups/${backupId}`), { method: "DELETE" });
        expect(delResp.status).toBe(204);

        const after = await getJson(gateway.url("/backups"));
        expect(after.backups.find((b: any) => b.id === backupId)).toBeUndefined();
      } finally {
        await gateway.close();
        store.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway settings API", () => {
  it("persists and returns control-plane app settings via /settings", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const store = createControlPlaneStore(dbPath);
      const gateway = await startLocalGateway({ providerProfiles, controlPlaneStore: store, port: 0 });

      try {
        const initial = await getJson(gateway.url("/settings"));
        expect(initial.settings).toBeNull();

        const payload = {
          settings: {
            autoFailover: false,
            failoverThreshold: 7,
            circuitBreakerTimeout: 120,
            mcpAutoStart: true,
            workspaceDir: "/workspace/project",
          },
        };
        const update = await putJson(gateway.url("/settings"), payload);
        expect(update.settings.autoFailover).toBe(false);
        expect(update.settings.failoverThreshold).toBe(7);

        const after = await getJson(gateway.url("/settings"));
        expect(after.settings.autoFailover).toBe(false);
        expect(after.settings.circuitBreakerTimeout).toBe(120);
        expect(after.settings.workspaceDir).toBe("/workspace/project");
      } finally {
        await gateway.close();
        store.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway prompts API", () => {
  it("creates, lists, favorites and deletes prompts", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const store = createControlPlaneStore(dbPath);
      const gateway = await startLocalGateway({ providerProfiles, controlPlaneStore: store, port: 0 });

      try {
        const created = await postJson(gateway.url("/prompts"), {
          name: "Daily Standup",
          content: "Summarize today tasks",
          category: "workflow",
          tags: ["daily", "summary"],
        }, 201);
        const promptId = created.prompt.id;
        expect(created.prompt.name).toBe("Daily Standup");

        const listed = await getJson(gateway.url("/prompts"));
        expect(listed.prompts.some((p: any) => p.id === promptId)).toBe(true);

        const toggled = await putJson(gateway.url(`/prompts/${promptId}/favorite`), { isFavorite: true });
        expect(toggled.prompt.isFavorite).toBe(true);

        const delResp = await fetch(gateway.url(`/prompts/${promptId}`), { method: "DELETE" });
        expect(delResp.status).toBe(204);
      } finally {
        await gateway.close();
        store.close();
        providerProfiles.close();
      }
    });
  });
});

describe("Gateway skills API", () => {
  it("persists and reads skills state via /skills", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const store = createControlPlaneStore(dbPath);
      const gateway = await startLocalGateway({ providerProfiles, controlPlaneStore: store, port: 0 });

      try {
        const initial = await getJson(gateway.url("/skills"));
        expect(initial.skills).toBeNull();

        const payload = {
          skills: {
            projectPath: "/workspace/project",
            installedSkillPacks: [
              { id: "tdd", name: "TDD", source: "local", installedAt: "2026-05-30T00:00:00.000Z" },
            ],
            projectActivations: [
              { skillPackId: "tdd", enabled: true, source: "project" },
            ],
            workspaceRuleDeployments: [
              {
                skillPackId: "tdd",
                status: "deployed",
                managedRuleFiles: [{ targetPath: "/workspace/project/CLAUDE.md", method: "copy" }],
              },
            ],
          },
        };
        const saved = await putJson(gateway.url("/skills"), payload);
        expect(saved.skills.projectPath).toBe("/workspace/project");
        expect(saved.skills.projectActivations[0].enabled).toBe(true);

        const after = await getJson(gateway.url("/skills"));
        expect(after.skills.installedSkillPacks).toHaveLength(1);
        expect(after.skills.workspaceRuleDeployments[0].status).toBe("deployed");
      } finally {
        await gateway.close();
        store.close();
        providerProfiles.close();
      }
    });
  });
});
