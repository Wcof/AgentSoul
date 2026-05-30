import { describe, expect, it } from "vitest";
import { sanitizeImportedAppSettings } from "../src/controller";
import { defaultCompanionSnapshot } from "../src/renderers";

describe("settings import safety", () => {
  it("only accepts known keys and types", () => {
    const current = { ...defaultCompanionSnapshot.appSettings };
    const next = sanitizeImportedAppSettings(
      {
        language: "en",
        theme: "light",
        failoverThreshold: 7,
        telemetryEnabled: true,
        unknownField: "should-be-ignored",
        mcpDefaultTimeout: "bad-type",
      },
      current,
    );
    expect(next.language).toBe("en");
    expect(next.theme).toBe("light");
    expect(next.failoverThreshold).toBe(7);
    expect(next.telemetryEnabled).toBe(true);
    expect((next as Record<string, unknown>).unknownField).toBeUndefined();
    expect(next.mcpDefaultTimeout).toBe(current.mcpDefaultTimeout);
  });

  it("clamps numeric values into safe ranges", () => {
    const current = { ...defaultCompanionSnapshot.appSettings };
    const next = sanitizeImportedAppSettings(
      {
        terminalFontSize: 1000,
        failoverThreshold: -9,
        glassOpacity: 999,
      },
      current,
    );
    expect(next.terminalFontSize).toBe(24);
    expect(next.failoverThreshold).toBe(1);
    expect(next.glassOpacity).toBe(100);
  });

  it("throws on non-object payload", () => {
    const current = { ...defaultCompanionSnapshot.appSettings };
    expect(() => sanitizeImportedAppSettings(null, current)).toThrow();
    expect(() => sanitizeImportedAppSettings("{}", current)).toThrow();
  });
});
