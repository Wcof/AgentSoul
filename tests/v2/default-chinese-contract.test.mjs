import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

describe("AgentSoul v2 default Chinese locale", () => {
  it("sets i18n default locale to zh and keeps English as fallback", () => {
    const source = readFileSync(
      join(root, "apps", "desktop-v2", "src", "i18n", "index.ts"),
      "utf8",
    );

    expect(source).toMatch(/defaultLocale\s*=\s*"zh"/);
    expect(source).toMatch(/lng:\s*defaultLocale/);
    expect(source).toMatch(/fallbackLng:\s*"en"/);
  });

  it("uses zh as the initial app settings language in desktop snapshot", () => {
    const source = readFileSync(
      join(root, "apps", "desktop-v2", "src", "renderers.ts"),
      "utf8",
    );

    expect(source).toMatch(/language:\s*"zh"/);
  });
});
