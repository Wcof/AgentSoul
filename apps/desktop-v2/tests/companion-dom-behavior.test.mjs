import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./helpers/snapshot.js";
import { renderDesktopCompanionSurface } from "../src/desktop-body";

function createMockTarget() {
  return { innerHTML: "", classList: { contains: () => false, toggle: () => {}, remove: () => {}, add: () => {} }, querySelectorAll: () => [] };
}

describe("Desktop Body companion DOM rendering behavior", () => {
  it("renders the Desktop Body pet widget with the current visual state", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();

    renderDesktopCompanionSurface({ target, snapshot });

    expect(target.innerHTML).toMatch(/class="pet-widget"/);
    expect(target.innerHTML).toMatch(/data-state="idle"/);
    expect(target.innerHTML).toMatch(/aria-label="Desktop Companion Widget"/);
    expect(target.innerHTML).toMatch(/pet-widget__character/);
    expect(target.innerHTML).toMatch(/companion-canvas clean-avatar/);
  });

  it("projects autonomy into attention and sleep states without Control Center areas", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        autonomy: {
          userPresence: "PRESENT",
          companionMode: "QUEUING",
          lastEventPriority: "MEDIUM",
          lastOutputStrategy: "queue",
          queuedOutputCount: 2,
        },
      },
    });

    renderDesktopCompanionSurface({ target, snapshot });

    expect(target.innerHTML).toMatch(/data-state="attention"/);
    expect(target.innerHTML).not.toMatch(/data-control-area=/);
    expect(target.innerHTML).not.toMatch(/data-nav-target=/);
    expect(target.innerHTML).not.toMatch(/renderAgentSoulShell/);
  });

  it("renders inline interaction controls from Desktop Body menu", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();

    renderDesktopCompanionSurface({ target, snapshot, menuOpen: true });

    for (const kind of ["feed", "play", "pet", "sleep"]) {
      expect(target.innerHTML).toMatch(new RegExp(`data-interaction="${kind}"`));
    }
    expect(target.innerHTML).toMatch(/data-companion-inline-form/);
    expect(target.innerHTML).toMatch(/data-companion-inline-submit/);
    expect(target.innerHTML).toMatch(/data-pet-context-panel/);
  });

  it("offers one direct asset-pack change action in the pet menu", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        petAppearance: {
          kind: "custom",
          skin: "yuanqi-mianmian",
          animationStyle: "idle",
          assetPackPath: "/Users/ldh/Downloads/yuanqi-mianmian.codex-pet",
        },
      },
    });

    renderDesktopCompanionSurface({ target, snapshot, menuOpen: true });

    expect(target.innerHTML.match(/data-pet-tool="asset-pack"/g)).toHaveLength(1);
    expect(target.innerHTML).toMatch(/更换形象/);
    expect(target.innerHTML).not.toMatch(/data-companion-pick-pack/);
    expect(target.innerHTML).not.toMatch(/选择文件夹/);
  });

  it("keeps approval and risk notice page shells outside Desktop Body DOM", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot();

    renderDesktopCompanionSurface({ target, snapshot, menuOpen: true });

    expect(target.innerHTML).not.toMatch(/approval-required/);
    expect(target.innerHTML).not.toMatch(/risk-notices/);
    expect(target.innerHTML).not.toMatch(/data-approval-decision/);
    expect(target.innerHTML).not.toMatch(/Client Authorization Mode/);
  });

  it("escapes asset-pack validation messages rendered in the surface", () => {
    const target = createMockTarget();
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        petAppearance: {
          kind: "custom",
          skin: "custom",
          animationStyle: "idle",
          assetValidation: { level: "error", messages: ["<script>alert('xss')</script>"] },
        },
      },
    });

    renderDesktopCompanionSurface({ target, snapshot });

    expect(target.innerHTML).not.toMatch(/<script>alert/);
    expect(target.innerHTML).toMatch(/&lt;script&gt;/);
  });
});
