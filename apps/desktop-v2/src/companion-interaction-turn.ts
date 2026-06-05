import type { ChatMessage, DesktopBodySnapshot } from "./types";
import { sendMessage, type SendMessageResult } from "./chat-controller";

export async function runCompanionInteractionTurn<TSnapshot extends DesktopBodySnapshot>(input: {
  message: string;
  snapshot: TSnapshot;
  history?: ChatMessage[];
}): Promise<{
  reply: SendMessageResult;
  bubbleText: string;
  nextSnapshot: TSnapshot;
  status: string;
}> {
  const reply = await sendMessage(input.message, input.history ?? [], buildCompanionChatPayload(input.snapshot));
  const failed = isFailureReply(reply);
  const nextSnapshot: TSnapshot = {
    ...input.snapshot,
    companion: {
      ...input.snapshot.companion,
      summary: reply.content,
      mood: failed ? "negative" : input.snapshot.companion.mood,
      activityState: failed ? "attention" : "happy",
      autonomy: {
        userPresence: "ACTIVE",
        companionMode: "CONVERSING",
        lastEventPriority: "MEDIUM",
        lastOutputStrategy: "express",
        queuedOutputCount: input.snapshot.companion.autonomy?.queuedOutputCount ?? 0,
        lastAction: "desktop-inline-chat",
      },
    },
  };
  return {
    reply,
    bubbleText: reply.content,
    nextSnapshot,
    status: reply.content,
  };
}

export function buildCompanionChatPayload(snapshot: DesktopBodySnapshot) {
  const companion = snapshot.companion;
  const displayName = companion.petAppearance.displayName || companion.displayName;
  const masterModel = companion.masterModel;
  return {
    companionId: companion.id,
    companionName: displayName,
    companionContext: {
      pad: turnPadFromMood(companion.mood),
      vitals: {
        energy: turnNumberOr(companion.vitals.companionEnergy, 100),
        hunger: turnNumberOr(companion.vitals.hunger, 100),
        intimacy: turnNumberOr(companion.vitals.intimacy, 0),
      },
      level: Math.max(1, Math.floor(turnNumberOr(companion.vitals.level, 1))),
      memories: [
        ...(companion.summary && companion.summary !== "Local runtime pending" ? [{ text: companion.summary }] : []),
        ...(masterModel?.preferences.interests.length ? [{ text: `Master 兴趣：${masterModel.preferences.interests.join("、")}` }] : []),
        ...(masterModel?.preferences.hobbies?.length ? [{ text: `Master 爱好：${masterModel.preferences.hobbies.join("、")}` }] : []),
        ...(companion.autonomy?.lastAction ? [{ text: `last action: ${companion.autonomy.lastAction}` }] : []),
      ],
      sessionContext: [
        companion.summary,
        companion.autonomy?.lastAction ? `last action: ${companion.autonomy.lastAction}` : undefined,
        companion.autonomy?.lastOutputStrategy ? `output strategy: ${companion.autonomy.lastOutputStrategy}` : undefined,
      ].filter(Boolean).join("; "),
      masterModel: masterModel ?? {
        basic: {
          name: "主人",
          preferredLanguage: "zh-CN",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        preferences: {
          interests: ["AgentSoul", "桌面伴侣", "可交互宠物模式"],
          hobbies: [],
          communicationStyle: "直接、温柔、短句提示",
        },
        behaviorPatterns: {
          responsePreference: "优先给出可执行建议，必要时用气泡提醒",
        },
      },
    },
  };
}

function isFailureReply(reply: SendMessageResult): boolean {
  return reply.content.includes("错误") || reply.content.includes("失败");
}

function turnPadFromMood(mood: string | undefined): { pleasure: number; arousal: number; dominance: number } {
  if (mood === "positive") return { pleasure: 0.35, arousal: 0.2, dominance: 0.05 };
  if (mood === "negative") return { pleasure: -0.35, arousal: 0.15, dominance: -0.2 };
  if (mood === "fatigued") return { pleasure: -0.15, arousal: -0.35, dominance: -0.15 };
  if (mood === "sleeping") return { pleasure: 0.05, arousal: -0.6, dominance: -0.25 };
  return { pleasure: 0, arousal: 0, dominance: 0 };
}

function turnNumberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
