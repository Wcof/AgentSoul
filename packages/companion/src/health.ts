import Database from "better-sqlite3";
import type { HealthReport, CompanionshipReport, HealthCheckResult, CompanionshipMetric } from "@agentsoul/domain";
import { initializeV2Database } from "@agentsoul/persistence";

export interface HealthCheckerOptions {
  dbPath: string;
  clock?: () => Date;
}

export interface HealthChecker {
  runHealthCheck(): HealthReport;
  generateCompanionshipReport(): CompanionshipReport;
}

class HealthRepository {
  constructor(private db: Database.Database) {}

  ping(): void {
    this.db.prepare("SELECT 1").get();
  }

  tableExists(name: string): boolean {
    const row = this.db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
    ).get(name);
    return !!row;
  }

  readCompanionState(): Record<string, unknown> | null {
    try {
      const row = this.db.prepare(
        "SELECT state_json FROM companion_state LIMIT 1"
      ).get() as { state_json: string } | undefined;
      return row ? JSON.parse(row.state_json) : null;
    } catch {
      return null;
    }
  }

  countGrowthEvents(): number {
    try {
      const row = this.db.prepare(
        "SELECT COUNT(*) as count FROM growth_events"
      ).get() as { count: number };
      return row?.count ?? 0;
    } catch {
      return 0;
    }
  }

  countDistinctGrowthDays(): number {
    try {
      const row = this.db.prepare(
        "SELECT COUNT(DISTINCT date(occurred_at)) as days FROM growth_events"
      ).get() as { days: number };
      return row?.days ?? 0;
    } catch {
      return 0;
    }
  }
}

export function createHealthChecker(options: HealthCheckerOptions): HealthChecker {
  const clock = options.clock ?? (() => new Date());

  return {
    runHealthCheck(): HealthReport {
      const results: HealthCheckResult[] = [];

      results.push(checkDatabase(options.dbPath));
      results.push(checkConfig(options.dbPath));
      results.push(checkCompanionState(options.dbPath));
      results.push(checkGatewayConnectivity());

      const score = calculateHealthScore(results);

      return {
        results,
        score,
        checkedAt: clock().toISOString(),
      };
    },

    generateCompanionshipReport(): CompanionshipReport {
      const metrics: CompanionshipMetric[] = [];

      metrics.push(measureIntimacy(options.dbPath));
      metrics.push(measureEnergy(options.dbPath));
      metrics.push(measureActivity(options.dbPath));
      metrics.push(measureGrowth(options.dbPath));
      metrics.push(measureContinuity(options.dbPath));

      const overallScore = metrics.reduce((sum, m) => sum + (m.status === "ok" ? m.value : 0), 0) / metrics.length;

      return {
        metrics,
        overallScore,
        evaluatedAt: clock().toISOString(),
      };
    },
  };
}

function openRepo(dbPath: string): { repo: HealthRepository; db: Database.Database } {
  const db = new Database(dbPath);
  return { repo: new HealthRepository(db), db };
}

function checkDatabase(dbPath: string): HealthCheckResult {
  try {
    const { repo, db } = openRepo(dbPath);
    repo.ping();
    db.close();
    return { component: "database", status: "ok", message: "SQLite connection successful" };
  } catch (error) {
    return {
      component: "database",
      status: "error",
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function checkConfig(dbPath: string): HealthCheckResult {
  try {
    const { repo, db } = openRepo(dbPath);
    const exists = repo.tableExists("config_versions");
    db.close();

    if (exists) {
      return { component: "config", status: "ok", message: "Config table exists" };
    }
    return { component: "config", status: "warn", message: "Config table missing" };
  } catch (error) {
    return {
      component: "config",
      status: "error",
      message: `Config check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function checkCompanionState(dbPath: string): HealthCheckResult {
  try {
    const { repo, db } = openRepo(dbPath);
    const state = repo.readCompanionState();
    db.close();

    if (state) {
      return { component: "companion", status: "ok", message: "Companion state loaded" };
    }
    return { component: "companion", status: "warn", message: "No companion state found" };
  } catch (error) {
    return {
      component: "companion",
      status: "error",
      message: `Companion check failed: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function checkGatewayConnectivity(): HealthCheckResult {
  return { component: "gateway", status: "ok", message: "Gateway connectivity assumed OK (local mode)" };
}

function calculateHealthScore(results: HealthCheckResult[]): number {
  const weights = { ok: 100, warn: 60, error: 0 };
  const total = results.reduce((sum, r) => sum + weights[r.status], 0);
  return Math.round(total / results.length);
}

function measureIntimacy(dbPath: string): CompanionshipMetric {
  try {
    const { repo, db } = openRepo(dbPath);
    const state = repo.readCompanionState();
    db.close();

    if (state) {
      const intimacy = (state as Record<string, unknown>).intimacy ?? 0;
      return {
        name: "intimacy",
        value: intimacy as number,
        threshold: 50,
        status: (intimacy as number) >= 50 ? "ok" : "warn",
      };
    }
    return { name: "intimacy", value: 0, threshold: 50, status: "warn" };
  } catch {
    return { name: "intimacy", value: 0, threshold: 50, status: "error" };
  }
}

function measureEnergy(dbPath: string): CompanionshipMetric {
  try {
    const { repo, db } = openRepo(dbPath);
    const state = repo.readCompanionState();
    db.close();

    if (state) {
      const energy = (state as Record<string, unknown>).energy ?? 0;
      return {
        name: "energy",
        value: energy as number,
        threshold: 30,
        status: (energy as number) >= 30 ? "ok" : "warn",
      };
    }
    return { name: "energy", value: 0, threshold: 30, status: "warn" };
  } catch {
    return { name: "energy", value: 0, threshold: 30, status: "error" };
  }
}

function measureActivity(dbPath: string): CompanionshipMetric {
  try {
    const { repo, db } = openRepo(dbPath);
    const activity = repo.countGrowthEvents();
    db.close();

    return {
      name: "activity",
      value: activity,
      threshold: 10,
      status: activity >= 10 ? "ok" : "warn",
    };
  } catch {
    return { name: "activity", value: 0, threshold: 10, status: "error" };
  }
}

function measureGrowth(dbPath: string): CompanionshipMetric {
  try {
    const { repo, db } = openRepo(dbPath);
    const state = repo.readCompanionState();
    db.close();

    if (state) {
      const level = (state as Record<string, unknown>).level ?? 1;
      return {
        name: "growth",
        value: level as number,
        threshold: 5,
        status: (level as number) >= 5 ? "ok" : "warn",
      };
    }
    return { name: "growth", value: 1, threshold: 5, status: "warn" };
  } catch {
    return { name: "growth", value: 0, threshold: 5, status: "error" };
  }
}

function measureContinuity(dbPath: string): CompanionshipMetric {
  try {
    const { repo, db } = openRepo(dbPath);
    const days = repo.countDistinctGrowthDays();
    db.close();

    return {
      name: "continuity",
      value: days,
      threshold: 7,
      status: days >= 7 ? "ok" : "warn",
    };
  } catch {
    return { name: "continuity", value: 0, threshold: 7, status: "error" };
  }
}
