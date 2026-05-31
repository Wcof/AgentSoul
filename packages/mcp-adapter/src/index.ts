import type { ClientAuthorizationMode } from "@agentsoul/domain";
import type {
  CompanionInteractionKind,
  CompanionRuntimeService,
  CompanionRuntimeState,
} from "@agentsoul/companion";
import type { SafetyActionKind, ScopedTrustGrant } from "@agentsoul/safety";
import type { MemoryStore } from "@agentsoul/memory";

export interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface V2McpToolCall {
  name: string;
  arguments?: Record<string, unknown>;
}

export interface V2McpJsonContent {
  type: "json";
  json: unknown;
}

export interface V2McpTextContent {
  type: "text";
  text: string;
}

export interface V2McpToolResult {
  content: Array<V2McpJsonContent | V2McpTextContent>;
}

export interface V2McpAdapterOptions {
  runtime: Pick<
    CompanionRuntimeService,
    "getCompanionRuntimeState" | "performCompanionInteraction"
  > &
    Partial<Pick<CompanionRuntimeService, "updateSoulAffectiveState">>;
  decideSafetyPolicy?: (options: any) => any;
  memoryStore?: MemoryStore;
}

export interface V2McpAdapter {
  listTools(): McpToolDefinition[];
  callTool(call: V2McpToolCall): V2McpToolResult;
}

const COMPANION_STATUS_TOOL: McpToolDefinition = {
  name: "agentsoul_get_companion_status",
  description:
    "Read the active Companion, Soul, and Provider Profile from AgentSoul v2 Runtime State.",
  inputSchema: {
    type: "object",
    properties: {},
  },
};

const COMPANION_INTERACTION_TOOL: McpToolDefinition = {
  name: "agentsoul_interact_companion",
  description:
    "Perform a supported Companion interaction through AgentSoul v2 Runtime State.",
  inputSchema: {
    type: "object",
    properties: {
      interaction: {
        type: "string",
        enum: ["feed", "play", "pet", "sleep"],
      },
    },
    required: ["interaction"],
  },
};

const CONTROLLED_ACTION_TOOL: McpToolDefinition = {
  name: "agentsoul_request_controlled_action",
  description:
    "Evaluate a managed MCP action through AgentSoul v2 Safety Policy as the mcp-server Controlled Entry Point.",
  inputSchema: {
    type: "object",
    properties: {
      actionKind: {
        type: "string",
      },
      target: {
        type: "string",
      },
      projectPath: {
        type: "string",
      },
      clientId: {
        type: "string",
      },
      providerProfileId: {
        type: "string",
      },
      clientAuthorizationMode: {
        type: "string",
        enum: ["normal", "elevated", "fully-authorized"],
      },
      approvalSurfaceAvailable: {
        type: "boolean",
      },
      scopedTrustGrants: {
        type: "array",
      },
      now: {
        type: "string",
      },
    },
    required: ["actionKind", "clientAuthorizationMode", "approvalSurfaceAvailable", "now"],
  },
};

const STARTUP_TOOLS: McpToolDefinition[] = [
  {
    name: "mcp_tool_index",
    description: "List v2 MCP startup, memory, companion, and safety tools.",
    inputSchema: {
      type: "object",
      properties: {
        category: { type: "string" },
        tool: { type: "string" },
      },
    },
  },
  {
    name: "get_persona_config",
    description: "Read the active Companion persona and Soul baseline from v2 Runtime State.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_soul_state",
    description: "Read the active Soul affective state from v2 Runtime State.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_soul_state",
    description: "Update the active Soul PAD affective state through v2 Runtime State.",
    inputSchema: {
      type: "object",
      properties: {
        pleasure: { type: "number" },
        arousal: { type: "number" },
        dominance: { type: "number" },
        affectiveEnergy: { type: "number" },
        trigger: { type: "string" },
      },
    },
  },
  {
    name: "get_base_rules",
    description: "Read v2-compatible AgentSoul startup and memory rules.",
    inputSchema: {
      type: "object",
      properties: {
        name: {
          type: "string",
          enum: ["SKILL", "memory_base", "soul_base", "master_base", "secure_base"],
        },
      },
      required: ["name"],
    },
  },
  {
    name: "get_mcp_usage_guide",
    description: "Read the v2 MCP startup usage guide.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "write_memory_day",
    description: "Persist daily memory through v2 local storage.",
    inputSchema: {
      type: "object",
      properties: {
        date: { type: "string" },
        content: { type: "string" },
        append: { type: "boolean" },
      },
      required: ["date", "content"],
    },
  },
  {
    name: "write_memory_topic",
    description: "Persist topic memory through v2 local storage.",
    inputSchema: {
      type: "object",
      properties: {
        topic: { type: "string" },
        content: { type: "string" },
        append: { type: "boolean" },
      },
      required: ["topic", "content"],
    },
  },
  {
    name: "list_memory_topics",
    description: "List v2 topic memories by status.",
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", enum: ["active", "archived", "all"] },
      },
    },
  },
];

export function createV2McpAdapter(options: V2McpAdapterOptions): V2McpAdapter {
  const decideSafetyPolicyFn = options.decideSafetyPolicy || ((input: any) => {
    throw new Error("decideSafetyPolicy callback is required to evaluate safety policy");
  });

  const memoryStore = options.memoryStore;

  return {
    listTools() {
      return [
        COMPANION_STATUS_TOOL,
        COMPANION_INTERACTION_TOOL,
        CONTROLLED_ACTION_TOOL,
        ...STARTUP_TOOLS,
      ];
    },
    callTool(call) {
      switch (call.name) {
        case "agentsoul_get_companion_status":
          return jsonResult(toCompanionStatus(options.runtime.getCompanionRuntimeState()));
        case "agentsoul_interact_companion":
          return jsonResult(
            options.runtime.performCompanionInteraction(parseInteraction(call.arguments)),
          );
        case "agentsoul_request_controlled_action":
          return jsonResult(decideSafetyPolicyFn(parseControlledAction(call.arguments)));
        case "mcp_tool_index":
          return jsonResult(buildMcpToolIndex(this.listTools(), call.arguments));
        case "get_persona_config":
          return jsonResult(toPersonaConfig(options.runtime.getCompanionRuntimeState()));
        case "get_soul_state":
          return jsonResult(toSoulState(options.runtime.getCompanionRuntimeState()));
        case "update_soul_state":
          return jsonResult(updateSoulState(options.runtime, call.arguments));
        case "get_base_rules":
          return textResult(readBaseRules(call.arguments));
        case "get_mcp_usage_guide":
          return textResult(MCP_USAGE_GUIDE);
        case "write_memory_day": {
          const date = parseRequiredString(call.arguments?.date, "date");
          const content = parseRequiredString(call.arguments?.content, "content");
          const store = requireMemoryStore(memoryStore);
          const entry = store.write({ layer: "day", content, priority: "medium", tags: [date] });
          return jsonResult({ success: true, id: entry.id, date, layer: entry.layer });
        }
        case "write_memory_topic": {
          const topic = parseRequiredString(call.arguments?.topic, "topic");
          const content = parseRequiredString(call.arguments?.content, "content");
          const store = requireMemoryStore(memoryStore);
          const entry = store.write({ layer: "topic", content, priority: "medium", tags: [topic] });
          return jsonResult({ success: true, id: entry.id, topic, layer: entry.layer });
        }
        case "list_memory_topics": {
          const store = requireMemoryStore(memoryStore);
          const entries = store.query({ layer: "topic" });
          const topics = entries.map((entry) => ({
            topic: entry.tags[0] ?? entry.id,
            status: "active",
            updatedAt: entry.updatedAt,
          }));
          return jsonResult({ count: topics.length, topics });
        }
        default:
          throw new Error(`Unknown AgentSoul v2 MCP tool: ${call.name}`);
      }
    },
  };
}

const BASE_RULES: Record<string, string> = {
  SKILL:
    "AgentSoul v2 startup rule: load the active Companion, Soul, safety boundaries, and memory topics before responding. Use controlled entry points for high-risk actions.",
  memory_base:
    "AgentSoul v2 memory rule: write daily summaries with write_memory_day, write topic decisions with write_memory_topic, and list active topics at startup.",
  soul_base:
    "AgentSoul v2 Soul rule: Soul is the Companion core. Keep internal affective state separate from external Mood and Pet Appearance.",
  master_base:
    "AgentSoul v2 user rule: preserve local-first behavior and avoid cloud dependency unless the user explicitly chooses export or sync.",
  secure_base:
    "secure_base is protected. High-risk and critical actions must go through Safety Policy and explicit approval when controlled.",
};

const MCP_USAGE_GUIDE = [
  "AgentSoul v2 MCP startup sequence:",
  "1. mcp_tool_index",
  "2. get_persona_config",
  "3. get_soul_state",
  "4. get_base_rules with name=SKILL",
  "5. get_base_rules with name=memory_base",
  "6. get_mcp_usage_guide",
  "7. list_memory_topics",
  "Persist changes with write_memory_day, write_memory_topic, and update_soul_state.",
].join("\n");

function toPersonaConfig(state: CompanionRuntimeState) {
  return {
    companion: {
      id: state.companion.id,
      displayName: state.companion.displayName,
      petAppearance: state.companion.petAppearance,
    },
    soul: {
      id: state.soul.id,
      personaName: state.soul.personaName,
      affectiveState: state.soul.affectiveState,
    },
    providerProfile: {
      id: state.providerProfile.id,
      name: state.providerProfile.name,
      activationMode: state.providerProfile.activationMode,
    },
  };
}

function toSoulState(state: CompanionRuntimeState) {
  return {
    soulId: state.soul.id,
    personaName: state.soul.personaName,
    affectiveState: state.soul.affectiveState,
  };
}

function updateSoulState(
  runtime: Pick<CompanionRuntimeService, "getCompanionRuntimeState"> &
    Partial<Pick<CompanionRuntimeService, "updateSoulAffectiveState">>,
  args: Record<string, unknown> | undefined,
) {
  if (!runtime.updateSoulAffectiveState) {
    throw new Error("update_soul_state requires a runtime with updateSoulAffectiveState");
  }

  const current = runtime.getCompanionRuntimeState().soul.affectiveState;
  const nextState = runtime.updateSoulAffectiveState({
    pleasure: parseNumberWithDefault(args?.pleasure, current.pleasure),
    arousal: parseNumberWithDefault(args?.arousal, current.arousal),
    dominance: parseNumberWithDefault(args?.dominance, current.dominance),
    affectiveEnergy: parseNumberWithDefault(args?.affectiveEnergy, current.affectiveEnergy),
  });

  return {
    success: true,
    trigger: parseOptionalString(args?.trigger),
    newState: nextState.soul,
  };
}

function readBaseRules(args: Record<string, unknown> | undefined): string {
  const name = parseRequiredString(args?.name, "name");
  const content = BASE_RULES[name];

  if (!content) {
    throw new Error(`Unsupported base rules document: ${name}`);
  }

  return content;
}

function buildMcpToolIndex(
  tools: McpToolDefinition[],
  args: Record<string, unknown> | undefined,
) {
  const category = parseOptionalString(args?.category);
  const tool = parseOptionalString(args?.tool);
  const entries = tools.map((definition) => ({
    name: definition.name,
    description: definition.description,
    category: categorizeTool(definition.name),
    parameters: definition.inputSchema.properties,
    required: definition.inputSchema.required ?? [],
  }));

  if (tool) {
    return entries.find((entry) => entry.name === tool) ?? null;
  }

  return category && category !== "all"
    ? entries.filter((entry) => entry.category === category)
    : entries;
}

function categorizeTool(name: string): string {
  if (name.includes("memory")) {
    return "memory";
  }
  if (name.includes("soul") || name.includes("persona") || name === "get_base_rules" || name === "get_mcp_usage_guide" || name === "mcp_tool_index") {
    return "soul";
  }
  if (name.includes("controlled_action")) {
    return "safety";
  }
  return "companion";
}

function requireMemoryStore(store: MemoryStore | undefined): MemoryStore {
  if (!store) {
    throw new Error("v2 MCP memory tools require a MemoryStore instance");
  }

  return store;
}

function parseNumberWithDefault(value: unknown, fallback: number): number {
  return typeof value === "number" ? value : fallback;
}

function toCompanionStatus(state: CompanionRuntimeState): CompanionRuntimeState {
  return state;
}

function parseInteraction(args: Record<string, unknown> | undefined): CompanionInteractionKind {
  const interaction = args?.interaction;
  if (
    interaction === "feed" ||
    interaction === "play" ||
    interaction === "pet" ||
    interaction === "sleep"
  ) {
    return interaction;
  }

  throw new Error("agentsoul_interact_companion requires interaction: feed | play | pet | sleep");
}

function parseControlledAction(args: Record<string, unknown> | undefined) {
  if (!args) {
    throw new Error("agentsoul_request_controlled_action requires arguments");
  }

  return {
    action: {
      kind: parseActionKind(args.actionKind),
      target: parseOptionalString(args.target),
    },
    controlledEntryPoint: "mcp-server" as const,
    clientAuthorizationMode: parseClientAuthorizationMode(args.clientAuthorizationMode),
    approvalSurfaceAvailable: parseBoolean(args.approvalSurfaceAvailable),
    scope: {
      projectPath: parseOptionalString(args.projectPath),
      clientId: parseOptionalString(args.clientId),
      providerProfileId: parseOptionalString(args.providerProfileId),
    },
    scopedTrustGrants: parseScopedTrustGrants(args.scopedTrustGrants),
    now: parseRequiredString(args.now, "now"),
  };
}

function parseActionKind(value: unknown): SafetyActionKind {
  const allowed: SafetyActionKind[] = [
    "chat",
    "read-status",
    "read-sensitive-path",
    "export-config",
    "write-file",
    "delete-file",
    "execute-command",
    "modify-client-config",
    "deploy-workspace-rules",
    "launch-session",
    "change-provider-profile",
    "use-credential",
    "bulk-delete",
    "overwrite-user-file",
    "export-secret",
  ];

  if (typeof value === "string" && allowed.includes(value as SafetyActionKind)) {
    return value as SafetyActionKind;
  }

  throw new Error("Unsupported controlled action kind");
}

function parseClientAuthorizationMode(value: unknown): ClientAuthorizationMode {
  if (value === "normal" || value === "elevated" || value === "fully-authorized") {
    return value;
  }

  throw new Error("Unsupported Client Authorization Mode");
}

function parseScopedTrustGrants(value: unknown): ScopedTrustGrant[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("scopedTrustGrants must be an array");
  }

  return value as ScopedTrustGrant[];
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  throw new Error("approvalSurfaceAvailable must be boolean");
}

function parseRequiredString(value: unknown, field: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new Error(`${field} is required`);
}

function parseOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function jsonResult(json: unknown): V2McpToolResult {
  return {
    content: [
      {
        type: "json",
        json,
      },
    ],
  };
}

function textResult(text: string): V2McpToolResult {
  return {
    content: [
      {
        type: "text",
        text,
      },
    ],
  };
}
