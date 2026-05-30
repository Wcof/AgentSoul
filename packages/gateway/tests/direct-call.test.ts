import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { startLocalGateway } from "@agentsoul/gateway";
import { createProviderProfileService } from "@agentsoul/provider";

describe("Direct call endpoints", () => {
  it("POST /v1/direct/chat/completions returns 200", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
          }),
        });

        expect(response.status).toBe(200);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("POST /v1/direct/messages returns 200", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/direct/messages"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            messages: [{ role: "user", content: "hello" }],
          }),
        });

        expect(response.status).toBe(200);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("POST /v1/direct/responses returns 200", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/direct/responses"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4",
            input: [{ role: "user", content: "hello" }],
          }),
        });

        expect(response.status).toBe(200);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("returns 401 without proxyAccessKey when key is configured", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, proxyAccessKey: "secret-key", port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
          }),
        });

        expect(response.status).toBe(401);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
  });

  it("returns 200 with valid proxyAccessKey", async () => {
    await withGateway(async (dbPath) => {
      const providerProfiles = createProviderProfileService({ dbPath });
      const gateway = await startLocalGateway({ providerProfiles, proxyAccessKey: "secret-key", port: 0 });

      try {
        const response = await fetch(gateway.url("/v1/direct/chat/completions"), {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-api-key": "secret-key",
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages: [{ role: "user", content: "hello" }],
          }),
        });

        expect(response.status).toBe(200);
      } finally {
        await gateway.close();
        providerProfiles.close();
      }
    });
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
