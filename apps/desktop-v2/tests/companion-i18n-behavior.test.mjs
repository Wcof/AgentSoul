import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { buildSnapshot } from "./helpers/snapshot.js";
import { loadPureFunctions } from "./helpers/module-loader.js";

const fns = await loadPureFunctions();

function createMockTarget() {
  return { innerHTML: "" };
}

describe("Desktop Companion i18n behavior", () => {
  let originalI18nInstance;

  beforeEach(() => {
    originalI18nInstance = globalThis.i18nInstance;
  });

  afterEach(() => {
    globalThis.i18nInstance = originalI18nInstance;
  });

  it("translates UI headers to Chinese when locale is zh", () => {
    // 1. Setup mock i18n instance representing 'zh' locale
    globalThis.i18nInstance = {
      t: (key) => {
        const translations = {
          "nav.companion": "伙伴",
          "nav.gateway": "网关",
          "nav.skills": "技能",
          "nav.sessions": "会话",
          "nav.costs": "成本",
          "nav.safety": "安全",
          "nav.settings": "设置",
          "companion.title": "伙伴区域",
          "companion.vitals": "生命体征"
        };
        return translations[key] || key;
      }
    };

    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    // Verify navigation links are translated to Chinese
    expect(target.innerHTML).toMatch(/伙伴/);
    expect(target.innerHTML).toMatch(/网关/);
    expect(target.innerHTML).toMatch(/技能/);
    expect(target.innerHTML).toMatch(/伙伴区域/);
    
    // Hardcoded fallback should not be visible if key is translated
    expect(target.innerHTML).not.toMatch(/>Companion<\/a>/);
    expect(target.innerHTML).not.toMatch(/>Gateway<\/a>/);
  });

  it("reacts dynamically when i18nInstance language toggles", () => {
    let currentLanguage = "zh";
    globalThis.i18nInstance = {
      t: (key) => {
        if (currentLanguage === "zh") {
          const translations = {
            "nav.companion": "伙伴",
          };
          return translations[key] || key;
        } else {
          const translations = {
            "nav.companion": "Companion",
          };
          return translations[key] || key;
        }
      }
    };

    const target = createMockTarget();
    const snapshot = buildSnapshot();
    
    // First render in zh
    fns.renderAgentSoulShell(target, snapshot);
    expect(target.innerHTML).toMatch(/伙伴/);
    expect(target.innerHTML).not.toMatch(/>Companion<\/a>/);

    // Switch language to en and re-render
    currentLanguage = "en";
    fns.renderAgentSoulShell(target, snapshot);
    expect(target.innerHTML).toMatch(/>Companion<\/a>/);
    expect(target.innerHTML).not.toMatch(/伙伴/);
  });

  it("falls back to English when translations are missing or i18n is not configured", () => {
    globalThis.i18nInstance = undefined;

    const target = createMockTarget();
    const snapshot = buildSnapshot();
    fns.renderAgentSoulShell(target, snapshot);

    expect(target.innerHTML).toMatch(/>Companion<\/a>/);
    expect(target.innerHTML).toMatch(/>Gateway<\/a>/);
  });
});
