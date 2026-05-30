import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

function collectI18nKeys(source: string): string[] {
  const regex = /\bt\(\s*["'`]([^"'`]+)["'`]/g;
  const keys = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source))) {
    const key = match[1];
    // Keep only dotted translation keys (e.g. "settings.saved").
    if (!key.includes(".")) continue;
    // Ignore dynamic prefixes handled at runtime, e.g. mood.${state}
    if (key.includes("${") || key.endsWith(".")) continue;
    // Ignore accidental captures from non-i18n quoted strings.
    if (/[\s/\\,]/.test(key)) continue;
    keys.add(key);
  }
  return Array.from(keys).sort();
}

function hasPath(obj: unknown, dottedPath: string): boolean {
  let cursor: any = obj;
  for (const segment of dottedPath.split(".")) {
    if (!cursor || typeof cursor !== "object" || !(segment in cursor)) {
      return false;
    }
    cursor = cursor[segment];
  }
  return true;
}

describe("desktop-v2 i18n coverage", () => {
  it("ensures static i18n keys used by controller/renderers exist in zh and en", () => {
    const appRoot = new URL("..", import.meta.url).pathname;
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");
    const zh = JSON.parse(readFileSync(join(appRoot, "src", "i18n", "zh.json"), "utf8"));
    const en = JSON.parse(readFileSync(join(appRoot, "src", "i18n", "en.json"), "utf8"));

    const keys = new Set([
      ...collectI18nKeys(controllerSource),
      ...collectI18nKeys(renderersSource),
    ]);

    const missingInZh = Array.from(keys).filter((key) => !hasPath(zh, key));
    const missingInEn = Array.from(keys).filter((key) => !hasPath(en, key));

    expect(missingInZh).toEqual([]);
    expect(missingInEn).toEqual([]);
  });
});
