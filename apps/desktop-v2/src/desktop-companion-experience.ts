import type { ChatCompanionContext } from "./chat-controller";
import type { CompanionInteractionKind, DesktopBodySnapshot, PetAppearanceSnapshot } from "./types";
import { buildSystemPrompt } from "@agentsoul/companion/prompt";
import type { PromptPADState } from "@agentsoul/companion/prompt";
import { getDefaultSoul } from "@agentsoul/companion/soul";
import { escapeHtml } from "./shared/utils";
import { projectAutonomyRuntime } from "./companion-autonomy-projection";
import { buildCompanionChatPayload } from "./companion-interaction-turn";

export interface DesktopCompanionPromptLayers {
  stable: string;
  context: string;
  volatile: string;
}

export interface DesktopCompanionExperience {
  displayName: string;
  appearance: PetAppearanceSnapshot;
  bubbleText: string;
  placeholder: string;
  quickActions: Array<{ kind: CompanionInteractionKind; label: string; title: string }>;
  chatContext: ChatCompanionContext;
  promptLayers: DesktopCompanionPromptLayers;
}

export function buildDesktopCompanionExperience(snapshot: DesktopBodySnapshot): DesktopCompanionExperience {
  const companion = snapshot.companion;
  const displayName = companion.petAppearance.displayName || companion.displayName;
  const projection = projectAutonomyRuntime({ snapshot });
  const chatContext = buildCompanionChatPayload(snapshot) as ChatCompanionContext;

  return {
    displayName,
    appearance: companion.petAppearance,
    bubbleText: projection.bubbleText,
    placeholder: "和我说点什么...",
    quickActions: [
      { kind: "feed", label: "喂食", title: "Feed" },
      { kind: "play", label: "玩耍", title: "Play" },
      { kind: "pet", label: "摸摸", title: "Pet" },
      { kind: "sleep", label: "睡觉", title: "Sleep" },
    ],
    chatContext,
    promptLayers: buildPromptLayers(snapshot, chatContext),
  };
}

export function renderDesktopCompanionInlineExperience(experience: DesktopCompanionExperience): string {
  return `
    <div class="pet-widget__bubble" role="status" aria-live="polite">
      ${escapeHtml(experience.bubbleText)}
    </div>
    <form class="pet-widget__composer" data-companion-inline-form>
      <input
        class="pet-widget__input"
        data-companion-inline-input
        type="text"
        autocomplete="off"
        placeholder="${escapeHtml(experience.placeholder)}"
        aria-label="Companion message"
      />
      <button type="submit" data-companion-inline-submit title="Send message">发送</button>
    </form>
    <div class="pet-widget__actions" aria-label="Companion quick actions">
      ${experience.quickActions.map((action) => `
        <button type="button" data-interaction="${action.kind}" title="${escapeHtml(action.title)}">
          ${escapeHtml(action.label)}
        </button>
      `).join("")}
    </div>
  `;
}

function buildPromptLayers(snapshot: DesktopBodySnapshot, context: ChatCompanionContext): DesktopCompanionPromptLayers {
  const companion = snapshot.companion;
  const soul = getDefaultSoul({
    id: companion.id,
    displayName: companion.displayName,
    soulId: companion.soulId,
    petAppearance: {
      kind: companion.petAppearance.kind,
      skin: companion.petAppearance.skin,
      outfit: companion.petAppearance.outfit,
      animationStyle: companion.petAppearance.animationStyle,
    },
    vitals: {
      level: companion.vitals.level,
      xp: companion.vitals.xp,
      companionEnergy: companion.vitals.companionEnergy as never,
      hunger: companion.vitals.hunger,
      intimacy: companion.vitals.intimacy as never,
    },
    mood: companion.mood as never,
  }, context.companionName);
  const layers = buildSystemPrompt(
    soul,
    experiencePadFromMood(companion.mood),
    {
      energy: companion.vitals.companionEnergy,
      hunger: companion.vitals.hunger,
      intimacy: companion.vitals.intimacy,
    },
    [
      { text: "memory: recent desktop interaction, visible bubble state, and Master Model preferences shape the reply." },
    ],
    snapshot.companion.summary || "session: desktop companion inline interaction",
    companion.vitals.level,
  );
  return {
    stable: ["Soul Document", layers.stable].join("\n"),
    context: ["PAD Runtime Context", buildAutonomyContext(snapshot), layers.context].join("\n"),
    volatile: ["session memory", layers.volatile || "会话上下文：desktop companion inline interaction"].join("\n"),
  };
}

function experiencePadFromMood(mood: string): PromptPADState {
  if (mood === "positive") return { pleasure: 0.35, arousal: 0.2, dominance: 0.05 };
  if (mood === "negative") return { pleasure: -0.35, arousal: 0.15, dominance: -0.2 };
  if (mood === "fatigued") return { pleasure: -0.15, arousal: -0.35, dominance: -0.15 };
  if (mood === "sleeping") return { pleasure: 0.05, arousal: -0.6, dominance: -0.25 };
  return { pleasure: 0, arousal: 0, dominance: 0 };
}

function buildAutonomyContext(snapshot: DesktopBodySnapshot): string {
  const { autonomy } = projectAutonomyRuntime({ snapshot });
  return [
    `Companion Mode=${autonomy.companionMode}`,
    `User Presence=${autonomy.userPresence}`,
    `Output Strategy=${autonomy.lastOutputStrategy ?? "express"}`,
  ].join("; ");
}
