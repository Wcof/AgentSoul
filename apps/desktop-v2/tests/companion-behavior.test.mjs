import { describe, it, expect } from "vitest";
import { buildSnapshot } from "./helpers/snapshot.js";
import { loadPureFunctions } from "./helpers/module-loader.js";

/**
 * Behavior tests for the Desktop Companion view model pipeline.
 *
 * These tests verify runtime behavior of pure functions by evaluating the
 * compiled main.ts source in a sandboxed context — no DOM, no Tauri, no Playwright.
 * They complement the existing structural contract tests in tests/v2/.
 */

const fns = await loadPureFunctions();

describe("Companion view model behavior", () => {
  it("renders a CompanionViewModel with correct identity from a runtime snapshot", () => {
    const snapshot = buildSnapshot();
    const vm = fns.renderCompanionViewModel(snapshot);

    expect(vm.viewModelKind).toBe("Companion appearance view model");
    expect(vm.identity).toBe("test-companion");
    expect(vm.name).toBe("Test Companion");
    expect(vm.visualState).toBe("idle");
  });

  it("computes Pet Appearance label from snapshot fields", () => {
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        petAppearance: { kind: "cat", skin: "tabby", outfit: "wizard-hat", animationStyle: "bounce" },
      },
    });
    const vm = fns.renderCompanionViewModel(snapshot);

    expect(vm.appearanceLabel).toMatch(/cat/);
    expect(vm.appearanceLabel).toMatch(/tabby/);
    expect(vm.appearanceLabel).toMatch(/wizard-hat/);
  });

  it("maps vitals to display labels with units", () => {
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        vitals: { level: 5, xp: 120, companionEnergy: 80, hunger: 60, intimacy: 30 },
      },
    });
    const vm = fns.renderCompanionViewModel(snapshot);

    const vitalMap = Object.fromEntries(vm.vitals.map((v) => [v.label, v.value]));
    expect(vitalMap.Level).toBe("5");
    expect(vitalMap.XP).toBe("120");
    expect(vitalMap.Energy).toBe("80%");
    expect(vitalMap.Hunger).toBe("60%");
    expect(vitalMap.Intimacy).toBe("30%");
  });

  it("includes provider route label from snapshot", () => {
    const snapshot = buildSnapshot();
    const vm = fns.renderCompanionViewModel(snapshot);

    expect(vm.providerRouteLabel).toMatch(/Test Provider/);
  });

  it("passes pending approval through to the view model", () => {
    const snapshot = buildSnapshot();
    const approval = {
      id: "approval-1",
      title: "Delete file",
      message: "Agent wants to delete config.yaml",
      actionRiskClass: "sensitive",
      createdAt: "2025-01-01T00:00:00Z",
    };
    const vm = fns.renderCompanionViewModel(snapshot, undefined, approval);

    expect(vm.pendingApproval).toEqual(approval);
  });

  it("passes risk notices through to the view model", () => {
    const snapshot = buildSnapshot();
    const notices = [
      { id: "risk-1", message: "Unusual token usage", observedAt: "2025-01-01T00:00:00Z", clientAuthorizationMode: "elevated" },
    ];
    const vm = fns.renderCompanionViewModel(snapshot, undefined, undefined, notices);

    expect(vm.riskNotices).toEqual(notices);
  });

  it("includes all seven Control Center area view models", () => {
    const snapshot = buildSnapshot();
    const vm = fns.renderCompanionViewModel(snapshot);

    expect(vm.controlCenterCompanionArea.areaKind).toBe("Control Center Companion Area");
    expect(vm.controlCenterGatewayArea.areaKind).toBe("Control Center Gateway Area");
    expect(vm.controlCenterCostsArea.areaKind).toBe("Control Center Costs Area");
    expect(vm.controlCenterSkillsArea.areaKind).toBe("Control Center Skills Area");
    expect(vm.controlCenterSessionsArea.areaKind).toBe("Control Center Sessions Area");
    expect(vm.controlCenterSafetyArea.areaKind).toBe("Control Center Safety Area");
    expect(vm.controlCenterSettingsArea.areaKind).toBe("Control Center Settings Area");
  });
});

describe("Companion visual state resolution behavior", () => {
  it("resolves idle for neutral mood with healthy vitals", () => {
    const snapshot = buildSnapshot();
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("idle");
  });

  it("resolves sleep for sleeping mood", () => {
    const snapshot = buildSnapshot({
      companion: { ...buildSnapshot().companion, mood: "sleeping" },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("sleep");
  });

  it("resolves positive for positive mood", () => {
    const snapshot = buildSnapshot({
      companion: { ...buildSnapshot().companion, mood: "positive" },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("positive");
  });

  it("resolves fatigue when energy is below 20 regardless of mood", () => {
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        mood: "neutral",
        vitals: { ...buildSnapshot().companion.vitals, companionEnergy: 10 },
      },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("fatigue");
  });

  it("resolves fatigue for fatigued mood", () => {
    const snapshot = buildSnapshot({
      companion: { ...buildSnapshot().companion, mood: "fatigued" },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("fatigue");
  });

  it("resolves attention for negative mood", () => {
    const snapshot = buildSnapshot({
      companion: { ...buildSnapshot().companion, mood: "negative" },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("attention");
  });

  it("resolves attention when hunger is below 20", () => {
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        vitals: { ...buildSnapshot().companion.vitals, hunger: 10 },
      },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("attention");
  });

  it("prioritizes sleep over fatigue", () => {
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        mood: "sleeping",
        vitals: { ...buildSnapshot().companion.vitals, companionEnergy: 5 },
      },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("sleep");
  });

  it("prioritizes fatigue over positive mood", () => {
    const snapshot = buildSnapshot({
      companion: {
        ...buildSnapshot().companion,
        mood: "positive",
        vitals: { ...buildSnapshot().companion.vitals, companionEnergy: 10 },
      },
    });
    const state = fns.resolveVisualState(snapshot);
    expect(state).toBe("fatigue");
  });
});
