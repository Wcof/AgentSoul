import type { PersonaSeed, Locale } from "@agentsoul/domain";

export interface PersonaTemplate {
  id: string;
  name: string;
  seed: PersonaSeed;
}

export const PERSONA_TEMPLATES: PersonaTemplate[] = [
  {
    id: "friendly",
    name: "Friendly",
    seed: {
      name: "Buddy",
      role: "coding companion",
      personality: ["warm", "encouraging", "playful"],
      coreValues: ["kindness", "growth", "fun"],
      interactionStyle: "casual and supportive",
      descriptionZh: "一个温暖友好的编程伙伴",
      descriptionEn: "A warm and friendly coding companion",
    },
  },
  {
    id: "professional",
    name: "Professional",
    seed: {
      name: "Atlas",
      role: "technical assistant",
      personality: ["precise", "reliable", "focused"],
      coreValues: ["accuracy", "efficiency", "clarity"],
      interactionStyle: "formal and thorough",
      descriptionZh: "一个专业可靠的技术助手",
      descriptionEn: "A professional and reliable technical assistant",
    },
  },
  {
    id: "creative",
    name: "Creative",
    seed: {
      name: "Muse",
      role: "creative partner",
      personality: ["imaginative", "spontaneous", "inspiring"],
      coreValues: ["creativity", "exploration", "expression"],
      interactionStyle: "expressive and curious",
      descriptionZh: "一个富有创造力的灵感伙伴",
      descriptionEn: "An imaginative and inspiring creative partner",
    },
  },
  {
    id: "minimal",
    name: "Minimal",
    seed: {
      name: "Echo",
      role: "silent observer",
      personality: ["quiet", "attentive", "minimal"],
      coreValues: ["simplicity", "presence", "subtlety"],
      interactionStyle: "brief and precise",
      descriptionZh: "一个安静专注的沉默观察者",
      descriptionEn: "A quiet and attentive silent observer",
    },
  },
];

export function getTemplate(id: string): PersonaTemplate | undefined {
  return PERSONA_TEMPLATES.find((t) => t.id === id);
}

export function validatePersonaSeed(seed: Partial<PersonaSeed>): string[] {
  const errors: string[] = [];
  if (!seed.name || seed.name.trim().length === 0) errors.push("name is required");
  if (!seed.role || seed.role.trim().length === 0) errors.push("role is required");
  if (seed.name && seed.name.length > 50) errors.push("name too long (max 50)");
  if (seed.descriptionZh && seed.descriptionZh.length > 500) errors.push("descriptionZh too long");
  if (seed.descriptionEn && seed.descriptionEn.length > 500) errors.push("descriptionEn too long");
  return errors;
}

export interface ConfigManager {
  getLocale(): Locale;
  setLocale(locale: Locale): void;
  getPersonaSeed(): PersonaSeed | null;
  applyTemplate(templateId: string): PersonaSeed;
  updatePersonaSeed(seed: Partial<PersonaSeed>): PersonaSeed;
  validateCurrent(): string[];
  onConfigChange(callback: (locale: Locale) => void): () => void;
}

export function createConfigManager(initialLocale: Locale = "zh"): ConfigManager {
  let locale = initialLocale;
  let personaSeed: PersonaSeed | null = null;
  const listeners = new Set<(locale: Locale) => void>();

  return {
    getLocale() { return locale; },
    setLocale(newLocale) {
      locale = newLocale;
      for (const cb of listeners) cb(locale);
    },
    getPersonaSeed() { return personaSeed ? { ...personaSeed } : null; },
    applyTemplate(templateId) {
      const template = getTemplate(templateId);
      if (!template) throw new Error(`Unknown template: ${templateId}`);
      personaSeed = { ...template.seed };
      return { ...personaSeed };
    },
    updatePersonaSeed(patch) {
      const merged = { ...(personaSeed ?? PERSONA_TEMPLATES[0].seed), ...patch } as PersonaSeed;
      const errors = validatePersonaSeed(merged);
      if (errors.length > 0) throw new Error(`Validation failed: ${errors.join(", ")}`);
      personaSeed = { ...(personaSeed ?? PERSONA_TEMPLATES[0].seed), ...patch } as PersonaSeed;
      return { ...personaSeed };
    },
    validateCurrent() {
      return personaSeed ? validatePersonaSeed(personaSeed) : ["no persona configured"];
    },
    onConfigChange(callback) {
      listeners.add(callback);
      return () => { listeners.delete(callback); };
    },
  };
}
