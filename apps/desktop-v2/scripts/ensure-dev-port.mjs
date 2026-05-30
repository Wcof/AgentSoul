import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(scriptDir, "../../..");
const devPort = "1420";

export function findOwnedVitePid({ repoRoot, lsofOutput, processCommandByPid }) {
  const pids = lsofOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const pid of pids) {
    const command = processCommandByPid.get(pid) ?? "";
    const belongsToRepo = command.includes(`${repoRoot}/node_modules/.bin/vite`);
    const isViteCommand = /\bvite\b/.test(command);

    if (belongsToRepo && isViteCommand) {
      return pid;
    }
  }

  return null;
}

export function ensureDevPortAvailable({
  repoRoot,
  port,
  execFileSyncImpl = execFileSync,
  logger = console,
}) {
  const lsofOutput = execFileSyncImpl(
    "lsof",
    ["-t", `-iTCP:${port}`, "-sTCP:LISTEN"],
    { encoding: "utf8" },
  );

  const processCommandByPid = new Map();
  const pids = lsofOutput
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  for (const pid of pids) {
    const command = execFileSyncImpl("ps", ["-p", pid, "-o", "command="], {
      encoding: "utf8",
    }).trim();
    processCommandByPid.set(pid, command);
  }

  const ownedPid = findOwnedVitePid({ repoRoot, lsofOutput, processCommandByPid });

  if (!ownedPid) {
    return false;
  }

  execFileSyncImpl("kill", [ownedPid], { encoding: "utf8" });
  logger.log(`Freed dev port ${port} by stopping stale Vite process ${ownedPid}.`);
  return true;
}

function main() {
  try {
    ensureDevPortAvailable({ repoRoot, port: devPort });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("Command failed: lsof")) {
      return;
    }

    throw error;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main();
}
