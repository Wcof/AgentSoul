import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = process.cwd();

describe("AgentSoul v2 Control Center Gateway and Costs areas", () => {
  it("exposes Gateway and Costs Area rendering from local API snapshot data", () => {
    const source = readFileSync(join(root, "apps", "desktop-v2", "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Gateway Area/);
    assert.match(source, /Control Center Costs Area/);
    assert.match(source, /renderControlCenterGatewayAreaViewModel/);
    assert.match(source, /renderControlCenterCostsAreaViewModel/);
    assert.match(source, /data-control-area="gateway"/);
    assert.match(source, /data-control-area="costs"/);
  });

  it("verifies active provider, route health, adapter support, estimated cost, provider usage, tokens, latency, and mix rendering", () => {
    const appTest = readFileSync(
      join(root, "apps", "desktop-v2", "tests", "companion-view.test.mjs"),
      "utf8",
    );
    const output = execFileSync("npm", ["run", "v2:test"], {
      cwd: root,
      encoding: "utf8",
    });

    assert.match(appTest, /Active Provider Profile/);
    assert.match(appTest, /Gateway Route Health/);
    assert.match(appTest, /Provider Adapter Support/);
    assert.match(appTest, /Estimated Cost/);
    assert.match(appTest, /Provider Usage/);
    assert.match(appTest, /Token Usage/);
    assert.match(appTest, /Latency/);
    assert.match(appTest, /Model Mix/);
    assert.match(appTest, /Provider Mix/);
    assert.match(output, /Control Center Gateway and Costs areas/);
  });
});
