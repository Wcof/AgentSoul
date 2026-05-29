import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const appRoot = new URL("..", import.meta.url).pathname;

describe("Desktop Companion appearance view", () => {
  it("renders Pet Appearance and basic Companion states from runtime snapshots", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Companion appearance view model/);
    assert.match(source, /renderCompanionViewModel/);
    assert.match(source, /idle/);
    assert.match(source, /positive/);
    assert.match(source, /fatigue/);
    assert.match(source, /sleep/);
    assert.match(source, /attention/);
  });

  it("keeps rendering terms aligned with the AgentSoul Companion glossary", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Pet Appearance/);
    assert.match(source, /Companion/);
    assert.doesNotMatch(source, /separate character|active pet/i);
  });
});

describe("Desktop Companion interaction command flow", () => {
  it("exposes Feed, Play, Pet, and Sleep controls wired to Growth results", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /createDesktopCompanionController/);
    assert.match(source, /Feed/);
    assert.match(source, /Play/);
    assert.match(source, /Pet/);
    assert.match(source, /Sleep/);
    assert.match(source, /blocked-low-energy/);
    assert.match(source, /performInteraction/);
  });
});

describe("Desktop Companion approval flow", () => {
  it("displays pending Approval Required state and exposes Allow/Deny decisions", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Approval Required/);
    assert.match(source, /pendingApproval/);
    assert.match(source, /data-approval-decision="allowed"/);
    assert.match(source, /data-approval-decision="denied"/);
    assert.match(source, /decideApproval/);
  });
});

describe("Desktop Companion risk notice flow", () => {
  it("displays Risk Notice state separately from Approval Required", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Risk Notice/);
    assert.match(source, /riskNotices/);
    assert.match(source, /renderRiskNotices/);
    assert.match(source, /Client Authorization Mode/);
    assert.doesNotMatch(source, /data-risk-notice-decision/);
  });
});

describe("Control Center Companion area", () => {
  it("renders Companion state, Vitals, Mood, Pet Appearance, interactions, and Growth Events", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Companion Area/);
    assert.match(source, /renderControlCenterCompanionArea/);
    assert.match(source, /Growth Events/);
    assert.match(source, /growthHistory/);
    assert.match(source, /Mood/);
    assert.match(source, /Level/);
    assert.match(source, /XP/);
    assert.match(source, /Pet Appearance/);
    assert.match(source, /data-control-area="companion"/);
    assert.match(source, /data-interaction="feed"/);
    assert.match(source, /data-interaction="play"/);
    assert.match(source, /data-interaction="pet"/);
    assert.match(source, /data-interaction="sleep"/);
  });
});

describe("Control Center task navigation", () => {
  it("renders seven task navigation targets and local-first shell copy", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center task navigation/);
    assert.match(source, /cloud login not required/i);
    for (const area of ["companion", "gateway", "skills", "sessions", "costs", "safety", "settings"]) {
      assert.match(source, new RegExp(`data-nav-target="${area}"`));
      assert.match(source, new RegExp(`data-control-area="${area}"`));
    }
  });
});

describe("Control Center Gateway and Costs areas", () => {
  it("renders Gateway Route health, active provider, adapter support, fallback status, and cost summaries", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Gateway Area/);
    assert.match(source, /Control Center Costs Area/);
    assert.match(source, /renderControlCenterGatewayArea/);
    assert.match(source, /renderControlCenterCostsArea/);
    assert.match(source, /Active Provider Profile/);
    assert.match(source, /Gateway Route Health/);
    assert.match(source, /Provider Adapter Support/);
    assert.match(source, /Direct Client Config fallback/);
    assert.match(source, /Estimated Cost/);
    assert.match(source, /Provider Usage/);
    assert.match(source, /Token Usage/);
    assert.match(source, /Latency/);
    assert.match(source, /Model Mix/);
    assert.match(source, /Provider Mix/);
    assert.match(source, /data-control-area="gateway"/);
    assert.match(source, /data-control-area="costs"/);
  });
});

describe("Control Center Skills area", () => {
  it("renders Skill Installation, Project Skill Activation, Workspace Rule Deployment, and Safety Policy state", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Skills Area/);
    assert.match(source, /renderControlCenterSkillsArea/);
    assert.match(source, /Skill Installation/);
    assert.match(source, /Project Skill Activation/);
    assert.match(source, /Workspace Rule Deployment/);
    assert.match(source, /Managed Rule File/);
    assert.match(source, /deploy-workspace-rules/);
    assert.match(source, /Safety Policy/);
    assert.match(source, /data-control-area="skills"/);
    assert.match(source, /data-skill-activation/);
  });
});

describe("Control Center Sessions area", () => {
  it("renders Work Session search, resumable state, and safety-gated Session Launcher controls", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Sessions Area/);
    assert.match(source, /renderControlCenterSessionsArea/);
    assert.match(source, /Work Session search/);
    assert.match(source, /Session Source/);
    assert.match(source, /Search Index/);
    assert.match(source, /Session Resume Command/);
    assert.match(source, /Session Launcher/);
    assert.match(source, /safety-gated/);
    assert.match(source, /data-control-area="sessions"/);
    assert.match(source, /data-session-search/);
    assert.match(source, /data-session-launch/);
    assert.match(source, /launch-session/);
  });
});

describe("Control Center Safety area", () => {
  it("renders Approval Requests, Risk Notices, Scoped Trust Grants, Action Risk Classes, Client Authorization Mode, and revoke controls", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Safety Area/);
    assert.match(source, /renderControlCenterSafetyArea/);
    assert.match(source, /Approval Requests/);
    assert.match(source, /Approval Required/);
    assert.match(source, /Risk Notices/);
    assert.match(source, /Scoped Trust Grants/);
    assert.match(source, /Action Risk Classes/);
    assert.match(source, /Client Authorization Mode/);
    assert.match(source, /data-control-area="safety"/);
    assert.match(source, /data-trust-revoke/);
    assert.match(source, /revokedAt/);
  });
});

describe("Control Center Settings area", () => {
  it("renders Local-first, export, cloud login, and remote sync settings", () => {
    const source = readFileSync(join(appRoot, "src", "main.ts"), "utf8");

    assert.match(source, /Control Center Settings Area/);
    assert.match(source, /renderControlCenterSettingsArea/);
    assert.match(source, /Local-first/);
    assert.match(source, /cloud login not required/i);
    assert.match(source, /User-managed Export/);
    assert.match(source, /Sensitive Export/);
    assert.match(source, /Remote Sync/);
    assert.match(source, /Growth Profile/);
    assert.match(source, /XP multiplier/);
    assert.match(source, /Fatigue threshold/);
    assert.match(source, /Growth Cap/);
    assert.match(source, /export-secret/);
    assert.match(source, /data-control-area="settings"/);
  });
});
