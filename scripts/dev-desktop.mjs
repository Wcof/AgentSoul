#!/usr/bin/env node
import { accessSync, constants } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { request } from "node:http";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { ensureDevPortAvailable } from "../apps/desktop-v2/scripts/ensure-dev-port.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

const cargoBinDir = join(homedir(), ".cargo", "bin");
const pathParts = (process.env.PATH ?? "").split(delimiter).filter(Boolean);
if (!pathParts.includes(cargoBinDir)) {
  pathParts.unshift(cargoBinDir);
}

const env = {
  ...process.env,
  PATH: pathParts.join(delimiter),
};

try {
  accessSync(join(cargoBinDir, "cargo"), constants.X_OK);
} catch {
  console.error("AgentSoul desktop dev requires Rust/Cargo for Tauri.");
  console.error("Install Rust from https://rustup.rs/ or make sure cargo is available on PATH.");
  process.exit(1);
}

ensureDevPortAvailable({ repoRoot, port: "1420" });

const reuseExistingDevServer = await isDevServerResponding("http://127.0.0.1:1420/");
if (reuseExistingDevServer) {
  console.log("Reusing existing Vite dev server at http://127.0.0.1:1420/.");
}

const tauriArgs = [
  "--workspace",
  "@agentsoul/desktop-v2",
  "run",
  "tauri",
  "--",
  "dev",
  ...(reuseExistingDevServer ? [
    "--config",
    '{"build":{"beforeDevCommand":""}}',
    "--no-dev-server-wait",
    "--no-watch",
  ] : []),
  ...process.argv.slice(2),
];

const child = spawn(
  "npm",
  tauriArgs,
  {
    cwd: repoRoot,
    env,
    stdio: "inherit",
  },
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

function isDevServerResponding(url) {
  return new Promise((resolve) => {
    const req = request(url, { method: "HEAD", timeout: 600 }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
    req.on("error", () => resolve(false));
    req.end();
  });
}
