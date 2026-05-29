import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./helpers/snapshot.js";
import { loadPureFunctions } from "./helpers/module-loader.js";

/**
 * DOM rendering behavior tests for the Desktop Companion shell.
 *
 * Verifies that renderAgentSoulShell produces the correct DOM structure
 * for various companion states, approval surfaces, and risk notices.
 */

const fns = await loadPureFunctions();

function createMockTarget() {
  return { innerHTML: "" };
}

describe("Desktop Companion DOM rendering behavior", () => {
  it("renders the companion shell with correct data-state attribute", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/data-state="idle"/);
  });

  it("renders the companion orb with visual state class", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: { ...buildSnapshot().companion, mood: "positive" },
    });
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/companion-orb--positive/);
  });

  it("renders the companion face glyph matching the visual state", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    // idle state → "-" face
    expect(target.innerHTML).toMatch(/companion-face/);
    expect(target.innerHTML).toMatch(/>-</);
  });

  it("renders companion name in the panel", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/Test Companion/);
  });

  it("renders Pet Appearance label in the summary", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        petAppearance: { kind: "cat", skin: "tabby", animationStyle: "idle" },
      },
    });
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/cat/);
    expect(target.innerHTML).toMatch(/tabby/);
  });

  it("renders vitals as definition list items", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        vitals: { level: 3, xp: 50, companionEnergy: 75, hunger: 60, intimacy: 20 },
      },
    });
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/<dt>Level<\/dt>/);
    expect(target.innerHTML).toMatch(/<dd>3<\/dd>/);
    expect(target.innerHTML).toMatch(/<dt>Energy<\/dt>/);
    expect(target.innerHTML).toMatch(/75%/);
  });

  it("renders all four interaction buttons", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/data-interaction="feed"/);
    expect(target.innerHTML).toMatch(/data-interaction="play"/);
    expect(target.innerHTML).toMatch(/data-interaction="pet"/);
    expect(target.innerHTML).toMatch(/data-interaction="sleep"/);
  });

  it("renders approval required section when pending approval is present", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    const approval = {
      id: "approval-1",
      title: "Delete file",
      message: "Agent wants to delete config.yaml",
      actionRiskClass: "sensitive",
      createdAt: "2025-01-01T00:00:00Z",
    };
    fns.renderAgentSoulShell(target, snapshot, undefined, approval);

    expect(target.innerHTML).toMatch(/approval-required/);
    expect(target.innerHTML).toMatch(/Delete file/);
    expect(target.innerHTML).toMatch(/data-approval-decision="allowed"/);
    expect(target.innerHTML).toMatch(/data-approval-decision="denied"/);
  });

  it("omits approval section when no pending approval", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).not.toMatch(/approval-required/);
  });

  it("renders risk notices when present", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    const notices = [
      { id: "risk-1", message: "Unusual token usage spike", observedAt: "2025-01-01T00:00:00Z", clientAuthorizationMode: "elevated" },
    ];
    fns.renderAgentSoulShell(target, snapshot, undefined, undefined, notices);

    expect(target.innerHTML).toMatch(/risk-notices/);
    expect(target.innerHTML).toMatch(/Unusual token usage spike/);
    expect(target.innerHTML).toMatch(/Client Authorization Mode: elevated/);
  });

  it("omits risk notices section when no notices", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    // When no risk notices, the risk-notices section should not be present
    // (the Settings area may reference "Sensitive Export" as text, but no <section class="risk-notices">)
    expect(target.innerHTML).not.toMatch(/<section class="risk-notices"/);
  });

  it("renders all seven Control Center areas with data-control-area attributes", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    const areas = ["companion", "gateway", "costs", "skills", "sessions", "safety", "settings"];
    for (const area of areas) {
      expect(target.innerHTML).toMatch(new RegExp(`data-control-area="${area}"`));
    }
  });

  it("renders Control Center task navigation with data-nav-target attributes", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    const areas = ["companion", "gateway", "skills", "sessions", "costs", "safety", "settings"];
    for (const area of areas) {
      expect(target.innerHTML).toMatch(new RegExp(`data-nav-target="${area}"`));
    }
  });

  it("escapes HTML in companion name and approval messages", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        displayName: "<script>alert('xss')</script>",
      },
    });
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).not.toMatch(/<script>alert/);
    expect(target.innerHTML).toMatch(/&lt;script&gt;/);
  });
});
