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
  companionContext?: Record<string, unknown>;
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
        ...(companionContext ?? {}),
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
