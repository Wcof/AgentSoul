import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createGatewayAuditRepository, startLocalGateway } from "@agentsoul/gateway";
import { createProviderProfileService } from "@agentsoul/provider";

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

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  expect(response.status).toBe(200);
  return response.json();
}
