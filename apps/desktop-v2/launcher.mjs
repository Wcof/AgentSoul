#!/usr/bin/env node
// ═══════════════════════════════════════════════════════════════════════
// AgentSoul Desktop v2 — Combined Gateway + Desktop Launcher
//
// Starts the local Gateway with all stores, then opens the desktop UI.
// Gateway is started as a sidecar child process. Vite dev server gets
// the Gateway URL injected via AGENSOUL_GATEWAY_URL env var.
//
// Usage:
//   node launcher.mjs              # Gateway + Vite
//   node launcher.mjs --no-vite    # Gateway only (prints URL)
// ═══════════════════════════════════════════════════════════════════════

import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "node:http";
import { writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..");

// ─── Gateway sidecar ───
// The Gateway server script (inline, executed by tsx)
const gatewayScript = `
import { mkdirSync } from "node:fs";
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
  SessionRepository,
} from "@agentsoul/persistence";
import { createProviderProfileService } from "@agentsoul/provider";

async function main() {
  const dataDir = join(${JSON.stringify(projectRoot)}, "data", "desktop-v2");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "agentsoul-v2.sqlite");

  initializeV2Database(dbPath);

  const providerProfiles = createProviderProfileService({ dbPath });
  const channelStore = createChannelStore({ dbPath });
  const audit = createGatewayAuditRepository({ dbPath });
  const costTracker = createCostTracker({ channelStore, audit });
  const controlPlaneStore = createControlPlaneStore(join(dataDir, "control-plane.sqlite"));

  const db = new Database(dbPath);
  const sessionRepository = new SessionRepository(db);

  const gateway = await startLocalGateway({
    providerProfiles,
    channelStore,
    costTracker,
    controlPlaneStore,
    sessionRepository,
    host: "127.0.0.1",
    port: 0,
  });

  // Print the port to stdout for the parent process
  console.log("GATEWAY_READY:" + gateway.port);

  // Keep alive until parent kills us
  process.on("SIGTERM", async () => {
    controlPlaneStore.close();
    audit.close();
    db.close();
    channelStore.close();
    costTracker.close();
    providerProfiles.close();
    await gateway.close();
    process.exit(0);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
`;

// Write gateway script inside project (so node_modules resolves)
const dataDir = join(projectRoot, "data", "desktop-v2");
mkdirSync(dataDir, { recursive: true });
const gatewayScriptPath = join(dataDir, "gateway-entry.mts");
writeFileSync(gatewayScriptPath, gatewayScript);

console.log("[Launcher] Starting Gateway sidecar...");

const gatewayProc = spawn("npx", ["tsx", gatewayScriptPath], {
  cwd: projectRoot,
  stdio: ["pipe", "pipe", "inherit"],
  env: process.env,
});

let gatewayUrl = null;
let gatewayReady = false;

gatewayProc.stdout.on("data", (data) => {
  const line = data.toString().trim();
  if (line.startsWith("GATEWAY_READY:")) {
    const port = line.split(":")[1];
    gatewayUrl = `http://127.0.0.1:${port}`;
    gatewayReady = true;
    onGatewayReady();
  }
  // Forward other output
  if (!line.startsWith("GATEWAY_READY:")) {
    console.log("[Gateway]", line);
  }
});

gatewayProc.on("close", (code) => {
  console.log(`[Gateway] Process exited with code ${code}`);
  if (viteProc) {
    viteProc.kill();
  }
  process.exit(code ?? 0);
});

function onGatewayReady() {
  console.log(`[Gateway] Ready at ${gatewayUrl}`);

  const noVite = process.argv.includes("--no-vite");

  if (noVite) {
    console.log(`[Launcher] Gateway URL: ${gatewayUrl}`);
    console.log("[Launcher] Set AGENSOUL_GATEWAY_URL=" + gatewayUrl + " before starting Vite.");
    return;
  }

  // Start Vite with Gateway URL injected
  console.log("[Launcher] Starting Vite dev server...");
  const viteEnv = {
    ...process.env,
    AGENSOUL_GATEWAY_URL: gatewayUrl,
  };

  viteProc = spawn("npx", ["vite", "--host", "127.0.0.1"], {
    cwd: __dirname,
    env: viteEnv,
    stdio: "inherit",
  });

  viteProc.on("close", (code) => {
    console.log(`[Vite] Exited with code ${code}`);
    gatewayProc.kill("SIGTERM");
  });
}

let viteProc = null;

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("[Launcher] Shutting down...");
  if (viteProc) viteProc.kill();
  gatewayProc.kill("SIGTERM");
});

process.on("SIGTERM", () => {
  if (viteProc) viteProc.kill();
  gatewayProc.kill("SIGTERM");
});
