#!/usr/bin/env node
import { accessSync, constants } from "node:fs";
import { delimiter, dirname, join } from "node:path";
import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

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

const child = spawn(
  "npm",
  ["--workspace", "@agentsoul/desktop-v2", "run", "tauri", "--", "dev", ...process.argv.slice(2)],
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
