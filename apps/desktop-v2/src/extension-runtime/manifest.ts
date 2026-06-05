import type { ExtensionCapabilityRegistration } from "./adapter";

export interface ExtensionManifest {
  id: string;
  name: string;
  capabilities: ExtensionCapabilityRegistration[];
}

export function normalizeRegistration(registration: ExtensionManifest | import("./adapter").ExtensionCapabilityAdapter): ExtensionManifest {
  if ("extension" in registration) {
    return {
      id: registration.extension.id,
      name: registration.extension.name,
      capabilities: registration.capabilities,
    };
  }
  return registration;
}
