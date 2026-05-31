export interface ConversationMessage {
  role: string;
  content: string;
}

export interface ContextCompressionOptions {
  maxCharacters: number;
  preserveRecentMessages?: number;
}

export function compressConversationHistory(
  history: ConversationMessage[],
  options?: ContextCompressionOptions,
): ConversationMessage[] {
  if (!options || characterCount(history) <= options.maxCharacters) {
    return [...history];
  }

  const preserveRecentMessages = Math.max(0, options.preserveRecentMessages ?? 4);
  const splitAt = Math.max(0, history.length - preserveRecentMessages);
  const discarded = history.slice(0, splitAt);
  const recent = history.slice(splitAt);
  const summary = discarded
    .map((message) => `${message.role}: ${message.content}`)
    .join("\n");

  return [
    {
      role: "system",
      content: `## 已压缩的早期上下文\n${truncate(summary, options.maxCharacters)}`,
    },
    ...recent,
  ];
}

function characterCount(messages: ConversationMessage[]): number {
  return messages.reduce((total, message) => total + message.content.length, 0);
}

function truncate(value: string, maxCharacters: number): string {
  if (value.length <= maxCharacters) return value;
  return `${value.slice(0, Math.max(0, maxCharacters - 3))}...`;
}
