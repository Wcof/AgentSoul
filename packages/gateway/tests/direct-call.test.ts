import { describe, it, expect, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocalGateway } from "@agentsoul/gateway";
import { createProviderProfileService } from "@agentsoul/provider";

// ─── Fetch mock helper ───

function mockFetch(response: unknown = { choices: [{ message: { content: "ok" } }] }) {
  const original = globalThis.fetch;
  const calls: Array<{ url: string; body: unknown; headers: Record<string, string> }> = [];

  globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input.toString();
    // Only intercept calls to external providers (not localhost)
    if (url.includes("127.0.0.1") || url.includes("localhost")) {
      return original(input, init);
    }
    calls.push({
      url,
      body: init?.body ? JSON.parse(init.body as string) : null,
      headers: (init?.headers ?? {}) as Record<string, string>,
    });
    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  return {
    calls,
    restore() { globalThis.fetch = original; },
  };
}

// ─── Tests ───

describe("Direct call endpoints", () => {
  it("POST /v1/direct/chat/completions returns 200", async () => {
    const mock = mockFetch();
    try {
      await withGateway(async (dbPath) => {
        const providerProfiles = createProviderProfileService({ dbPath });
        providerProfiles.createProviderProfile({
          id: "openai", name: "OpenAI", activationMode: "gateway-route",
          credentialRef: "credential:openai:primary", clientProtocol: "openai-chat",
          providerProtocol: "openai-chat", targetModel: "gpt-4",
          endpoint: "https://api.openai.com/v1",
        });
        providerProfiles.selectActiveProviderProfile("openai");
        const gateway = await startLocalGateway({ providerProfiles, port: 0 });

        try {
          const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] }),
          });
          expect(response.status).toBe(200);
        } finally {
          await gateway.close();
          providerProfiles.close();
        }
      });
    } finally {
      mock.restore();
    }
  });

  it("POST /v1/direct/messages returns 200", async () => {
    const mock = mockFetch({ content: [{ type: "text", text: "hi" }] });
    try {
      await withGateway(async (dbPath) => {
        const providerProfiles = createProviderProfileService({ dbPath });
        providerProfiles.createProviderProfile({
          id: "claude", name: "Claude", activationMode: "gateway-route",
          credentialRef: "credential:claude:primary", clientProtocol: "openai-chat",
          providerProtocol: "anthropic", targetModel: "claude-sonnet-4-20250514",
          endpoint: "https://api.anthropic.com/v1",
        });
        providerProfiles.selectActiveProviderProfile("claude");
        const gateway = await startLocalGateway({ providerProfiles, port: 0 });

        try {
          const response = await fetch(gateway.url("/v1/direct/messages"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: "claude-sonnet-4-20250514", messages: [{ role: "user", content: "hello" }] }),
          });
          expect(response.status).toBe(200);
        } finally {
          await gateway.close();
          providerProfiles.close();
        }
      });
    } finally {
      mock.restore();
    }
  });

  it("POST /v1/direct/responses returns 200", async () => {
    const mock = mockFetch();
    try {
      await withGateway(async (dbPath) => {
        const providerProfiles = createProviderProfileService({ dbPath });
        providerProfiles.createProviderProfile({
          id: "openai", name: "OpenAI", activationMode: "gateway-route",
          credentialRef: "credential:openai:primary", clientProtocol: "openai-chat",
          providerProtocol: "openai-chat", targetModel: "gpt-4",
          endpoint: "https://api.openai.com/v1",
        });
        providerProfiles.selectActiveProviderProfile("openai");
        const gateway = await startLocalGateway({ providerProfiles, port: 0 });

        try {
          const response = await fetch(gateway.url("/v1/direct/responses"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: "gpt-4", input: [{ role: "user", content: "hello" }] }),
          });
          expect(response.status).toBe(200);
        } finally {
          await gateway.close();
          providerProfiles.close();
        }
      });
    } finally {
      mock.restore();
    }
  });

  it("returns 401 without proxyAccessKey when key is configured", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, proxyAccessKey: "secret-key", port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] }),
        });
        expect(response.status).toBe(401);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("returns 200 with valid proxyAccessKey", async () => {
    const mock = mockFetch();
    try {
      await withGateway(async (dbPath) => {
        const providerProfiles = createProviderProfileService({ dbPath });
        providerProfiles.createProviderProfile({
          id: "openai", name: "OpenAI", activationMode: "gateway-route",
          credentialRef: "credential:openai:primary", clientProtocol: "openai-chat",
          providerProtocol: "openai-chat", targetModel: "gpt-4",
          endpoint: "https://api.openai.com/v1",
        });
        providerProfiles.selectActiveProviderProfile("openai");
        const gateway = await startLocalGateway({ providerProfiles, proxyAccessKey: "secret-key", port: 0 });

        try {
          const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
            method: "POST",
            headers: { "content-type": "application/json", "x-api-key": "secret-key" },
            body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] }),
          });
          expect(response.status).toBe(200);
        } finally {
          await gateway.close();
          providerProfiles.close();
        }
      });
    } finally {
      mock.restore();
    }
  });

  it("calls provider and returns LLM response", async () => {
    const mock = mockFetch({
      choices: [{ message: { content: "Hi there!" } }],
      usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
    });

    try {
      await withGateway(async (dbPath) => {
        const providerProfiles = createProviderProfileService({ dbPath });
        providerProfiles.createProviderProfile({
          id: "openai", name: "OpenAI", activationMode: "gateway-route",
          credentialRef: "credential:openai:primary", clientProtocol: "openai-chat",
          providerProtocol: "openai-chat", targetModel: "gpt-4",
          endpoint: "https://api.openai.com/v1",
        });
        providerProfiles.selectActiveProviderProfile("openai");
        const gateway = await startLocalGateway({ providerProfiles, port: 0 });

        try {
          const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] }),
          });

          expect(response.status).toBe(200);
          const body = await response.json();
          expect(body.choices[0].message.content).toBe("Hi there!");
          expect(mock.calls).toHaveLength(1);
          expect(mock.calls[0].url).toContain("openai.com");
        } finally {
          await gateway.close();
          providerProfiles.close();
        }
      });
    } finally {
      mock.restore();
    }
  });

  it("translates request before calling provider", async () => {
    const mock = mockFetch({ content: [{ type: "text", text: "Hello!" }] });

    try {
      await withGateway(async (dbPath) => {
        const providerProfiles = createProviderProfileService({ dbPath });
        providerProfiles.createProviderProfile({
          id: "openai", name: "OpenAI", activationMode: "gateway-route",
          credentialRef: "credential:openai:primary", clientProtocol: "openai-chat",
          providerProtocol: "openai-chat", targetModel: "gpt-4",
          endpoint: "https://api.openai.com/v1",
        });
        providerProfiles.selectActiveProviderProfile("openai");
        const gateway = await startLocalGateway({ providerProfiles, port: 0 });

        try {
          const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ model: "gpt-4", messages: [{ role: "user", content: "hello" }] }),
          });

          expect(response.status).toBe(200);
          // Verify the request was translated and sent to the provider
          expect(mock.calls).toHaveLength(1);
          expect(mock.calls[0].url).toContain("openai.com");
          // Verify the body was translated into provider format
          expect(mock.calls[0].body).toBeDefined();
        } finally {
          await gateway.close();
          providerProfiles.close();
        }
      });
    } finally {
      mock.restore();
    }
  });
});

// ─── Test helpers ───

async function withGateway(assertions: (dbPath: string) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-direct-call-"));
  const dbPath = join(dir, "agentsoul-v2.sqlite");

  try {
    await assertions(dbPath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
