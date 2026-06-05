import {
  buildSystemPrompt,
  type MemoryEntry,
  type PromptLayers,
  type PromptPADState,
  type VitalsSnapshot,
} from "@agentsoul/companion/prompt";
import type { SoulDocument } from "@agentsoul/companion/soul";

export interface AgentMindPromptInput {
  soul: SoulDocument;
  pad: PromptPADState;
  vitals: VitalsSnapshot;
  memories?: MemoryEntry[];
  turnContext?: string;
  level?: number;
}

export function buildAgentMindPromptLayers(input: AgentMindPromptInput): PromptLayers {
  return buildSystemPrompt(
    input.soul,
    input.pad,
    input.vitals,
    input.memories ?? [],
    input.turnContext ?? "",
    input.level ?? 1,
  );
}

export type { MemoryEntry, PromptLayers, PromptPADState, VitalsSnapshot };
