// Config Management 测试
import { describe, it, expect } from "vitest";
import {
  createConfigManager,
  getTemplate,
  validatePersonaSeed,
  PERSONA_TEMPLATES,
} from "@agentsoul/runtime";

describe("Config Management — 模板加载", () => {
  it("4 种预设模板存在", () => {
    expect(PERSONA_TEMPLATES.length).toBe(4);
    expect(getTemplate("friendly")).toBeTruthy();
    expect(getTemplate("professional")).toBeTruthy();
    expect(getTemplate("creative")).toBeTruthy();
    expect(getTemplate("minimal")).toBeTruthy();
  });

  it("模板包含双语描述", () => {
    const friendly = getTemplate("friendly")!;
    expect(friendly.seed.descriptionZh).toBeTruthy();
    expect(friendly.seed.descriptionEn).toBeTruthy();
  });

  it("未知模板返回 undefined", () => {
    expect(getTemplate("unknown")).toBeUndefined();
  });
});

describe("Config Management — 配置验证", () => {
  it("空名称报错", () => {
    const errors = validatePersonaSeed({ name: "", role: "test" });
    expect(errors).toContain("name is required");
  });

  it("空角色报错", () => {
    const errors = validatePersonaSeed({ name: "Test", role: "" });
    expect(errors).toContain("role is required");
  });

  it("valid config passes", () => {
    const errors = validatePersonaSeed({ name: "Test", role: "companion" });
    expect(errors.length).toBe(0);
  });
});

describe("Config Management — 配置管理器", () => {
  it("默认 locale 为 zh", () => {
    const mgr = createConfigManager();
    expect(mgr.getLocale()).toBe("zh");
  });

  it("切换 locale 通知监听器", () => {
    const mgr = createConfigManager();
    let notified = "";
    mgr.onConfigChange((loc) => { notified = loc; });
    mgr.setLocale("en");
    expect(notified).toBe("en");
    expect(mgr.getLocale()).toBe("en");
  });

  it("应用模板设置 persona", () => {
    const mgr = createConfigManager();
    const seed = mgr.applyTemplate("friendly");
    expect(seed.name).toBe("Buddy");
    expect(seed.descriptionZh).toBeTruthy();
  });

  it("更新 persona 验证通过", () => {
    const mgr = createConfigManager();
    mgr.applyTemplate("friendly");
    const updated = mgr.updatePersonaSeed({ name: "小助手" });
    expect(updated.name).toBe("小助手");
  });

  it("更新 persona 验证失败抛错", () => {
    const mgr = createConfigManager();
    expect(() => mgr.updatePersonaSeed({ name: "" })).toThrow();
  });

  it("取消监听", () => {
    const mgr = createConfigManager();
    let count = 0;
    const unsub = mgr.onConfigChange(() => { count++; });
    mgr.setLocale("en");
    unsub();
    mgr.setLocale("zh");
    expect(count).toBe(1);
  });
});
