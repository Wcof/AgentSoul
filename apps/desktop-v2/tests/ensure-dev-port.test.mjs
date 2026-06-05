import { describe, it, expect } from "vitest";

import { ensureDevPortAvailable, findOwnedVitePid } from "../scripts/ensure-dev-port.mjs";

const repoRoot = "/Users/ldh/Downloads/project/AgentSoul";

describe("findOwnedVitePid", () => {
  it("returns the pid for a listening vite process owned by this repo", () => {
    const pid = findOwnedVitePid({
      repoRoot,
      lsofOutput: "213\n",
      processCommandByPid: new Map([
        ["213", `node ${repoRoot}/node_modules/.bin/vite --host 127.0.0.1`],
      ]),
    });

    expect(pid).toBe("213");
  });

  it("ignores processes that do not belong to this repo", () => {
    const pid = findOwnedVitePid({
      repoRoot,
      lsofOutput: "213\n",
      processCommandByPid: new Map([
        ["213", "node /tmp/other-project/node_modules/.bin/vite --host 127.0.0.1"],
      ]),
    });

    expect(pid).toBeNull();
  });

  it("ignores non-vite processes even when they listen on the same port", () => {
    const pid = findOwnedVitePid({
      repoRoot,
      lsofOutput: "213\n",
      processCommandByPid: new Map([
        ["213", `node ${repoRoot}/scripts/some-other-server.mjs`],
      ]),
    });

    expect(pid).toBeNull();
  });

  it("does not fail when process ownership cannot be inspected", () => {
    const killed = ensureDevPortAvailable({
      repoRoot,
      port: "1420",
      execFileSyncImpl(command, args) {
        if (command === "lsof") return "213\n";
        if (command === "ps") {
          const error = new Error("spawnSync ps EPERM");
          error.code = "EPERM";
          throw error;
        }
        throw new Error(`unexpected command ${command} ${args?.join(" ")}`);
      },
      logger: { log() {}, warn() {} },
    });

    expect(killed).toBe(false);
  });

  it("treats no process listening on the dev port as already available", () => {
    const killed = ensureDevPortAvailable({
      repoRoot,
      port: "1420",
      execFileSyncImpl(command) {
        if (command === "lsof") {
          const error = new Error("Command failed: lsof -t -iTCP:1420 -sTCP:LISTEN");
          error.status = 1;
          error.stdout = "";
          error.stderr = "";
          throw error;
        }
        throw new Error(`unexpected command ${command}`);
      },
      logger: { log() {}, warn() {} },
    });

    expect(killed).toBe(false);
  });
});
