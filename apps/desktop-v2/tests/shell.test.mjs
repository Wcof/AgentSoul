import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("AgentSoul v2 desktop shell", () => {
  it("declares the local-first companion shell copy", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /AgentSoul v2 desktop shell/);
    assert.match(source, /Local-first AI Agent Companion/);
    assert.match(source, /Desktop Companion and Control Center/);
  });
});
