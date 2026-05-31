import { describe, expect, it } from "vitest";
import { isValidApiKey, parseQuickInput } from "../src/utils/quickInputParser";

describe("quick input parser", () => {
  it("recognizes tp-prefixed api keys", () => {
    expect(isValidApiKey("tp-czeo9pqv7dpalp4rebh60weqyz4hddhmpbak9fzmrwa11khf")).toBe(true);
  });

  it("detects anthropic-like endpoint as claude and cleans base url", () => {
    const result = parseQuickInput("https://token-plan-cn.xiaomimimo.com/anthropic");
    expect(result.detectedServiceType).toBe("claude");
    expect(result.detectedBaseUrl).toBe("https://token-plan-cn.xiaomimimo.com");
  });
});
