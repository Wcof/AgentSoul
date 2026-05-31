
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import Database from "better-sqlite3";
import {
  startLocalGateway,
  createChannelStore,
  createGatewayAuditRepository,
  createCostTracker,
  createLocalCompanionKernel,
  createProviderDirectCaller,
} from "@agentsoul/gateway";
import {
  initializeV2Database,
  createControlPlaneStore,
} from "@agentsoul/persistence";
import { SessionRepository } from "@agentsoul/sessions";
import { createProviderProfileService } from "@agentsoul/provider";
import { createMemoryStore } from "@agentsoul/memory";
import { createSkillSourceStore } from "@agentsoul/skills";

async function main() {
  const dataDir = join("/Users/ldh/Downloads/project/AgentSoul", "data", "desktop-v2");
  mkdirSync(dataDir, { recursive: true });
  const dbPath = join(dataDir, "agentsoul-v2.sqlite");

  initializeV2Database(dbPath);

  const providerProfiles = createProviderProfileService({ dbPath });
  const channelStore = createChannelStore({ dbPath });
  const audit = createGatewayAuditRepository({ dbPath });
  const costTracker = createCostTracker({ channelStore, audit });
  const controlPlaneStore = createControlPlaneStore(join(dataDir, "control-plane.sqlite"));
  const memoryStore = createMemoryStore({ dbPath });
  const skillStore = createSkillSourceStore({ dbPath });

  const db = new Database(dbPath);
  const sessionRepository = new SessionRepository(db);
  const directCaller = createProviderDirectCaller({ providerProfiles, audit });
  const companionKernel = createLocalCompanionKernel({
    memoryStore,
    skillStore,
    directCaller,
    projectPath: "/Users/ldh/Downloads/project/AgentSoul",
  });

  const gateway = await startLocalGateway({
    providerProfiles,
    channelStore,
    costTracker,
    controlPlaneStore,
    sessionRepository,
    companionChat: {
      directCaller,
      memoryProvider: companionKernel.memoryProvider,
      skillProvider: companionKernel.skillProvider,
      compression: { maxCharacters: 12000, preserveRecentMessages: 8 },
    },
    host: "127.0.0.1",
    port: 0,
  });

  // Print the port to stdout for the parent process
  console.log("GATEWAY_READY:" + gateway.port);

  // Keep alive until parent kills us
  process.on("SIGTERM", async () => {
    controlPlaneStore.close();
    memoryStore.close();
    skillStore.close();
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
