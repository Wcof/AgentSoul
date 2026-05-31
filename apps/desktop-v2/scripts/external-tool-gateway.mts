import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
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

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..", "..", "..");
const dataDir = join(projectRoot, "data", "desktop-v2");
const host = process.env.AGENTSOUL_EXTERNAL_TOOL_GATEWAY_HOST ?? "127.0.0.1";
const port = Number(process.env.AGENTSOUL_EXTERNAL_TOOL_GATEWAY_PORT ?? "3001");

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
  host,
  port,
});

console.log(`EXTERNAL_TOOL_GATEWAY_READY:http://${host}:${gateway.port}`);

async function shutdown() {
  controlPlaneStore.close();
  audit.close();
  db.close();
  channelStore.close();
  costTracker.close();
  providerProfiles.close();
  await gateway.close();
}

process.on("SIGTERM", () => {
  void shutdown().finally(() => process.exit(0));
});

process.on("SIGINT", () => {
  void shutdown().finally(() => process.exit(0));
});
