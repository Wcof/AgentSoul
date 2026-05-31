import type { ChatMessage } from "./types.js";
import { renderChatWindow } from "./chat-renderer.js";

// ─── Chat Controller: sendMessage ───

const COMPANION_CHAT_ENDPOINT = "/companion/chat";

export interface SendMessageResult {
  role: "assistant";
  content: string;
  emotion?: string;
}

export interface ChatCompanionContext {
  companionId: string;
  companionName: string;
  mood?: string;
  vitals?: {
    level?: number;
    companionEnergy?: number;
    hunger?: number;
    intimacy?: number;
  };
  summary?: string;
  masterCognition?: {
    masterName?: string;
    interests?: string[];
    hobbies?: string[];
    communicationStyle?: string;
    responsePreference?: string;
  };
}

export async function sendMessage(
  content: string,
  history: ChatMessage[],
  companionContext?: ChatCompanionContext,
): Promise<SendMessageResult> {
  const messages = [
    ...history.map((m) => ({ role: m.role, content: m.content })),
    { role: "user", content },
  ];

  try {
    const response = await fetch(COMPANION_CHAT_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        message: content,
        history: messages.slice(0, -1),
        ...buildDirectChatCompanionPayload(companionContext),
      }),
    });

    if (!response.ok) {
      return {
        role: "assistant",
        content: `请求失败：${response.status} 错误`,
      };
    }

    const body = await response.json();
    const reply = body.choices?.[0]?.message?.content ?? "无回复";

    return {
      role: "assistant",
      content: reply,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "未知错误";
    return {
      role: "assistant",
      content: `连接错误：${message}`,
    };
  }
}

function buildDirectChatCompanionPayload(context?: ChatCompanionContext): Record<string, unknown> {
  if (!context) return {};

  const vitals = context.vitals ?? {};
  const master = context.masterCognition ?? {};
  return {
    companionId: context.companionId,
    companionName: context.companionName,
    companionContext: {
      pad: padFromMood(context.mood),
      vitals: {
        energy: numberOr(vitals.companionEnergy, 100),
        hunger: numberOr(vitals.hunger, 100),
        intimacy: numberOr(vitals.intimacy, 0),
      },
      level: Math.max(1, Math.floor(numberOr(vitals.level, 1))),
      memories: [
        ...(context.summary ? [{ text: context.summary }] : []),
        ...(master.interests?.length ? [{ text: `Master 兴趣：${master.interests.join("、")}` }] : []),
        ...(master.hobbies?.length ? [{ text: `Master 爱好：${master.hobbies.join("、")}` }] : []),
      ],
      sessionContext: context.summary ?? "",
      masterModel: {
        basic: {
          name: master.masterName ?? "主人",
          preferredLanguage: "zh-CN",
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
        preferences: {
          interests: master.interests ?? [],
          hobbies: master.hobbies ?? [],
          communicationStyle: master.communicationStyle ?? "待观察",
        },
        behaviorPatterns: {
          responsePreference: master.responsePreference ?? "待观察",
        },
      },
    },
  };
}

function padFromMood(mood: string | undefined): { pleasure: number; arousal: number; dominance: number } {
  if (mood === "positive") return { pleasure: 0.35, arousal: 0.2, dominance: 0.05 };
  if (mood === "negative") return { pleasure: -0.35, arousal: 0.15, dominance: -0.2 };
  if (mood === "fatigued") return { pleasure: -0.15, arousal: -0.35, dominance: -0.15 };
  if (mood === "sleeping") return { pleasure: 0.05, arousal: -0.6, dominance: -0.25 };
  return { pleasure: 0, arousal: 0, dominance: 0 };
}

function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

// ─── Toggle Chat Window ───

export interface ChatContainer {
  querySelector(sel: string): { remove(): void } | null;
  appendChild(node: any): void;
}

export function toggleChatWindow(container: ChatContainer): void {
  const existing = container.querySelector(".chat-container");
  if (existing) {
    existing.remove();
    return;
  }

  const html = renderChatWindow({ messages: [], loading: false });
  container.appendChild({ innerHTML: html, firstElementChild: null });
}

// ─── Submit Message ───

export async function submitMessage(
  container: HTMLElement,
  history: ChatMessage[],
  companionContext?: ChatCompanionContext,
): Promise<void> {
  const input = container.querySelector(".chat-input") as HTMLInputElement | null;
  if (!input) return;

  const content = input.value.trim();
  if (!content) return;

  input.value = "";

  const reply = await sendMessage(content, history, companionContext);
  // In a full implementation, this would update the message list in the UI
  void reply;
}
