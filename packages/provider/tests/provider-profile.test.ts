import { describe, it } from "node:test";
import assert from "node:assert/strict";
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
        assert.equal(created.credentialRef, credentialRef);
        assert.deepEqual(service.listProviderProfiles().map((profile) => profile.id), [
          "anthropic-primary",
        ]);

        service.updateProviderProfile("anthropic-primary", {
          name: "Anthropic Work",
          targetModel: "claude-opus-4",
        });
        service.selectActiveProviderProfile("anthropic-primary");

        const active = service.getActiveProviderProfile();
        assert.equal(active?.name, "Anthropic Work");
        assert.equal(active?.targetModel, "claude-opus-4");
        assert.equal(active?.credentialRef, credentialRef);
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
        assert.match(serialized, /credential:openai:primary/);
        assert.doesNotMatch(serialized, /sk-|api[_-]?key|secret/i);
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

        assert.equal(fallback.activationMode, "direct-client-config");
        assert.equal(fallback.providerProfileId, "codex-direct");
        assert.equal(fallback.client, "codex");
        assert.equal(fallback.targetConfigPath, "/Users/dev/.codex/config.toml");
        assert.deepEqual(fallback.guarantees, {
          providerSwitching: true,
          fullAudit: false,
          growthConversion: false,
          approvalControl: false,
        });
        assert.match(fallback.notice, /does not guarantee full audit, growth, or approval control/i);
      } finally {
        service.close();
      }
    });
  });

  it("documents Gateway Route support or Direct Client Config fallback for target clients", () => {
    const matrix = getProviderActivationSupportMatrix();

    assert.deepEqual(
      matrix.map((entry) => ({
        client: entry.client,
        defaultActivationMode: entry.defaultActivationMode,
        clientProtocol: entry.clientProtocol,
        gatewayRouteSupported: entry.gatewayRouteSupported,
        directClientConfigFallback: entry.directClientConfigFallback,
        fullAuditGuaranteed: entry.fullAuditGuaranteed,
        approvalControlGuaranteed: entry.approvalControlGuaranteed,
      })),
      [
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
      ],
    );
    assert.match(matrix[3]?.fallbackNotice ?? "", /reduced guarantees/i);
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
