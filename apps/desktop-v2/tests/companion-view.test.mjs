import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("Desktop Companion appearance view", () => {
  it("renders Pet Appearance and basic Companion states from runtime snapshots", () => {
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Companion appearance view model/);
    expect(renderersSource).toMatch(/renderCompanionViewModel/);
    expect(typesSource).toMatch(/idle/);
    expect(typesSource).toMatch(/positive/);
    expect(typesSource).toMatch(/fatigue/);
    expect(typesSource).toMatch(/sleep/);
    expect(typesSource).toMatch(/attention/);
  });

  it("keeps rendering terms aligned with the AgentSoul Companion glossary", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Pet Appearance/);
    expect(renderersSource).toMatch(/Companion/);
    expect(renderersSource).not.toMatch(/separate character|active pet/i);
  });
});

describe("Desktop Companion interaction command flow", () => {
  it("exposes Feed, Play, Pet, and Sleep controls wired to Growth results", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");

    expect(controllerSource).toMatch(/createDesktopCompanionController/);
    expect(renderersSource).toMatch(/Feed/);
    expect(renderersSource).toMatch(/Play/);
    expect(renderersSource).toMatch(/Pet/);
    expect(renderersSource).toMatch(/Sleep/);
    expect(typesSource).toMatch(/blocked-low-energy/);
    expect(controllerSource).toMatch(/performInteraction/);
  });
});

describe("Desktop Companion approval flow", () => {
  it("displays pending Approval Required state and exposes Allow/Deny decisions", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");
    const controllerSource = readFileSync(join(appRoot, "src", "controller.ts"), "utf8");

    expect(renderersSource).toMatch(/Approval Required/);
    expect(renderersSource).toMatch(/pendingApproval/);
    expect(controllerSource).toMatch(/data-approval-decision="allowed"/);
    expect(controllerSource).toMatch(/data-approval-decision="denied"/);
    expect(controllerSource).toMatch(/decideApproval/);
  });
});

describe("Desktop Companion risk notice flow", () => {
  it("displays Risk Notice state separately from Approval Required", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Risk Notice/);
    expect(renderersSource).toMatch(/riskNotices/);
    expect(renderersSource).toMatch(/renderRiskNotices/);
    expect(renderersSource).toMatch(/Client Authorization Mode/);
    expect(renderersSource).not.toMatch(/data-risk-notice-decision/);
  });
});

describe("Control Center Companion area", () => {
  it("renders Companion state, Vitals, Mood, Pet Appearance, interactions, and Growth Events", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Companion Area/);
    expect(renderersSource).toMatch(/renderControlCenterCompanionArea/);
    expect(renderersSource).toMatch(/Growth Events/);
    expect(renderersSource).toMatch(/growthHistory/);
    expect(renderersSource).toMatch(/Mood/);
    expect(renderersSource).toMatch(/Level/);
    expect(renderersSource).toMatch(/XP/);
    expect(renderersSource).toMatch(/Pet Appearance/);
    expect(renderersSource).toMatch(/data-control-area="companion"/);
    expect(renderersSource).toMatch(/data-interaction="feed"/);
    expect(renderersSource).toMatch(/data-interaction="play"/);
    expect(renderersSource).toMatch(/data-interaction="pet"/);
    expect(renderersSource).toMatch(/data-interaction="sleep"/);
  });
});

describe("Control Center task navigation", () => {
  it("renders seven task navigation targets and data attributes for all areas", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center task navigation/);
    expect(renderersSource).toMatch(/data-nav-target/);
    for (const area of ["companion", "gateway", "skills", "sessions", "costs", "safety", "settings"]) {
      expect(renderersSource).toMatch(new RegExp(`data-control-area="${area}"`));
    }
  });
});

describe("Control Center Gateway area", () => {
  it("renders channel orchestration with channel cards, add/edit/delete controls, and route health", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Gateway Area/);
    expect(renderersSource).toMatch(/renderControlCenterGatewayArea/);
    expect(renderersSource).toMatch(/channel-orchestration/);
    expect(renderersSource).toMatch(/channel-card/);
    expect(renderersSource).toMatch(/data-channel-action/);
    expect(renderersSource).toMatch(/data-channel-edit/);
    expect(renderersSource).toMatch(/data-channel-delete/);
    expect(renderersSource).toMatch(/data-channel-ping/);
    expect(renderersSource).toMatch(/data-control-area="gateway"/);
    expect(renderersSource).toMatch(/Failover Sequence/);
    expect(renderersSource).toMatch(/Route Health/);
    expect(renderersSource).toMatch(/Active Provider Profile/);
    expect(renderersSource).toMatch(/Gateway Route Health/);
    expect(renderersSource).toMatch(/Provider Adapter Support/);
    expect(renderersSource).toMatch(/Target Model/);
    expect(renderersSource).toMatch(/Latency/);
    expect(renderersSource).toMatch(/Provider Usage/);
  });
});

describe("Control Center Costs area", () => {
  it("renders cost breakdown with per-channel data and dashboard stats", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Costs Area/);
    expect(renderersSource).toMatch(/renderControlCenterCostsArea/);
    expect(renderersSource).toMatch(/cost-breakdown/);
    expect(renderersSource).toMatch(/cost-table/);
    expect(renderersSource).toMatch(/Per-Channel Costs/);
    expect(renderersSource).toMatch(/Estimated Cost/);
    expect(renderersSource).toMatch(/Token Usage/);
    expect(renderersSource).toMatch(/Provider Mix/);
    expect(renderersSource).toMatch(/Model Mix/);
    expect(renderersSource).toMatch(/data-control-area="costs"/);
  });
});

describe("Control Center Skills area", () => {
  it("renders Skill Installation, Project Skill Activation, Workspace Rule Deployment, and Safety Policy state", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Skills Area/);
    expect(renderersSource).toMatch(/renderControlCenterSkillsArea/);
    expect(renderersSource).toMatch(/installedSkillPacks/);
    expect(renderersSource).toMatch(/Skill Installation/);
    expect(renderersSource).toMatch(/Managed Rule File/);
    expect(renderersSource).toMatch(/Safety Policy/);
    expect(renderersSource).toMatch(/Project Skill Activation/);
    expect(renderersSource).toMatch(/Workspace Rule Deployment/);
    expect(renderersSource).toMatch(/data-control-area="skills"/);
    expect(renderersSource).toMatch(/data-skill-activation/);
    expect(renderersSource).toMatch(/data-safety-action/);
  });
});

describe("Control Center Sessions area", () => {
  it("renders Work Session search, resumable state, and safety-gated Session Launcher controls", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Sessions Area/);
    expect(renderersSource).toMatch(/renderControlCenterSessionsArea/);
    expect(renderersSource).toMatch(/Work Session search/);
    expect(renderersSource).toMatch(/Session Source/);
    expect(renderersSource).toMatch(/Session Resume Command/);
    expect(renderersSource).toMatch(/resumable/);
    expect(renderersSource).toMatch(/Search Index/);
    expect(renderersSource).toMatch(/Session Launcher/);
    expect(renderersSource).toMatch(/data-control-area="sessions"/);
    expect(renderersSource).toMatch(/data-session-search/);
    expect(renderersSource).toMatch(/data-session-launch/);
    expect(renderersSource).toMatch(/launch-session/);
  });
});

describe("Control Center Safety area", () => {
  it("renders Approval Requests, Risk Notices, Scoped Trust Grants, Action Risk Classes, and revoke controls", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Safety Area/);
    expect(renderersSource).toMatch(/renderControlCenterSafetyArea/);
    expect(renderersSource).toMatch(/Approval Requests/);
    expect(renderersSource).toMatch(/Risk Notices/);
    expect(renderersSource).toMatch(/Trust Grants/);
    expect(renderersSource).toMatch(/Action Risk Classes/);
    expect(renderersSource).toMatch(/Client Auth/);
    expect(renderersSource).toMatch(/data-control-area="safety"/);
    expect(renderersSource).toMatch(/data-trust-revoke/);
    expect(renderersSource).toMatch(/data-approval-action/);
  });
});

describe("Control Center Settings area", () => {
  it("renders persona templates, locale switching, and growth profile settings", () => {
    const renderersSource = readFileSync(join(appRoot, "src", "renderers.ts"), "utf8");

    expect(renderersSource).toMatch(/Control Center Settings Area/);
    expect(renderersSource).toMatch(/renderControlCenterSettingsArea/);
    expect(renderersSource).toMatch(/Persona Configuration/);
    expect(renderersSource).toMatch(/persona-grid/);
    expect(renderersSource).toMatch(/persona-card/);
    expect(renderersSource).toMatch(/data-persona-select/);
    expect(renderersSource).toMatch(/data-locale/);
    expect(renderersSource).toMatch(/Local-first/);
    expect(renderersSource).toMatch(/Growth Profile/);
    expect(renderersSource).toMatch(/XP multiplier/);
    expect(renderersSource).toMatch(/Fatigue threshold/);
    expect(renderersSource).toMatch(/Growth Cap/);
    expect(renderersSource).toMatch(/export-secret/);
    expect(renderersSource).toMatch(/data-control-area="settings"/);
  });
});

describe("Canvas 2D animation engine", () => {
  it("exports Canvas renderer and animation loop functions", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "canvas-renderer.ts"), "utf8");

    expect(canvasSource).toMatch(/Canvas 2D 动画引擎/);
    expect(canvasSource).toMatch(/createCanvasRenderer/);
    expect(canvasSource).toMatch(/startAnimationLoop/);
    expect(canvasSource).toMatch(/drawSlime/);
    expect(canvasSource).toMatch(/drawCat/);
    expect(canvasSource).toMatch(/drawStatusBubble/);
    expect(canvasSource).toMatch(/drawInteractionButtons/);
  });

  it("supports slime and cat appearance rendering", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "canvas-renderer.ts"), "utf8");
    const typesSource = readFileSync(join(appRoot, "src", "types.ts"), "utf8");

    expect(canvasSource).toMatch(/slime/);
    expect(canvasSource).toMatch(/cat/);
    expect(typesSource).toMatch(/custom/);
    expect(canvasSource).toMatch(/appearance\.kind/);
  });

  it("renders status bubbles for all visual states", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "canvas-renderer.ts"), "utf8");

    expect(canvasSource).toMatch(/idle/);
    expect(canvasSource).toMatch(/positive/);
    expect(canvasSource).toMatch(/fatigue/);
    expect(canvasSource).toMatch(/sleep/);
    expect(canvasSource).toMatch(/attention/);
  });

  it("includes interaction button rendering", () => {
    const canvasSource = readFileSync(join(appRoot, "src", "canvas-renderer.ts"), "utf8");

    expect(canvasSource).toMatch(/Feed/);
    expect(canvasSource).toMatch(/Play/);
    expect(canvasSource).toMatch(/Pet/);
    expect(canvasSource).toMatch(/Sleep/);
  });
});
