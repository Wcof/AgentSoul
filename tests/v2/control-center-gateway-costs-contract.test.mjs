import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { readAllAreaSources } from "./helpers/areaSource.js";

const root = process.cwd();

describe("AgentSoul v2 Control Center Gateway and Costs areas", () => {
  it("exposes Gateway and Costs Area rendering from local API snapshot data", () => {
    const source = readAllAreaSources(root);

    expect(source).toMatch(/Control Center Gateway Area/);
    expect(source).toMatch(/Control Center Costs Area/);
    expect(source).toMatch(/renderControlCenterGatewayAreaViewModel/);
    expect(source).toMatch(/renderControlCenterCostsAreaViewModel/);
    expect(source).toMatch(/data-control-area="gateway"/);
    expect(source).toMatch(/data-control-area="costs"/);
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

    expect(appTest).toMatch(/Active Provider Profile/);
    expect(appTest).toMatch(/Gateway Route Health/);
    expect(appTest).toMatch(/Provider Adapter Support/);
    expect(appTest).toMatch(/Estimated Cost/);
    expect(appTest).toMatch(/Provider Usage/);
    expect(appTest).toMatch(/Token Usage/);
    expect(appTest).toMatch(/Latency/);
    expect(appTest).toMatch(/Model Mix/);
    expect(appTest).toMatch(/Provider Mix/);
    expect(output).toMatch(/Control Center Gateway and Costs areas/);
  }, 120000);
});
