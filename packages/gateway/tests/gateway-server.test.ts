import { describe, it } from "node:test";
import assert from "node:assert/strict";
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

        assert.equal(health.status, "ok");
        assert.equal(health.routeReady, false);
        assert.equal(health.activeProviderProfile, null);
        assert.equal(health.liveProviderCallRequired, false);
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

        assert.equal(health.routeReady, true);
        assert.equal(health.activeProviderProfile.id, "openai");
        assert.equal(health.activeProviderProfile.credentialRef, "credential:openai:primary");
        assert.doesNotMatch(JSON.stringify(health), /sk-|api[_-]?key|secret/i);
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

        assert.equal(route.status, "translated");
        assert.equal(route.adapter, "openai-chat");
        assert.equal(route.liveProviderCallRequired, false);
        assert.equal(route.providerRequest.url, "https://api.openai.com/v1/chat/completions");
        assert.equal(route.providerRequest.body.model, "gpt-4.1");
        assert.deepEqual(route.providerRequest.body.messages, [{ role: "user", content: "hello" }]);
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

        assert.equal(response.status, 422);
        assert.equal(route.status, "unsupported-route");
        assert.match(route.reason, /openai-chat -> anthropic/);
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
        assert.equal(records.length, 2);
        assert.equal(records[0].trafficMetadata.model, "gpt-4.1");
        assert.equal(records[0].trafficMetadata.providerProfileId, "openai");
        assert.equal(records[0].trafficMetadata.inputTokens, 1200);
        assert.equal(records[0].trafficMetadata.outputTokens, 300);
        assert.equal(records[0].outcome, "translated");
        assert.equal(records[0].estimatedCost, 0.0048);
        assert.equal(records[1].outcome, "unsupported-route");

        const serialized = JSON.stringify(records);
        assert.doesNotMatch(serialized, /private prompt body/);
        assert.doesNotMatch(serialized, /failed private prompt body/);
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

        assert.deepEqual(trends.dailyCosts, [
          {
            date: "2026-05-28",
            estimatedCost: 0.011,
            inputTokens: 2500,
            outputTokens: 600,
            requestCount: 2,
            averageLatencyMs: 800,
          },
        ]);
        assert.deepEqual(trends.modelMix, [
          { model: "claude-sonnet", requestCount: 1, estimatedCost: 0.009 },
          { model: "gpt-4.1", requestCount: 1, estimatedCost: 0.002 },
        ]);
        assert.deepEqual(trends.providerMix, [
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
  assert.equal(response.status, 200);
  return response.json();
}

async function postJson(url: string, body: unknown): Promise<any> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, 200);
  return response.json();
}
