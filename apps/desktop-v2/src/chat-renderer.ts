import type { ChatMessage } from "./types.js";
import { escapeHtml } from "./shared/utils.js";

// ─── Chat Window Renderer ───

export interface ChatWindowOptions {
  messages: ChatMessage[];
  loading: boolean;
}

function renderMessage(msg: ChatMessage): string {
  const roleClass = msg.role === "user" ? "chat-msg-user" : "chat-msg-assistant";
  const emotionAttr = msg.emotion ? ` data-emotion="${escapeHtml(msg.emotion)}"` : "";

  return `
    <div class="chat-message ${roleClass}"${emotionAttr}>
      <div class="chat-msg-content">${escapeHtml(msg.content)}</div>
    </div>
  `;
}

export function renderChatWindow(options: ChatWindowOptions): string {
  const { messages, loading } = options;

  if (loading) {
    return `
      <div class="chat-container">
        <div class="chat-loading">思考中...</div>
      </div>
    `;
  }

  if (messages.length === 0) {
    return `
      <div class="chat-container">
        <div class="chat-empty">双击伴侣开始对话</div>
      </div>
    `;
  }

  return `
    <div class="chat-container">
      <div class="chat-messages">
        ${messages.map(renderMessage).join("\n")}
      </div>
    </div>
  `;
}
