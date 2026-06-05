import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDirectClientConfigFallback,
  getProviderActivationSupportMatrix,
  createProviderProfileService,
  type ProviderProfileInput,
} from "@agentsoul/provider";

describe("Provider Profile service", () => {
  it("creates, lists, updates, selects, and queries the Active Provider Profile", () => {
    withProviderService((dbPath) => {
      const service = createProviderProfileService({ dbPath });
      const credentialRef = "credential:anthropic:primary";
      const input: ProviderProfileInput = {
        id: "anthropic-primary",
        name: "Anthropic Primary",
        activationMode: "gateway-route",
        credentialRef,
        clientProtocol: "claude-messages",
        providerProtocol: "anthropic",
        targetModel: "claude-sonnet-4",
        endpoint: "https://api.anthropic.com",
        adapterSettings: { stream: true },
        pricing: { inputTokenUsd: 0.000003, outputTokenUsd: 0.000015 },
      };

      try {
        const created = service.createProviderProfile(input);
        expect(created.credentialRef).toBe(credentialRef);
        expect(service.listProviderProfiles().map((profile) => profile.id)).toEqual([
          "anthropic-primary",
        ]);

        service.updateProviderProfile("anthropic-primary", {
          name: "Anthropic Work",
          targetModel: "claude-opus-4",
        });
        service.selectActiveProviderProfile("anthropic-primary");

        const active = service.getActiveProviderProfile();
        expect(active?.name).toBe("Anthropic Work");
        expect(active?.targetModel).toBe("claude-opus-4");
        expect(active?.credentialRef).toBe(credentialRef);
      } finally {
        service.close();
      }
    });
  });

  it("persists only Credential references and non-sensitive route metadata", () => {
    withProviderService((dbPath) => {
      const service = createProviderProfileService({ dbPath });

      try {
        service.createProviderProfile({
          id: "openai",
          name: "OpenAI",
          activationMode: "gateway-route",
          credentialRef: "credential:openai:primary",
          clientProtocol: "openai-chat",
          providerProtocol: "openai-chat",
          targetModel: "gpt-4.1",
          endpoint: "https://api.openai.com/v1",
          adapterSettings: { organization: "org-local" },
          pricing: { inputTokenUsd: 0.000002, outputTokenUsd: 0.000008 },
        });

        const serialized = JSON.stringify(service.listProviderProfiles());
        expect(serialized).toMatch(/credential:openai:primary/);
        expect(serialized).not.toMatch(/sk-|api[_-]?key|secret/i);
      } finally {
        service.close();
      }
    });
  });
});

describe("Direct Client Config fallback", () => {
  it("activates a Provider Profile through fallback metadata with clear limitations", () => {
    withProviderService((dbPath) => {
      const service = createProviderProfileService({ dbPath });

      try {
        service.createProviderProfile({
          id: "codex-direct",
          name: "Codex Direct",
          activationMode: "direct-client-config",
          credentialRef: "credential:codex:primary",
          clientProtocol: "codex-responses",
          providerProtocol: "openai-responses",
          targetModel: "gpt-5.1",
          endpoint: "https://api.openai.com/v1",
        });

        const fallback = createDirectClientConfigFallback({
          providerProfile: service.selectActiveProviderProfile("codex-direct"),
          client: "codex",
          targetConfigPath: "/Users/dev/.codex/config.toml",
        });

        expect(fallback.activationMode).toBe("direct-client-config");
        expect(fallback.providerProfileId).toBe("codex-direct");
        expect(fallback.client).toBe("codex");
        expect(fallback.targetConfigPath).toBe("/Users/dev/.codex/config.toml");
        expect("credentialRef" in fallback).toBe(false);
        expect(JSON.stringify(fallback)).not.toMatch(/credential:codex:primary/);
        expect(fallback.guarantees).toEqual({
          providerSwitching: true,
          fullAudit: false,
          growthConversion: false,
          approvalControl: false,
        });
        expect(fallback.notice).toMatch(/does not guarantee full audit/);
      } finally {
        service.close();
      }
    });
  });

  it("documents Gateway Route support or Direct Client Config fallback for target clients", () => {
    const matrix = getProviderActivationSupportMatrix();

    expect(matrix.map((entry) => ({
        client: entry.client,
        defaultActivationMode: entry.defaultActivationMode,
        clientProtocol: entry.clientProtocol,
        gatewayRouteSupported: entry.gatewayRouteSupported,
        directClientConfigFallback: entry.directClientConfigFallback,
        fullAuditGuaranteed: entry.fullAuditGuaranteed,
        approvalControlGuaranteed: entry.approvalControlGuaranteed,
      }))).toEqual([
        {
          client: "Claude Code",
          defaultActivationMode: "gateway-route",
          clientProtocol: "claude-messages",
          gatewayRouteSupported: true,
          directClientConfigFallback: true,
          fullAuditGuaranteed: true,
          approvalControlGuaranteed: true,
        },
        {
          client: "Cursor",
          defaultActivationMode: "gateway-route",
          clientProtocol: "openai-chat",
          gatewayRouteSupported: true,
          directClientConfigFallback: true,
          fullAuditGuaranteed: true,
          approvalControlGuaranteed: true,
        },
        {
          client: "Codex",
          defaultActivationMode: "gateway-route",
          clientProtocol: "codex-responses",
          gatewayRouteSupported: true,
          directClientConfigFallback: true,
          fullAuditGuaranteed: true,
          approvalControlGuaranteed: true,
        },
        {
          client: "Trae",
          defaultActivationMode: "direct-client-config",
          clientProtocol: "openai-chat",
          gatewayRouteSupported: false,
          directClientConfigFallback: true,
          fullAuditGuaranteed: false,
          approvalControlGuaranteed: false,
        },
      ]);
    expect(matrix[3]?.fallbackNotice ?? "").toMatch(/reduced guarantees/i);
  });
});

function withProviderService(assertions: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-provider-"));
  const dbPath = join(dir, "agentsoul-v2.sqlite");

  try {
    assertions(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
