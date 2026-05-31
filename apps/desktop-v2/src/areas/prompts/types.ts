/**
 * Prompts Area — ViewModel types
 * Derived from CompanionRuntimeSnapshot types for type-safe UI rendering.
 */

import type { PromptTemplateViewModel } from "../../types";

// ─── Prompt Template Management ViewModel ───

export interface PromptsAreaViewModel {
  prompts: PromptTemplateViewModel[];
}
