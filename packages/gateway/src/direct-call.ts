import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { buildSystemPrompt, getDefaultSoul } from "@agentsoul/companion";
import type { MasterModel, MemoryEntry, PromptPADState, VitalsSnapshot } from "@agentsoul/companion";
import type { StoredProviderProfile } from "@agentsoul/provider";
import { translateGatewayRoute, type GatewayClientRequest } from "./providers";
import type { GatewayAuditRepository } from "./audit/repository";
import type { DirectCaller } from "./agent-loop";

/**
 * Direct-call mode: Gateway receives a request, translates it via provider adapters,
 * actually calls the LLM, and returns the LLM response (not the translated request).
 *
 * This contrasts with proxy mode, which only translates and returns the request object.
 */

export interface DirectCallOptions {
  providerProfiles: { getActiveProviderProfile(): StoredProviderProfile | null | undefined };
  audit?: GatewayAuditRepository;
}

export function createProviderDirectCaller(options: DirectCallOptions): DirectCaller {
  return {
    async call(input) {
      const active = options.providerProfiles.getActiveProviderProfile();
      if (!active) throw new Error("no-active-provider-profile");
      const route = translateGatewayRoute(active, {
        clientProtocol: "openai-chat",
        messages: input.messages,
      });
      if (route.status !== "translated") {
        throw new Error(route.reason);
      }
      const startedAt = Date.now();
      const response = await fetch(route.providerRequest.url, {
        method: route.providerRequest.method,
        headers: route.providerRequest.headers,
        body: JSON.stringify(route.providerRequest.body),
      });
      const body = await response.json() as Record<string, any>;
      if (!response.ok) {
        throw new Error(`provider-call-failed:${response.status}`);
      }
      const usage = normalizeOpenAiUsage(body.usage);
      options.audit?.recordAudit({
        trafficMetadata: {
          gatewayEventId: randomUUID(),
          clientProtocol: "openai-chat",
          providerProtocol: active.providerProtocol,
          providerProfileId: String(active.id),
          model: active.targetModel,
          route: `openai-chat -> ${active.providerProtocol}`,
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          latencyMs: Math.max(0, Date.now() - startedAt),
          outcome: "companion-agent-loop",
        },
        estimatedCost: 0,
        outcome: "companion-agent-loop",
      });
      return {
        content: body.choices?.[0]?.message?.content ?? "",
        toolCalls: normalizeOpenAiToolCalls(body.choices?.[0]?.message?.tool_calls),
        usage,
      };
    },
  };
}

export async function handleDirectCall(
  request: IncomingMessage,
  response: ServerResponse,
  protocol: "openai-chat" | "claude-messages" | "codex-responses",
  options: DirectCallOptions,
): Promise<void> {
  const startedAt = Date.now();
  const body = (await readJsonBody(request)) as Record<string, unknown>;
  const active = options.providerProfiles.getActiveProviderProfile();

  if (!active) {
    sendJson(response, 409, { error: "no-active-provider-profile" });
    return;
  }

  const clientRequest: GatewayClientRequest = {
    clientProtocol: protocol,
    requestedModel: typeof body.model === "string" ? body.model : undefined,
    messages: Array.isArray(body.messages)
      ? (body.messages as Array<{ role: string; content: string }>)
      : [],
    tokenUsage: { inputTokens: 0, outputTokens: 0 },
  };

  // Inject soul-driven system prompt if companionId is provided
  const companionId = typeof body.companionId === "string" ? body.companionId : undefined;
  const companionName = typeof body.companionName === "string" ? body.companionName : undefined;

  if (companionId && companionName) {
    const soulPrompt = buildSoulSystemPrompt(companionId, companionName, body.companionContext);
    clientRequest.messages = [
      { role: "system", content: soulPrompt },
      ...(clientRequest.messages ?? []),
    ];
  }

  const route = translateGatewayRoute(active, clientRequest);
  if (route.status !== "translated") {
    sendJson(response, 422, { error: "unsupported-route", reason: route.reason });
    return;
  }

  const { providerRequest } = route;

  try {
    const llmResponse = await fetch(providerRequest.url, {
      method: providerRequest.method,
      headers: providerRequest.headers,
      body: JSON.stringify(providerRequest.body),
    });

    const llmBody = await llmResponse.json();

    // Record audit
    options.audit?.recordAudit({
      trafficMetadata: {
        gatewayEventId: randomUUID(),
        clientProtocol: protocol,
        providerProtocol: active.providerProtocol,
        providerProfileId: String(active.id),
        model: active.targetModel,
        route: `${protocol} -> ${active.providerProtocol}`,
        inputTokens: clientRequest.tokenUsage?.inputTokens ?? 0,
        outputTokens: clientRequest.tokenUsage?.outputTokens ?? 0,
        latencyMs: Math.max(0, Date.now() - startedAt),
        outcome: "direct-call",
      },
      estimatedCost: 0,
      outcome: "direct-call",
    });

    sendJson(response, llmResponse.status, llmBody);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";

    // Record failed audit
    options.audit?.recordAudit({
      trafficMetadata: {
        gatewayEventId: randomUUID(),
        clientProtocol: protocol,
        providerProtocol: active.providerProtocol,
        providerProfileId: String(active.id),
        model: active.targetModel,
        route: `${protocol} -> ${active.providerProtocol}`,
        inputTokens: 0,
        outputTokens: 0,
        latencyMs: Math.max(0, Date.now() - startedAt),
        outcome: "provider-call-failed",
      },
      estimatedCost: 0,
      outcome: "provider-call-failed",
    });

    sendJson(response, 502, { error: "provider-call-failed", message });
  }
}

// ─── Internal helpers ───

function sendJson(response: ServerResponse, statusCode: number, body: unknown): void {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

function readJsonBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("error", reject);
    request.on("end", () => {
      const body = Buffer.concat(chunks).toString("utf8");
      if (!body) { resolve({}); return; }
      try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
    });
  });
}

function buildSoulSystemPrompt(companionId: string, companionName: string, rawContext: unknown): string {
  const context = normalizeCompanionPromptContext(rawContext);
  const soul = getDefaultSoul(
    {
      id: companionId,
      displayName: companionName,
      soulId: `${companionId}-soul`,
      petAppearance: { kind: "custom", skin: "default" },
      vitals: {
        level: context.level,
        xp: 0,
        companionEnergy: context.vitals.energy as never,
        hunger: context.vitals.hunger,
        intimacy: context.vitals.intimacy as never,
      },
      mood: "neutral" as never,
    },
    companionName,
  );

  soul.masterModel = mergeMasterModel(soul.masterModel, context.masterModel);

  const layers = buildSystemPrompt(
    soul,
    context.pad,
    context.vitals,
    context.memories,
    context.sessionContext,
    context.level,
  );

  return [
    "# Stable Soul",
    layers.stable,
    "# Runtime Context",
    layers.context,
    "# Volatile Memory",
    layers.volatile || "无额外易失记忆。",
  ].join("\n");
}

function normalizeCompanionPromptContext(raw: unknown): {
  pad: PromptPADState;
  vitals: VitalsSnapshot;
  memories: MemoryEntry[];
  sessionContext: string;
  level: number;
  masterModel: Partial<MasterModel>;
} {
  const obj = isRecord(raw) ? raw : {};
  return {
    pad: normalizePad(obj.pad),
    vitals: normalizeVitals(obj.vitals),
    memories: normalizeMemories(obj.memories),
    sessionContext: typeof obj.sessionContext === "string" ? obj.sessionContext : "",
    level: positiveNumber(obj.level, 1),
    masterModel: isRecord(obj.masterModel) ? obj.masterModel as Partial<MasterModel> : {},
  };
}

function normalizePad(raw: unknown): PromptPADState {
  const obj = isRecord(raw) ? raw : {};
  return {
    pleasure: boundedNumber(obj.pleasure, 0, -1, 1),
    arousal: boundedNumber(obj.arousal, 0, -1, 1),
    dominance: boundedNumber(obj.dominance, 0, -1, 1),
  };
}

function normalizeVitals(raw: unknown): VitalsSnapshot {
  const obj = isRecord(raw) ? raw : {};
  return {
    energy: boundedNumber(obj.energy, 100, 0, 100),
    hunger: boundedNumber(obj.hunger, 100, 0, 100),
    intimacy: boundedNumber(obj.intimacy, 0, 0, 100),
  };
}

function normalizeMemories(raw: unknown): MemoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      if (typeof item === "string") return { text: item };
      if (isRecord(item) && typeof item.text === "string") return { text: item.text };
      return null;
    })
    .filter((item): item is MemoryEntry => Boolean(item));
}

function mergeMasterModel(base: MasterModel, update: Partial<MasterModel>): MasterModel {
  return {
    ...base,
    basic: { ...base.basic, ...(isRecord(update.basic) ? update.basic : {}) },
    preferences: { ...base.preferences, ...(isRecord(update.preferences) ? update.preferences : {}) },
    behaviorPatterns: { ...base.behaviorPatterns, ...(isRecord(update.behaviorPatterns) ? update.behaviorPatterns : {}) },
    emotionalProfile: { ...base.emotionalProfile, ...(isRecord(update.emotionalProfile) ? update.emotionalProfile : {}) },
    relationshipMemory: { ...base.relationshipMemory, ...(isRecord(update.relationshipMemory) ? update.relationshipMemory : {}) },
    trustLevel: typeof update.trustLevel === "number" ? update.trustLevel : base.trustLevel,
    learningState: {
      ...base.learningState,
      ...(isRecord(update.learningState) ? update.learningState : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function boundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function positiveNumber(value: unknown, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) return fallback;
  return Math.floor(value);
}

function normalizeOpenAiUsage(raw: unknown): { inputTokens: number; outputTokens: number } {
  const usage = isRecord(raw) ? raw : {};
  return {
    inputTokens: nonNegativeNumber(usage.prompt_tokens ?? usage.input_tokens),
    outputTokens: nonNegativeNumber(usage.completion_tokens ?? usage.output_tokens),
  };
}

function normalizeOpenAiToolCalls(raw: unknown): Array<{ name: string; arguments: Record<string, unknown> }> | undefined {
  if (!Array.isArray(raw)) return undefined;
  return raw
    .map((call) => {
      if (!isRecord(call) || !isRecord(call.function) || typeof call.function.name !== "string") return null;
      return {
        name: call.function.name,
        arguments: parseToolArguments(call.function.arguments),
      };
    })
    .filter((call): call is { name: string; arguments: Record<string, unknown> } => Boolean(call));
}

function parseToolArguments(raw: unknown): Record<string, unknown> {
  if (isRecord(raw)) return raw;
  if (typeof raw !== "string") return {};
  try {
    const parsed = JSON.parse(raw);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function nonNegativeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}
