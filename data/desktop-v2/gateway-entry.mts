
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  startLocalGateway,
  createChannelStore,
  createCostTracker,
} from "@agentsoul/gateway";
import {
  initializeV2Database,
  createControlPlaneStore,
  SessionRepository,
} from "@agentsoul/persistence";
import { createProviderProfileService } from "@agentsoul/provider";

async function main() {
  const dataDir = join("/Users/ldh/Downloads/project/AgentSoul", "data", "desktop-v2");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "agentsoul-v2.sqlite");

  initializeV2Database(dbPath);

  const providerProfiles = createProviderProfileService({ dbPath });
  const channelStore = createChannelStore({ dbPath });
  const costTracker = createCostTracker({ channelStore });
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
    db.close();
    channelStore.close();
    costTracker.close();
    providerProfiles.close();
    await gateway.close();
    process.exit(0);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
