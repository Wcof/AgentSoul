import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;
const projectRoot = new URL("../../../", import.meta.url).pathname;

describe("Desktop Body-first vocabulary alignment", () => {
  it("keeps the old Channel-first ADR as historical context", () => {
    const adr = readFileSync(join(projectRoot, "docs", "adr", "0008-desktop-companion-control-center.md"), "utf8");

    expect(adr).toMatch(/Channel-first/);
  });

  it("CONTEXT.md defines the current Desktop Body-first product language", () => {
    const context = readFileSync(join(projectRoot, "CONTEXT.md"), "utf8");

    expect(context).toMatch(/Desktop Body/);
    expect(context).toMatch(/Agent Mind/);
    expect(context).toMatch(/Memory/);
    expect(context).toMatch(/Extension Runtime/);
    expect(context).toMatch(/Legacy Gateway/);
    expect(context).toMatch(/Legacy Area/);
    expect(context).not.toMatch(/Channel First/);
    expect(context).not.toMatch(/Local Control Plane/);
  });

  it("renderers do not use Provider-first language in area titles", () => {
    const source = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    // No Provider Management area title
    expect(source).not.toMatch(/Provider Management/);
    expect(source).not.toMatch(/API Provider Health/);
  });
});
