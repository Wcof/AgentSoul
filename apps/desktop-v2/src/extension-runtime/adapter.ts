import type { ExtensionRuntimeEvent } from "./events";

export type ExtensionCapabilitySurface = "bubble" | "drawer" | "panel";

export interface ExtensionCapabilityDeclaration {
  id: string;
  title: string;
  description?: string;
  surface?: ExtensionCapabilitySurface;
}

export interface ExtensionCapability {
  id: string;
  extensionId: string;
  title: string;
  description?: string;
  surface?: ExtensionCapabilitySurface;
}

export interface ExtensionCapabilityContext<Input = unknown> {
  capabilityId: string;
  extensionId: string;
  input: Input;
  emit(event: ExtensionRuntimeEvent): void;
}

export type ExtensionCapabilityHandler<Input = unknown, Output = unknown> = (
  context: ExtensionCapabilityContext<Input>,
) => Output | Promise<Output>;

export interface ExtensionCapabilityRegistration<Input = unknown, Output = unknown>
  extends ExtensionCapabilityDeclaration {
  handler: ExtensionCapabilityHandler<Input, Output>;
}

export interface ExtensionCapabilityAdapter {
  extension: {
    id: string;
    name: string;
  };
  capabilities: ExtensionCapabilityRegistration[];
}

export const retiredControlAreaCapabilityDeclarations: ExtensionCapabilityDeclaration[] = [
  { id: "gateway.status", title: "Gateway Status", surface: "drawer" },
  { id: "costs.summary", title: "Cost Summary", surface: "drawer" },
  { id: "sessions.resume", title: "Resume Session", surface: "drawer" },
  { id: "skills.activate", title: "Activate Skill", surface: "drawer" },
  { id: "mcp.server.manage", title: "Manage MCP Server", surface: "drawer" },
  { id: "prompts.insert", title: "Insert Prompt", surface: "drawer" },
  { id: "safety.approval.review", title: "Review Safety Approval", surface: "drawer" },
];
