import { describe, it, expect } from "vitest";

import { findOwnedVitePid } from "../scripts/ensure-dev-port.mjs";

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
});
