import { describe, expect, it } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  initializeV2Database,
  createControlPlaneStore,
} from "../src/index";

describe("control plane store", () => {
  it("persists MCP servers across reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-control-plane-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      initializeV2Database(dbPath);

      const first = createControlPlaneStore(dbPath);
      first.mcpServers.save({
        id: "mcp-files",
        name: "Filesystem",
        command: "npx",
        args: ["@modelcontextprotocol/server-filesystem"],
        status: "stopped",
      });
      first.close();

      const second = createControlPlaneStore(dbPath);
      const servers = second.mcpServers.list();
      expect(servers).toHaveLength(1);
      expect(servers[0].name).toBe("Filesystem");
      expect(servers[0].command).toBe("npx");
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists backups across reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-control-plane-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      initializeV2Database(dbPath);

      const first = createControlPlaneStore(dbPath);
      first.backups.create({
        id: "backup-1",
        name: "before-edit",
        snapshotJson: '{"channels":1}',
      });
      first.close();

      const second = createControlPlaneStore(dbPath);
      const backups = second.backups.list();
      expect(backups).toHaveLength(1);
      expect(backups[0].id).toBe("backup-1");
      expect(backups[0].name).toBe("before-edit");
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("loads empty lists when no data exists", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-control-plane-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      initializeV2Database(dbPath);

      const store = createControlPlaneStore(dbPath);
      expect(store.mcpServers.list()).toHaveLength(0);
      expect(store.backups.list()).toHaveLength(0);
      expect(store.settings.load()).toBeNull();
      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("persists app settings across reopen", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-control-plane-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      initializeV2Database(dbPath);

      const first = createControlPlaneStore(dbPath);
      first.settings.save({
        autoFailover: true,
        failoverThreshold: 3,
        circuitBreakerTimeout: 60,
        mcpAutoStart: true,
        workspaceDir: "/workspace",
      });
      first.close();

      const second = createControlPlaneStore(dbPath);
      const settings = second.settings.load();
      expect(settings).not.toBeNull();
      expect(settings!.autoFailover).toBe(true);
      expect(settings!.failoverThreshold).toBe(3);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("deletes MCP server and backup entries", () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-control-plane-"));
    const dbPath = join(dir, "agentsoul-v2.sqlite");

    try {
      initializeV2Database(dbPath);

      const store = createControlPlaneStore(dbPath);
      store.mcpServers.save({
        id: "mcp-1",
        name: "Server1",
        command: "node",
        status: "stopped",
      });
      store.mcpServers.save({
        id: "mcp-2",
        name: "Server2",
        command: "python",
        status: "running",
      });
      store.backups.create({
        id: "b1",
        name: "Backup1",
        snapshotJson: "{}",
      });

      expect(store.mcpServers.list()).toHaveLength(2);
      expect(store.mcpServers.delete("mcp-1")).toBe(true);
      expect(store.mcpServers.list()).toHaveLength(1);
      expect(store.mcpServers.list()[0].id).toBe("mcp-2");

      expect(store.backups.delete("b1")).toBe(true);
      expect(store.backups.list()).toHaveLength(0);

      store.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
