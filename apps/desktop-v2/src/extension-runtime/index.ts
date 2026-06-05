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

export interface ExtensionRuntimeEvent {
  type: string;
  payload?: unknown;
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

export interface ExtensionManifest {
  id: string;
  name: string;
  capabilities: ExtensionCapabilityRegistration[];
}

export interface ExtensionCapabilityAdapter {
  extension: {
    id: string;
    name: string;
  };
  capabilities: ExtensionCapabilityRegistration[];
}

export interface ExtensionRuntimeOptions {
  onEvent?: (event: ExtensionRuntimeEvent) => void;
}

export interface ExtensionRuntime {
  register(registration: ExtensionManifest | ExtensionCapabilityAdapter): void;
  listCapabilities(): ExtensionCapability[];
  invoke<Input = unknown, Output = unknown>(capabilityId: string, input: Input): Promise<Output>;
  emit(event: ExtensionRuntimeEvent): void;
}

export type ExtensionRuntimeErrorCode =
  | "capability-not-found"
  | "duplicate-capability-id"
  | "handler-failed";

export class ExtensionRuntimeError extends Error {
  code: ExtensionRuntimeErrorCode;
  capabilityId: string;

  constructor(input: {
    code: ExtensionRuntimeErrorCode;
    capabilityId: string;
    message: string;
    cause?: unknown;
  }) {
    super(input.message);
    this.name = "ExtensionRuntimeError";
    this.code = input.code;
    this.capabilityId = input.capabilityId;
    this.cause = input.cause;
  }
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

interface RegisteredCapability {
  extensionId: string;
  declaration: ExtensionCapabilityRegistration;
}

export function createExtensionRuntime(options: ExtensionRuntimeOptions = {}): ExtensionRuntime {
  const capabilities = new Map<string, RegisteredCapability>();

  const emit = (event: ExtensionRuntimeEvent) => {
    options.onEvent?.(event);
  };

  return {
    register(registration) {
      const manifest = normalizeRegistration(registration);
      const nextCapabilities = new Map(capabilities);

      for (const capability of manifest.capabilities) {
        if (nextCapabilities.has(capability.id)) {
          throw new ExtensionRuntimeError({
            code: "duplicate-capability-id",
            capabilityId: capability.id,
            message: `Duplicate extension capability id: ${capability.id}`,
          });
        }

        nextCapabilities.set(capability.id, {
          extensionId: manifest.id,
          declaration: capability,
        });
      }

      capabilities.clear();
      for (const [id, capability] of nextCapabilities) capabilities.set(id, capability);
    },

    listCapabilities() {
      return Array.from(capabilities.values()).map(({ extensionId, declaration }) => ({
        id: declaration.id,
        extensionId,
        title: declaration.title,
        ...(declaration.description ? { description: declaration.description } : {}),
        ...(declaration.surface ? { surface: declaration.surface } : {}),
      }));
    },

    async invoke<Input = unknown, Output = unknown>(capabilityId: string, input: Input): Promise<Output> {
      const capability = capabilities.get(capabilityId);
      if (!capability) {
        throw new ExtensionRuntimeError({
          code: "capability-not-found",
          capabilityId,
          message: `Extension capability not found: ${capabilityId}`,
        });
      }

      try {
        return await capability.declaration.handler({
          capabilityId,
          extensionId: capability.extensionId,
          input,
          emit,
        }) as Output;
      } catch (error) {
        throw new ExtensionRuntimeError({
          code: "handler-failed",
          capabilityId,
          message: `Extension capability failed: ${capabilityId}`,
          cause: error,
        });
      }
    },

    emit,
  };
}

function normalizeRegistration(registration: ExtensionManifest | ExtensionCapabilityAdapter): ExtensionManifest {
  if ("extension" in registration) {
    return {
      id: registration.extension.id,
      name: registration.extension.name,
      capabilities: registration.capabilities,
    };
  }
  return registration;
}
