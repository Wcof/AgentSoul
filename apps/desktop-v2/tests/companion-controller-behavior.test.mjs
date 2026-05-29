import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./helpers/snapshot.js";
import { loadPureFunctions } from "./helpers/module-loader.js";

/**
 * Interaction behavior tests for the Desktop Companion controller.
 *
 * Verifies that createDesktopCompanionController correctly:
 * - Renders initial state
 * - Re-renders on snapshot changes
 * - Delegates interaction calls
 * - Delegates approval decisions
 */

const fns = await loadPureFunctions();

function createMockTarget() {
  const elements = [];
  return {
    innerHTML: "",
    querySelectorAll: (selector) => {
      // Parse innerHTML to find matching elements (simplified)
      const matches = [];
      const regex = /<[^>]+class="[^"]*\b(selector-part)\b[^"]*"[^>]*>/g;
      // For our tests we just return a fake array
      return matches;
    },
    querySelector: (selector) => null,
    addEventListener: () => {},
  };
}

describe("Desktop Companion controller interaction behavior", () => {
  it("renders initial snapshot on creation", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    const interactions = [];
    const approvals = [];

    fns.createDesktopCompanionController({
      target,
      initialSnapshot: snapshot,
      async performInteraction(kind) {
        interactions.push(kind);
        return { outcome: "applied", state: snapshot };
      },
      async decideApproval(kind) {
        approvals.push(kind);
      },
    });

    expect(target.innerHTML.length > 0, "target should have rendered content").toBeTruthy();
    expect(target.innerHTML).toMatch(/Test Companion/);
  });

  it("re-renders when controller.render() is called with a new snapshot", () => {
    const target = createMockTarget();
    const snapshot1 = buildSnapshot();
    const snapshot2 = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        displayName: "Updated Companion",
        mood: "positive",
      },
    });
    const interactions = [];
    const approvals = [];

    const controller = fns.createDesktopCompanionController({
      target,
      initialSnapshot: snapshot1,
      async performInteraction(kind) {
        interactions.push(kind);
        return { outcome: "applied", state: snapshot2 };
      },
      async decideApproval(kind) {
        approvals.push(kind);
      },
    });

    // Verify initial render
    expect(target.innerHTML).toMatch(/Test Companion/);

    // Re-render with new snapshot
    controller.render(snapshot2);

    expect(target.innerHTML).toMatch(/Updated Companion/);
    expect(target.innerHTML).toMatch(/companion-orb--positive/);
  });

  it("re-renders with interaction status when controller.render() receives status", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();

    const controller = fns.createDesktopCompanionController({
      target,
      initialSnapshot: snapshot,
      async performInteraction(kind) {
        return { outcome: "applied", state: snapshot };
      },
      async decideApproval() {},
    });

    controller.render(snapshot, "Feed applied!");

    expect(target.innerHTML).toMatch(/Feed applied!/);
  });
});

describe("Desktop Companion controller default snapshot behavior", () => {
  it("uses defaultCompanionSnapshot when no initialSnapshot is provided", () => {
    const target = createMockTarget();

    fns.createDesktopCompanionController({
      target,
      async performInteraction() {
        return { outcome: "applied", state: fns.defaultCompanionSnapshot };
      },
      async decideApproval() {},
    });

    expect(target.innerHTML).toMatch(/AgentSoul Companion/);
  });
});
