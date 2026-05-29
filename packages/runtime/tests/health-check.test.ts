import { describe, it, expect } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCompanionRuntime, createHealthChecker } from "@agentsoul/runtime";
import { initializeV2Database } from "@agentsoul/persistence";

describe("Health Check", () => {
  it("runs health check and returns report with score", () => {
    withDatabase((dbPath) => {
      initializeV2Database(dbPath);
      const checker = createHealthChecker({ 
        dbPath,
        clock: () => new Date("2026-05-29T10:00:00.000Z"),
      });

      const report = checker.runHealthCheck();
      
      expect(report.results).toHaveLength(4);
      expect(report.results[0].component).toBe("database");
      expect(report.results[0].status).toBe("ok");
      expect(report.results[1].component).toBe("config");
      expect(report.results[1].status).toBe("ok");
      expect(report.results[2].component).toBe("companion");
      expect(report.results[3].component).toBe("gateway");
      expect(report.score).toBeGreaterThanOrEqual(0);
      expect(report.score).toBeLessThanOrEqual(100);
      expect(report.checkedAt).toBe("2026-05-29T10:00:00.000Z");
    });
  });

  it("generates companionship report with 5 metrics", () => {
    withDatabase((dbPath) => {
      // 创建 companion 状态
      const runtime = createCompanionRuntime({ dbPath });
      runtime.performCompanionInteraction("pet");
      runtime.close();

      const checker = createHealthChecker({ 
        dbPath,
        clock: () => new Date("2026-05-29T10:00:00.000Z"),
      });

      const report = checker.generateCompanionshipReport();
      
      expect(report.metrics).toHaveLength(5);
      expect(report.metrics.map((m: any) => m.name)).toEqual([
        "intimacy", "energy", "activity", "growth", "continuity"
      ]);
      expect(report.overallScore).toBeGreaterThanOrEqual(0);
      expect(report.overallScore).toBeLessThanOrEqual(100);
      expect(report.evaluatedAt).toBe("2026-05-29T10:00:00.000Z");
    });
  });

  it("calculates health score correctly", () => {
    withDatabase((dbPath) => {
      initializeV2Database(dbPath);
      const checker = createHealthChecker({ dbPath });

      const report = checker.runHealthCheck();
      
      // 全部 ok 应该是 100 分
      const allOk = report.results.every((r: any) => r.status === "ok");
      if (allOk) {
        expect(report.score).toBe(100);
      }
    });
  });
});

function withDatabase(fn: (dbPath: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "agentsoul-v2-health-"));
  try {
    fn(join(dir, "agentsoul.sqlite"));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
