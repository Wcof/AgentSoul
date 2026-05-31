import { describe, expect, it } from "vitest";
import { defaultCompanionSnapshot } from "../src/data/defaultSnapshot";
import { mergeNativeCompanionRuntimeState } from "../src/shared/shell";

describe("native companion runtime merge", () => {
  it("preserves Tauri autonomous loop state in the frontend snapshot", () => {
    const merged = mergeNativeCompanionRuntimeState(defaultCompanionSnapshot, {
      companion: {
        autonomy: {
          userPresence: "PRESENT",
          companionMode: "QUEUING",
          lastEventPriority: "MEDIUM",
          lastOutputStrategy: "queue",
          queuedOutputCount: 1,
          lastAction: "surface-memory-or-status",
        },
      },
    });

    expect(merged.companion.autonomy?.companionMode).toBe("QUEUING");
    expect(merged.companion.autonomy?.lastOutputStrategy).toBe("queue");
    expect(merged.companion.autonomy?.queuedOutputCount).toBe(1);
    expect(merged.companion.autonomy?.userPresence).toBe("PRESENT");
  });
});
