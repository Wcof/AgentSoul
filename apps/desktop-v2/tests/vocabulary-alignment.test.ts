import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;
const projectRoot = new URL("../../../", import.meta.url).pathname;

describe("Issue #105: Channel-first vocabulary alignment", () => {
  it("ADR-0008 describes Gateway Area as Channel-first", () => {
    const adr = readFileSync(join(projectRoot, "docs", "adr", "0008-desktop-companion-control-center.md"), "utf8");

    expect(adr).toMatch(/Channel-first/);
  });

  it("CONTEXT.md defines Channel First concept", () => {
    const context = readFileSync(join(projectRoot, "CONTEXT.md"), "utf8");

    expect(context).toMatch(/Channel First/);
    expect(context).toMatch(/Authoritative Store/);
    expect(context).toMatch(/Local Control Plane/);
  });

  it("renderers do not use Provider-first language in area titles", () => {
    const source = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // No Provider Management area title
    expect(source).not.toMatch(/Provider Management/);
    expect(source).not.toMatch(/API Provider Health/);
  });
});
