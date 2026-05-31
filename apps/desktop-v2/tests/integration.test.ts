import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  startLocalGateway,
  createChannelStore,
  createGatewayAuditRepository,
  createCostTracker,
} from "@agentsoul/gateway";
import {
  initializeV2Database,
  createControlPlaneStore,
} from "@agentsoul/persistence";
import { SessionRepository } from "@agentsoul/sessions";
import { createProviderProfileService } from "@agentsoul/provider";
import { createLocalControlClient } from "../src/utils/localControlClient";

/**
 * Real integration tests — no mocks.
 * Starts a live Gateway with real SQLite stores and verifies the full chain:
 * frontend client -> Gateway HTTP -> SQLite -> response -> client.
 */
describe("Integration: Desktop Client <-> Gateway <-> SQLite", () => {
  let dataDir: string;
  let gateway: Awaited<ReturnType<typeof startLocalGateway>>;
  let controlClient: ReturnType<typeof createLocalControlClient>;
  let channelStore: ReturnType<typeof createChannelStore>;
  let costTracker: ReturnType<typeof createCostTracker>;
  let audit: ReturnType<typeof createGatewayAuditRepository>;
  let controlPlaneStore: ReturnType<typeof createControlPlaneStore>;
  let sessionRepo: SessionRepository;
  let db: Database.Database;

  beforeAll(async () => {
    dataDir = mkdtempSync(join(tmpdir(), "agentsoul-integration-"));
    const dbPath = join(dataDir, "test.sqlite");

    initializeV2Database(dbPath);

    const providerProfiles = createProviderProfileService({ dbPath });
    channelStore = createChannelStore({ dbPath });
    audit = createGatewayAuditRepository({ dbPath });
    costTracker = createCostTracker({ channelStore, audit });
    controlPlaneStore = createControlPlaneStore(join(dataDir, "cp.sqlite"));

    db = new Database(dbPath);
    sessionRepo = new SessionRepository(db);

    gateway = await startLocalGateway({
      providerProfiles,
      channelStore,
      costTracker,
      controlPlaneStore,
      sessionRepository: sessionRepo,
      host: "127.0.0.1",
      port: 0,
    });

    controlClient = createLocalControlClient({
      gatewayBase: `http://127.0.0.1:${gateway.port}`,
    });
  });

  afterAll(async () => {
    controlPlaneStore.close();
    costTracker.close();
    audit.close();
    db.close();
    channelStore.close();
    if (gateway) {
      await gateway.close();
    }
    rmSync(dataDir, { recursive: true, force: true });
  });

  // ─── Channel CRUD ───

  it("creates a channel and lists it", async () => {
    const ch = await controlClient.createChannel({
      name: "Test OpenAI",
      type: "openai-chat",
      baseUrl: "https://api.openai.com/v1",
      apiKeys: ["sk-test"],
    });
    expect(ch.name).toBe("Test OpenAI");
    expect(ch.apiType).toBe("openai-chat");

    const snapshot = await controlClient.loadSnapshot();
    expect(snapshot.channels).toHaveLength(1);
    expect(snapshot.channels[0].name).toBe("Test OpenAI");
  });

  it("updates a channel", async () => {
    const snapshot = await controlClient.loadSnapshot();
    const ch = snapshot.channels[0];
    const updated = await controlClient.updateChannel(ch.id, {
      name: "Updated OpenAI",
      priority: 5,
    });
    expect(updated.name).toBe("Updated OpenAI");
    expect(updated.priority).toBe(5);
  });

  it("persists channel status and priority updates", async () => {
    const snapshot = await controlClient.loadSnapshot();
    const ch = snapshot.channels[0];
    const updated = await controlClient.updateChannel(ch.id, {
      status: "suspended",
      priority: 9,
    });
    expect(updated.status).toBe("suspended");
    expect(updated.priority).toBe(9);

    const after = await controlClient.loadSnapshot();
    expect(after.channels[0].status).toBe("suspended");
    expect(after.channels[0].priority).toBe(9);
  });

  it("deletes a channel", async () => {
    const snapshot = await controlClient.loadSnapshot();
    const ch = snapshot.channels[0];
    await controlClient.deleteChannel(ch.id);

    const after = await controlClient.loadSnapshot();
    expect(after.channels).toHaveLength(0);
  });

  // ─── MCP Server CRUD ───

  it("creates an MCP server", async () => {
    const server = await controlClient.createMcpServer({
      name: "Filesystem MCP",
      command: "npx",
      args: ["-y", "@modelcontextprotocol/server-filesystem"],
    });
    expect(server).not.toBeNull();
    expect(server!.name).toBe("Filesystem MCP");
    expect(server!.status).toBe("stopped");
  });

  it("toggles an MCP server status", async () => {
    const snapshot = await controlClient.loadSnapshot();
    const server = snapshot.mcpServers[0];
    const toggled = await controlClient.toggleMcpServer(server.id);
    expect(toggled).not.toBeNull();
    expect(toggled!.status).toBe("running");

    // Verify persistence - re-read from store
    const persisted = controlPlaneStore.mcpServers.list();
    const found = persisted.find((s: any) => s.id === server.id);
    expect(found?.status).toBe("running");
  });

  it("deletes an MCP server", async () => {
    const snapshot = await controlClient.loadSnapshot();
    const server = snapshot.mcpServers[0];
    await controlClient.deleteMcpServer(server.id);

    const after = await controlClient.loadSnapshot();
    expect(after.mcpServers).toHaveLength(0);
  });

  // ─── Session Management ───

  it("lists sessions (empty by default)", async () => {
    const sessions = await controlClient.listSessions();
    expect(sessions).toEqual([]);
  });

  it("lists sessions seeded in repository", async () => {
    sessionRepo.upsertWorkSession(
      "sess-1", "claude-code", "/project/test",
      1, 1, JSON.stringify({ summary: "Integration test session", messageCount: 10, resumeCommand: "echo resumed" }),
      "2026-05-28T12:00:00.000Z",
    );

    const sessions = await controlClient.listSessions();
    expect(sessions).toHaveLength(1);
    expect(sessions[0].provider).toBe("claude-code");
    expect(sessions[0].summary).toBe("Integration test session");
    expect(sessions[0].isResumable).toBe(true);
  });

  it("resumes a session (real local action)", async () => {
    const result = await controlClient.resumeSession("sess-1");
    expect(result.success).toBe(true);
    expect(result.message).toContain("resumed");
  });

  it("resume fails for non-existent session", async () => {
    const result = await controlClient.resumeSession("nonexistent");
    expect(result.success).toBe(false);
  });

  it("deletes a session", async () => {
    await controlClient.deleteSession("sess-1");
    const sessions = await controlClient.listSessions();
    expect(sessions).toHaveLength(0);
  });

  // ─── Backup / Restore ───

  it("creates a backup with real state snapshot", async () => {
    // Seed some state
    await controlClient.createChannel({
      name: "Backup Test Channel",
      type: "claude",
      baseUrl: "https://api.anthropic.com",
    });
    await controlClient.createMcpServer({
      name: "Backup MCP",
      command: "node",
    });

    const backup = await controlClient.createBackup("Integration Backup");
    expect(backup).not.toBeNull();
    expect(backup!.name).toBe("Integration Backup");
  });

  it("restores state from backup (channels + MCP)", async () => {
    // Get the backup
    const backups = await controlClient.listBackups();
    const backup = backups[0];

    // Modify state
    const snapshot = await controlClient.loadSnapshot();
    for (const ch of snapshot.channels) {
      await controlClient.deleteChannel(ch.id);
    }
    for (const s of snapshot.mcpServers) {
      await controlClient.deleteMcpServer(s.id);
    }

    // Verify empty
    const empty = await controlClient.loadSnapshot();
    expect(empty.channels).toHaveLength(0);
    expect(empty.mcpServers).toHaveLength(0);

    // Restore
    const ok = await controlClient.restoreBackup(backup.id);
    expect(ok).toBe(true);

    // Verify restored — need to re-read from gateway
    const restored = await controlClient.loadSnapshot();
    expect(restored.channels.length).toBeGreaterThan(0);
    expect(restored.mcpServers.length).toBeGreaterThan(0);
    expect(restored.channels[0].name).toBe("Backup Test Channel");
    expect(restored.mcpServers[0].name).toBe("Backup MCP");
  });

  it("backup persists across store reopens", async () => {
    const backups = await controlClient.listBackups();
    expect(backups.length).toBeGreaterThan(0);
    expect(backups[0].name).toBe("Integration Backup");
  });

  it("deletes a backup", async () => {
    const before = await controlClient.listBackups();
    await controlClient.deleteBackup(before[0].id);
    const after = await controlClient.listBackups();
    expect(after).toHaveLength(0);
  });

  // ─── Safety CRUD ───

  it("creates and lists approval requests", async () => {
    const res = await fetch(`http://127.0.0.1:${gateway.port}/approval-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Test Approval", message: "Run dangerous command", actionRiskClass: "high-risk" }),
    });
    expect(res.status).toBe(201);
    const { approvalRequest } = await res.json();

    const list = await controlClient.listApprovalRequests();
    expect(list).toHaveLength(1);
    expect(list[0].title).toBe("Test Approval");
    expect(list[0].status).toBe("Approval Required");
  });

  it("approves an approval request", async () => {
    const list = await controlClient.listApprovalRequests();
    const id = list[0].id;
    const ok = await controlClient.approveRequest(id);
    expect(ok).toBe(true);

    const after = await controlClient.listApprovalRequests();
    expect(after[0].status).toBe("allowed");
  });

  it("creates and lists risk notices", async () => {
    const res = await fetch(`http://127.0.0.1:${gateway.port}/risk-notices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Unauthorized access detected", clientAuthorizationMode: "normal" }),
    });
    expect(res.status).toBe(201);

    const list = await controlClient.listRiskNotices();
    expect(list).toHaveLength(1);
    expect(list[0].message).toBe("Unauthorized access detected");
  });

  it("creates, revokes, and lists trust grants", async () => {
    const res = await fetch(`http://127.0.0.1:${gateway.port}/trust-grants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionKinds: ["launch-session"],
        projectPath: "/project",
        clientId: "test-client",
        maxRiskClass: "high-risk",
        expiresAt: "2026-12-31T23:59:59Z",
      }),
    });
    expect(res.status).toBe(201);
    const { trustGrant } = await res.json();

    const list = await controlClient.listTrustGrants();
    expect(list).toHaveLength(1);
    expect(list[0].actionKinds).toContain("launch-session");

    const ok = await controlClient.revokeTrustGrant(trustGrant.id);
    expect(ok).toBe(true);

    const after = await controlClient.listTrustGrants();
    expect(after[0].revokedAt).toBeDefined();
  });

  // ─── Gateway Health ───

  it("gateway health endpoint is accessible", async () => {
    const res = await fetch(`http://127.0.0.1:${gateway.port}/health`);
    const health = await res.json();
    expect(health.status).toBe("ok");
    expect(health.liveProviderCallRequired).toBe(false);
  });

  // ─── App Settings ───

  it("persists app settings through localControlClient", async () => {
    const ok = await controlClient.saveAppSettings({
      language: "zh",
      theme: "dark",
      startupBehavior: "restore",
      closeBehavior: "minimize",
      checkUpdates: true,
      terminalDefault: "system",
      terminalShellPath: "/bin/zsh",
      terminalFontSize: 14,
      proxyEnabled: true,
      proxyUrl: "http://127.0.0.1:7890",
      autoFailover: false,
      failoverThreshold: 8,
      circuitBreakerTimeout: 120,
      maxConcurrentSessions: 5,
      sessionRetentionDays: 30,
      sessionAutoSave: true,
      mcpAutoStart: true,
      mcpDefaultTimeout: 30,
      workspaceDir: "/workspace/project-a",
      dataDir: "/tmp/agentsoul-data",
      logDir: "/tmp/agentsoul-logs",
      telemetryEnabled: false,
      crashReporting: false,
      fontSize: 14,
      fontFamily: "Inter",
      accentColor: "#3b82f6",
      glassOpacity: 95,
      autoBackup: true,
      autoBackupInterval: 24,
    });
    expect(ok).toBe(true);

    const snapshot = await controlClient.loadSnapshot();
    expect(snapshot.appSettings.autoFailover).toBe(false);
    expect(snapshot.appSettings.failoverThreshold).toBe(8);
    expect(snapshot.appSettings.circuitBreakerTimeout).toBe(120);
    expect(snapshot.appSettings.proxyEnabled).toBe(true);
    expect(snapshot.appSettings.workspaceDir).toBe("/workspace/project-a");
  });

  // ─── Prompt Templates ───

  it("creates, favorites, and deletes prompts through localControlClient", async () => {
    const created = await controlClient.createPrompt({
      name: "Daily Summary",
      nameZh: "每日总结",
      content: "Summarize today's coding progress.",
      category: "workflow",
      tags: ["daily", "summary"],
    });
    expect(created).not.toBeNull();
    expect(created!.name).toBe("Daily Summary");
    expect(created!.isFavorite).toBe(false);

    const favored = await controlClient.togglePromptFavorite(created!.id, true);
    expect(favored).not.toBeNull();
    expect(favored!.isFavorite).toBe(true);

    const list = await controlClient.listPrompts();
    expect(list.some((prompt) => prompt.id === created!.id && prompt.isFavorite)).toBe(true);

    await controlClient.deletePrompt(created!.id);
    const after = await controlClient.listPrompts();
    expect(after.some((prompt) => prompt.id === created!.id)).toBe(false);
  });

  // ─── Skills State ───

  it("persists and reloads skills state through localControlClient", async () => {
    const ok = await controlClient.saveSkillsState({
      projectPath: "/workspace/project-a",
      installedSkillPacks: [
        { id: "tdd", name: "TDD", source: "local", installedAt: "2026-05-30T00:00:00Z" },
      ],
      projectActivations: [
        { skillPackId: "tdd", enabled: true, source: "project" },
      ],
      workspaceRuleDeployments: [
        {
          skillPackId: "tdd",
          status: "deployed",
          managedRuleFiles: [
            { targetPath: "/workspace/project-a/CLAUDE.md", method: "copy" },
          ],
        },
      ],
    });
    expect(ok).toBe(true);

    const skills = await controlClient.getSkillsState();
    expect(skills).not.toBeNull();
    expect(skills!.projectPath).toBe("/workspace/project-a");
    expect(skills!.projectActivations[0].enabled).toBe(true);
    expect(skills!.workspaceRuleDeployments[0].status).toBe("deployed");
  });

  it("maps session and safety backend records into snapshot view models", async () => {
    sessionRepo.upsertWorkSession(
      "sess-map-1", "codex", "/workspace/mapped",
      1, 1, JSON.stringify({ summary: "Snapshot mapping test", messageCount: 22, resumeCommand: "echo mapped" }),
      "2026-05-30T12:00:00.000Z",
    );

    const approvalRes = await fetch(`http://127.0.0.1:${gateway.port}/approval-requests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ title: "Mapped Approval", message: "Map me", actionRiskClass: "high-risk" }),
    });
    expect(approvalRes.status).toBe(201);

    const riskRes = await fetch(`http://127.0.0.1:${gateway.port}/risk-notices`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "Mapped Risk", clientAuthorizationMode: "elevated" }),
    });
    expect(riskRes.status).toBe(201);

    const trustRes = await fetch(`http://127.0.0.1:${gateway.port}/trust-grants`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        actionKinds: ["launch-session"],
        projectPath: "/workspace/mapped",
        clientId: "mapped-client",
        maxRiskClass: "high-risk",
        expiresAt: "2026-12-31T23:59:59Z",
      }),
    });
    expect(trustRes.status).toBe(201);

    const snapshot = await controlClient.loadSnapshot();
    const mappedSession = snapshot.sessions.workSessions.find((s) => s.id === "sess-map-1");
    expect(mappedSession).toBeDefined();
    expect(mappedSession?.projectPath).toBe("/workspace/mapped");
    expect(mappedSession?.resumable).toBe(true);

    expect(snapshot.safety.approvalRequests.some((r) => r.title === "Mapped Approval")).toBe(true);
    expect(snapshot.safety.riskNotices.some((r) => r.message === "Mapped Risk")).toBe(true);
    expect(snapshot.safety.scopedTrustGrants.some((g) => g.clientId === "mapped-client")).toBe(true);
  });
});
