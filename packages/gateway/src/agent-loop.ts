/**
 * AgentLoop — The companion's core execution loop.
 * Handles single-turn and multi-turn conversations with tool call support.
 */
import { buildSystemPrompt } from "@agentsoul/companion";
import type { MemoryEntry, PromptPADState, SoulDocument, VitalsSnapshot } from "@agentsoul/companion";
import { compressConversationHistory, type ContextCompressionOptions } from "./context-compression";

export interface DirectCaller {
  call(input: {
    messages: Array<{ role: string; content: string }>;
  }): Promise<{
    content: string;
    usage?: { inputTokens: number; outputTokens: number };
    toolCalls?: Array<{ name: string; arguments: Record<string, unknown> }>;
  }>;
}

export interface SessionRepository {
  save(data: { messages: Array<{ role: string; content: string }> }): void;
}

export interface CompanionGrowth {
  applyGatewayTrafficGrowth(input: { inputTokens: number; outputTokens: number }): void;
}

export interface AgentLoopOptions {
  directCaller: DirectCaller;
  maxIterations?: number;
  sessionRepository?: SessionRepository;
  companionGrowth?: CompanionGrowth;
  sessionId?: string;
  compression?: ContextCompressionOptions;
  memoryProvider?: AgentLoopMemoryProvider;
  skillProvider?: AgentLoopSkillProvider;
  updateMasterModel?: (input: Record<string, unknown>) => unknown;
  companionContext?: {
    soul: SoulDocument;
    pad: PromptPADState;
    vitals: VitalsSnapshot;
    memories?: MemoryEntry[];
    sessionContext?: string;
    level?: number;
  };
}

export interface AgentLoopMemoryProvider {
  prefetch(query: string, options: { sessionId?: string }): MemoryEntry[];
  recall(query: string, options: { sessionId?: string }): MemoryEntry[];
  syncTurn(userContent: string, assistantContent: string, options: {
    sessionId?: string;
    messages: Array<{ role: string; content: string }>;
  }): void;
}

export interface AgentLoopSkillProvider {
  getPromptBlock(): string;
}

export interface AgentLoopResult {
  reply: string;
  iterations: number;
  toolCalls: Array<{ name: string; arguments: Record<string, unknown>; result: string }>;
  tokenUsage: { input: number; output: number; total: number };
}

export async function runConversation(
  userMessage: string,
  history: Array<{ role: string; content: string }>,
  options: AgentLoopOptions,
): Promise<AgentLoopResult> {
  const maxIterations = options.maxIterations ?? 5;
  const prefetchedMemories = options.memoryProvider?.prefetch(userMessage, { sessionId: options.sessionId }) ?? [];
  const messages = [
    ...buildSystemMessages(options),
    ...buildProviderContextMessages(prefetchedMemories, options.skillProvider?.getPromptBlock()),
    ...compressConversationHistory(history, options.compression),
    { role: "user", content: userMessage },
  ];

  const toolCalls: AgentLoopResult["toolCalls"] = [];
  let iterations = 0;
  let totalInput = 0;
  let totalOutput = 0;

  while (iterations < maxIterations) {
    iterations++;
    const response = await options.directCaller.call({ messages: [...messages] });

    totalInput += response.usage?.inputTokens ?? 0;
    totalOutput += response.usage?.outputTokens ?? 0;

    // If no tool calls, we're done
    if (!response.toolCalls || response.toolCalls.length === 0) {
      // Add assistant reply to history before persisting
      messages.push({ role: "assistant", content: response.content });

      const result: AgentLoopResult = {
        reply: response.content,
        iterations,
        toolCalls,
        tokenUsage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
      };

      // Persist and notify growth
      finalizeConversation(messages, result, options);
      return result;
    }

    for (const tc of response.toolCalls) {
      toolCalls.push({
        name: tc.name,
        arguments: tc.arguments,
        result: executeToolCall(tc, options),
      });
    }

    // Add tool results to history for next iteration
    messages.push({ role: "assistant", content: response.content });
    for (const tc of toolCalls.slice(-response.toolCalls.length)) {
      messages.push({ role: "tool", content: tc.result });
    }
  }

  // Reached max iterations
  const result: AgentLoopResult = {
    reply: "已达到最大思考轮次，让我整理一下回答你。",
    iterations,
    toolCalls,
    tokenUsage: { input: totalInput, output: totalOutput, total: totalInput + totalOutput },
  };

  finalizeConversation(messages, result, options);
  return result;
}

function buildSystemMessages(options: AgentLoopOptions): Array<{ role: string; content: string }> {
  const context = options.companionContext;
  if (!context) return [];

  const layers = buildSystemPrompt(
    context.soul,
    context.pad,
    context.vitals,
    context.memories ?? [],
    context.sessionContext ?? "",
    context.level ?? 1,
  );

  return [{
    role: "system",
    content: [
      "# Stable Soul",
      layers.stable,
      "# Runtime Context",
      layers.context,
      "# Volatile Memory",
      layers.volatile || "无额外易失记忆。",
    ].join("\n"),
  }];
}

function finalizeConversation(
  messages: Array<{ role: string; content: string }>,
  result: AgentLoopResult,
  options: AgentLoopOptions,
): void {
  // Persist conversation history
  options.sessionRepository?.save({ messages });
  options.memoryProvider?.syncTurn(
    latestUserContent(messages),
    result.reply,
    { sessionId: options.sessionId, messages },
  );

  // Convert token usage to companion growth
  if (options.companionGrowth && result.tokenUsage.total > 0) {
    options.companionGrowth.applyGatewayTrafficGrowth({
      inputTokens: result.tokenUsage.input,
      outputTokens: result.tokenUsage.output,
    });
  }
}

function latestUserContent(messages: Array<{ role: string; content: string }>): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === "user") return messages[index].content;
  }
  return "";
}

function buildProviderContextMessages(
  memories: MemoryEntry[],
  skillPromptBlock: string | undefined,
): Array<{ role: string; content: string }> {
  const blocks = [
    memories.length > 0
      ? `## Memory Provider Recall\n${memories.map((memory) => `- ${memory.text}`).join("\n")}`
      : "",
    skillPromptBlock?.trim() ?? "",
  ].filter(Boolean);

  return blocks.length > 0 ? [{ role: "system", content: blocks.join("\n\n") }] : [];
}

function executeToolCall(
  toolCall: { name: string; arguments: Record<string, unknown> },
  options: AgentLoopOptions,
): string {
  if (toolCall.name === "recall_memory") {
    const query = typeof toolCall.arguments.query === "string" ? toolCall.arguments.query : "";
    const memories = options.memoryProvider?.recall(query, { sessionId: options.sessionId }) ?? [];
    return JSON.stringify({ memories });
  }
  if (toolCall.name === "update_master_model") {
    return JSON.stringify(options.updateMasterModel?.(toolCall.arguments) ?? {
      error: "update_master_model is not configured",
    });
  }
  return `Tool ${toolCall.name} not available`;
}
