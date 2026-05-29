import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createV2Tools } from "../src/v2-tools";

describe("MCP Server v2 Tools", () => {
  let dbPath: string;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "agentsoul-mcp-v2-"));
    dbPath = join(tempDir, "agentsoul.sqlite");
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("creates v2 tools and gets companion state", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const state = tools.getCompanionState();
      expect(state).toBeDefined();
      expect(state.id).toBeDefined();
      expect(state.mood).toBeDefined();
      expect(state.vitals).toBeDefined();
    } finally {
      tools.close();
    }
  });

  it("performs companion interaction", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const result = tools.performInteraction("pet");
      expect(result).toBeDefined();
      expect(result.outcome).toBeDefined();
      expect(result.state).toBeDefined();
    } finally {
      tools.close();
    }
  });

  it("writes and queries memory", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const entry = tools.writeMemory({
        layer: "day",
        content: "Test memory content",
        tags: ["test"],
      });
      expect(entry).toBeDefined();
      expect(entry.id).toBeDefined();

      const results = tools.queryMemory({ tags: ["test"] });
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    } finally {
      tools.close();
    }
  });

  it("creates and searches entities", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const entity = tools.createEntity({
        name: "Test Entity",
        type: "person",
      });
      expect(entity).toBeDefined();
      expect(entity.id).toBeDefined();

      const results = tools.findEntitiesByName("Test");
      expect(results).toBeDefined();
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0);
    } finally {
      tools.close();
    }
  });

  it("runs health check", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const report = tools.runHealthCheck();
      expect(report).toBeDefined();
      expect(report.results).toBeDefined();
      expect(report.score).toBeDefined();
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
    } finally {
      tools.close();
    }
  });

  it("generates companionship report", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const report = tools.generateCompanionshipReport();
      expect(report).toBeDefined();
      expect(report.metrics).toBeDefined();
      expect(report.metrics).toHaveLength(5);
      expect(report.overallScore).toBeDefined();
    } finally {
      tools.close();
    }
  });

  it("creates portable export", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const exportData = tools.createPortableExport();
      expect(exportData).toBeDefined();
      expect(exportData.exportKind).toBe("portable-data");
    } finally {
      tools.close();
    }
  });

  it("creates export manifest", () => {
    const tools = createV2Tools({ dbPath });
    try {
      const manifest = tools.createExportManifest("portable");
      expect(manifest).toBeDefined();
      expect(manifest.kind).toBe("portable");
      expect(manifest.includedSections).toBeDefined();
      expect(manifest.excludedSections).toBeDefined();
    } finally {
      tools.close();
    }
  });
});
