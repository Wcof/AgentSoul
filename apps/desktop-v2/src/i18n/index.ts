// i18n 初始化 — 基于 i18next 的中英双语支持
// 系统 UI 文案走 i18n，人格对话走 persona config (ADR-0007)
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import zh from "./zh.json";

export const defaultLocale = "zh" as const;

export const resources = {
  en: { translation: en },
  zh: { translation: zh },
} as const;

export type Locale = keyof typeof resources;

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLocale,
  fallbackLng: "en",
  interpolation: {
    escapeValue: false,
  },
});

export default i18n;
