import type { CompanionInteractionKind, DesktopBodySnapshot } from "../types";
import { runCompanionInteractionTurn } from "../agent-mind/interaction-turn";

export function applyDesktopBodyInteraction<TSnapshot extends DesktopBodySnapshot>(
  snapshot: TSnapshot,
  kind: CompanionInteractionKind,
): { state: TSnapshot; status: string } {
  if (kind === "play" && snapshot.companion.vitals.companionEnergy < 20) {
    return { state: snapshot, status: "Play blocked: Companion Energy is too low." };
  }

  const nextVitals = { ...snapshot.companion.vitals };
  if (kind === "feed") nextVitals.hunger = Math.min(100, nextVitals.hunger + 10);
  if (kind === "play") nextVitals.companionEnergy = Math.max(0, nextVitals.companionEnergy - 10);
  if (kind === "pet") nextVitals.intimacy = Math.min(100, nextVitals.intimacy + 5);

  return {
    state: {
      ...snapshot,
      companion: {
        ...snapshot.companion,
        vitals: nextVitals,
        mood: kind === "sleep" ? "sleeping" : "positive",
        activityState: kind === "sleep" ? "sleep" : "happy",
        lastUpdatedAt: new Date().toISOString(),
      },
    },
    status: `${kind} applied.`,
  };
}

export function submitDesktopBodyInlineChat<TSnapshot extends DesktopBodySnapshot>(input: {
  snapshot: TSnapshot;
  message: string;
}) {
  return runCompanionInteractionTurn({
    message: input.message,
    snapshot: input.snapshot,
  });
}
