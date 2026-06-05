export type { ExtensionRuntimeEvent } from "./events";
export type {
  ExtensionCapabilitySurface,
  ExtensionCapabilityDeclaration,
  ExtensionCapability,
  ExtensionCapabilityContext,
  ExtensionCapabilityHandler,
  ExtensionCapabilityRegistration,
  ExtensionCapabilityAdapter,
} from "./adapter";
export { retiredControlAreaCapabilityDeclarations } from "./adapter";
export type { ExtensionManifest } from "./manifest";
export { normalizeRegistration } from "./manifest";
export type {
  ExtensionRuntimeErrorCode,
  ExtensionRuntimeOptions,
  ExtensionRuntime,
} from "./registry";
export { ExtensionRuntimeError, createExtensionRuntime } from "./registry";
