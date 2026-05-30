import { describe, expect, it } from "vitest";
import { resolveSessionResumeFeedback } from "../src/controller";

describe("session resume feedback classifier", () => {
  it("classifies missing command", () => {
    const r = resolveSessionResumeFeedback("No resume command available");
    expect(r.key).toBe("sessions.resumeReason.noCommand");
    expect(r.level).toBe("error");
    expect(r.hintKey).toBe("sessions.resumeHint.reScan");
  });

  it("classifies not found", () => {
    const r = resolveSessionResumeFeedback("Session not found");
    expect(r.key).toBe("sessions.resumeReason.notFound");
    expect(r.level).toBe("info");
  });

  it("falls back to generic exec failure", () => {
    const r = resolveSessionResumeFeedback("unexpected failure");
    expect(r.key).toBe("sessions.resumeReason.execFailed");
    expect(r.level).toBe("error");
  });
});
