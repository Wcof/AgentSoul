import { describe, expect, it, vi } from "vitest";

describe("desktop-v2 boot flow", () => {
  it("loads channels from the authoritative gateway surface on boot", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/channels") && !url.includes("/dashboard")) {
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
            costSummary: {},
            gatewayHealth: { status: "ok" },
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

    // Channels loaded from authoritative store
    expect(snapshot.channels).toHaveLength(1);
    expect(snapshot.channels[0].id).toBe("ch-1");
    expect(snapshot.channels[0].name).toBe("OpenAI Primary");
    expect(snapshot.channels[0].apiType).toBe("openai-chat");

    // Dashboard stats populated
    expect(snapshot.dashboardStats.totalChannels).toBe(1);
  });

  it("falls back to empty snapshot when gateway is unreachable", async () => {
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
    expect(snapshot.dashboardStats.totalChannels).toBe(0);
  });

  it("gatewayClient no longer stores business entities in localStorage", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const gatewayClientSource = readFileSync(join(appRoot, "src", "utils", "gatewayClient.ts"), "utf8");

    // Business entity keys must be removed from gatewayClient
    expect(gatewayClientSource).not.toMatch(/agentsoul_providers/);
    expect(gatewayClientSource).not.toMatch(/agentsoul_sessions/);
    expect(gatewayClientSource).not.toMatch(/agentsoul_mcp_servers/);
    expect(gatewayClientSource).not.toMatch(/agentsoul_prompts/);
    expect(gatewayClientSource).not.toMatch(/agentsoul_backups/);
    expect(gatewayClientSource).not.toMatch(/agentsoul_app_settings/);
  });

  it("boot flow uses localControlClient, not direct localStorage reads", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    // main.ts must create and use the local control client
    expect(mainSource).toMatch(/createLocalControlClient/);
    expect(mainSource).toMatch(/controlClient\.loadSnapshot/);
  });

  it("controller business flows are unified on localControlClient", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    // Controller should no longer import the old gateway client for business writes.
    expect(controllerSource).not.toMatch(/from "\.\/utils\/gatewayClient"/);
    expect(controllerSource).toMatch(/controlClient\./);
  });

  it("boot applies persisted appSettings.language to i18n", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(mainSource).toMatch(/snapshot\.appSettings\?\.language/);
    expect(mainSource).toMatch(/i18n\.changeLanguage/);
  });

  it("boot restores local-first WebDAV panel state from localStorage", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(mainSource).toMatch(/hydrateLocalPanelState/);
    expect(mainSource).toMatch(/agentsoul_webdav_sync/);
    expect(mainSource).toMatch(/localStorage\.getItem/);
  });

  it("boot restores app switcher active app from localStorage", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(mainSource).toMatch(/agentsoul_active_app/);
    expect(mainSource).toMatch(/appSwitcher:\s*\{/);
    expect(mainSource).toMatch(/activeApp:/);
  });

  it("boot maps advanced dashboard modules from control client snapshot", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const mainSource = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    expect(mainSource).toMatch(/keyTrend:\s*authoritativeSnapshot\.keyTrend/);
    expect(mainSource).toMatch(/modelStats:\s*authoritativeSnapshot\.modelStats/);
    expect(mainSource).toMatch(/usageFooter:\s*authoritativeSnapshot\.usageFooter/);
    expect(mainSource).toMatch(/backupList:\s*authoritativeSnapshot\.backupList/);
    expect(mainSource).toMatch(/conversationDashboard:\s*authoritativeSnapshot\.conversationDashboard/);
  });

  it("backup controls persist auto-backup settings and refresh backup list from control client", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    expect(controllerSource).toMatch(/refreshBackupsFromControl/);
    expect(controllerSource).toMatch(/controlClient\.saveAppSettings\(snapshot\.appSettings\)/);
    expect(controllerSource).toMatch(/controlClient\.listBackups\(\)/);
  });

  it("deeplink import flow refreshes authoritative snapshot after import", async () => {
    const { readFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    const appRoot = new URL("..", import.meta.url).pathname;
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    expect(controllerSource).toMatch(/syncFromControlSnapshot/);
    expect(controllerSource).toMatch(/await controlClient\.loadSnapshot\(\)/);
    expect(controllerSource).toMatch(/dialog\.close\(\)/);
  });
});
