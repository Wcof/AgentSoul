import type { CredentialRef, ProviderProfile } from "@agentsoul/domain";

export interface CredentialInput {
  label: string;
  secret: string;
}

export interface StoredCredential {
  ref: CredentialRef | string;
  label: string;
  secret: string;
  createdAt: string;
}

export interface NativeCredentialVault {
  writeCredential(credential: StoredCredential): Promise<void>;
  readCredential(ref: CredentialRef | string): Promise<StoredCredential | undefined>;
}

export interface CredentialStoreBridge {
  createCredential(input: CredentialInput): Promise<CredentialRef | string>;
  retrieveCredential(ref: CredentialRef | string): Promise<never>;
  withCredential<Result>(
    ref: CredentialRef | string,
    access: (credential: Readonly<StoredCredential>) => Result | Promise<Result>,
  ): Promise<Result>;
}

export interface PortableProviderProfileInput {
  id: string;
  name: string;
  credentialRef: CredentialRef | string;
  endpoint: string;
  targetModel: string;
}

export interface RoutineCredentialExport {
  exportKind: "portable-data";
  sensitiveCredentialsIncluded: false;
  providerProfiles: Array<Omit<ProviderProfile, "credentialRef"> & { credentialRef?: never }>;
}

export function createCredentialStoreBridge(options: {
  nativeVault: NativeCredentialVault;
  clock?: () => Date;
}): CredentialStoreBridge {
  const clock = options.clock ?? (() => new Date());

  return {
    async createCredential(input) {
      const ref = createCredentialRef(input.label, clock());
      await options.nativeVault.writeCredential({
        ref,
        label: input.label,
        secret: input.secret,
        createdAt: clock().toISOString(),
      });

      return ref;
    },
    async retrieveCredential() {
      throw new Error(
        "Credential Store bridge denies direct retrieval; use withCredential for controlled provider access.",
      );
    },
    async withCredential(ref, access) {
      const credential = await options.nativeVault.readCredential(ref);

      if (!credential) {
        throw new Error(`Credential not found: ${ref}`);
      }

      return access(Object.freeze({ ...credential }));
    },
  };
}

export function createMemoryNativeCredentialVault(): NativeCredentialVault {
  const records = new Map<string, StoredCredential>();

  return {
    async writeCredential(credential) {
      records.set(String(credential.ref), { ...credential });
    },
    async readCredential(ref) {
      const credential = records.get(String(ref));
      return credential ? { ...credential } : undefined;
    },
  };
}

export function createPortableProviderProfile(
  input: PortableProviderProfileInput,
): ProviderProfile {
  return {
    id: input.id,
    name: input.name,
    activationMode: "gateway-route",
    credentialRef: input.credentialRef,
    clientProtocol: "claude-messages",
    providerProtocol: "anthropic",
    targetModel: input.targetModel,
    endpoint: input.endpoint,
  };
}

export function createRoutineCredentialExport(
  providerProfiles: ProviderProfile[],
): RoutineCredentialExport {
  return {
    exportKind: "portable-data",
    sensitiveCredentialsIncluded: false,
    providerProfiles: providerProfiles.map(({ credentialRef: _credentialRef, ...profile }) => ({ ...profile })),
  };
}

function createCredentialRef(label: string, createdAt: Date): CredentialRef | string {
  const normalizedLabel = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const suffix = createdAt.getTime().toString(36);

  return `credential:${normalizedLabel || "secret"}:${suffix}`;
}
