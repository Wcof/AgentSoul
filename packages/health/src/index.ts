import type { HealthReport, CompanionshipReport, HealthCheckResult, CompanionshipMetric } from "@agentsoul/domain";

export interface HealthCheckerOptions {
  dbPath: string;
  clock?: () => Date;
}

export interface HealthChecker {
  runHealthCheck(): HealthReport;
  generateCompanionshipReport(): CompanionshipReport;
}

export function createHealthChecker(options: HealthCheckerOptions): HealthChecker {
  const clock = options.clock ?? (() => new Date());
  
  return {
    runHealthCheck(): HealthReport {
      const results: HealthCheckResult[] = [];
      
      // 检查数据库连接
      results.push(checkDatabase(options.dbPath));
      
      // 检查配置
      results.push(checkConfig(options.dbPath));
      
      // 检查 companion 状态
      results.push(checkCompanionState(options.dbPath));
      
      // 检查 Gateway 连接（模拟）
      results.push(checkGatewayConnectivity());
      
      // 计算总分
      const score = calculateHealthScore(results);
      
      return {
        results,
        score,
        checkedAt: clock().toISOString(),
      };
    },
    
    generateCompanionshipReport(): CompanionshipReport {
      const metrics: CompanionshipMetric[] = [];
      
      // 1. 亲密度
      metrics.push(measureIntimacy(options.dbPath));
      
      // 2. 能量水平
      metrics.push(measureEnergy(options.dbPath));
      
      // 3. 活跃度
      metrics.push(measureActivity(options.dbPath));
      
      // 4. 成长进度
      metrics.push(measureGrowth(options.dbPath));
      
      // 5. 连续性
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

function checkDatabase(dbPath: string): HealthCheckResult {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    db.prepare("SELECT 1").get();
    db.close();
    return { component: "database", status: "ok", message: "SQLite connection successful" };
  } catch (error) {
    return { 
      component: "database", 
      status: "error", 
      message: `Database connection failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

function checkConfig(dbPath: string): HealthCheckResult {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const tableExists = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='config_versions'"
    ).get();
    db.close();
    
    if (tableExists) {
      return { component: "config", status: "ok", message: "Config table exists" };
    }
    return { component: "config", status: "warn", message: "Config table missing" };
  } catch (error) {
    return { 
      component: "config", 
      status: "error", 
      message: `Config check failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

function checkCompanionState(dbPath: string): HealthCheckResult {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const state = db.prepare(
      "SELECT state_json FROM companion_state LIMIT 1"
    ).get();
    db.close();
    
    if (state) {
      return { component: "companion", status: "ok", message: "Companion state loaded" };
    }
    return { component: "companion", status: "warn", message: "No companion state found" };
  } catch (error) {
    return { 
      component: "companion", 
      status: "error", 
      message: `Companion check failed: ${error instanceof Error ? error.message : String(error)}` 
    };
  }
}

function checkGatewayConnectivity(): HealthCheckResult {
  // Gateway 连接检查（模拟，实际需要网络请求）
  return { component: "gateway", status: "ok", message: "Gateway connectivity assumed OK (local mode)" };
}

function calculateHealthScore(results: HealthCheckResult[]): number {
  const weights = { ok: 100, warn: 60, error: 0 };
  const total = results.reduce((sum, r) => sum + weights[r.status], 0);
  return Math.round(total / results.length);
}

function measureIntimacy(dbPath: string): CompanionshipMetric {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const row = db.prepare(
      "SELECT state_json FROM companion_state LIMIT 1"
    ).get();
    db.close();
    
    if (row) {
      const state = JSON.parse(row.state_json);
      const intimacy = state.intimacy ?? 0;
      return {
        name: "intimacy",
        value: intimacy,
        threshold: 50,
        status: intimacy >= 50 ? "ok" : "warn",
      };
    }
    return { name: "intimacy", value: 0, threshold: 50, status: "warn" };
  } catch {
    return { name: "intimacy", value: 0, threshold: 50, status: "error" };
  }
}

function measureEnergy(dbPath: string): CompanionshipMetric {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const row = db.prepare(
      "SELECT state_json FROM companion_state LIMIT 1"
    ).get();
    db.close();
    
    if (row) {
      const state = JSON.parse(row.state_json);
      const energy = state.energy ?? 0;
      return {
        name: "energy",
        value: energy,
        threshold: 30,
        status: energy >= 30 ? "ok" : "warn",
      };
    }
    return { name: "energy", value: 0, threshold: 30, status: "warn" };
  } catch {
    return { name: "energy", value: 0, threshold: 30, status: "error" };
  }
}

function measureActivity(dbPath: string): CompanionshipMetric {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const count = db.prepare(
      "SELECT COUNT(*) as count FROM growth_events"
    ).get();
    db.close();
    
    const activity = count?.count ?? 0;
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
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const row = db.prepare(
      "SELECT state_json FROM companion_state LIMIT 1"
    ).get();
    db.close();
    
    if (row) {
      const state = JSON.parse(row.state_json);
      const level = state.level ?? 1;
      return {
        name: "growth",
        value: level,
        threshold: 5,
        status: level >= 5 ? "ok" : "warn",
      };
    }
    return { name: "growth", value: 1, threshold: 5, status: "warn" };
  } catch {
    return { name: "growth", value: 0, threshold: 5, status: "error" };
  }
}

function measureContinuity(dbPath: string): CompanionshipMetric {
  try {
    const Database = require("better-sqlite3");
    const db = new Database(dbPath);
    const count = db.prepare(
      "SELECT COUNT(DISTINCT date(occurred_at)) as days FROM growth_events"
    ).get();
    db.close();
    
    const days = count?.days ?? 0;
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
