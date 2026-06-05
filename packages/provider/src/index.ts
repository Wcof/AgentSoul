import Database from "better-sqlite3";
import type {
  ClientProtocol,
  CredentialRef,
  ProviderActivationMode,
  ProviderProfile,
  ProviderProfileId,
  ProviderProtocol,
} from "@agentsoul/domain";
import { initializeV2Database } from "@agentsoul/persistence";

export * from "./credential-store.js";

export interface ProviderPricingAssumptions {
  inputTokenUsd: number;
  outputTokenUsd: number;
}

export interface ProviderProfileInput {
  id: ProviderProfileId | string;
  name: string;
  activationMode: ProviderActivationMode;
  credentialRef: CredentialRef | string;
  clientProtocol: ClientProtocol;
  providerProtocol: ProviderProtocol;
  targetModel: string;
  endpoint: string;
  adapterSettings?: Record<string, unknown>;
  pricing?: ProviderPricingAssumptions;
}

export interface StoredProviderProfile extends ProviderProfile {
  adapterSettings: Record<string, unknown>;
  pricing?: ProviderPricingAssumptions;
  updatedAt: string;
}

export interface DirectClientConfigFallback {
  activationMode: "direct-client-config";
  providerProfileId: string;
  providerProfileName: string;
  client: string;
  targetConfigPath: string;
  targetModel: string;
  endpoint: string;
  guarantees: {
    providerSwitching: true;
    fullAudit: false;
    growthConversion: false;
    approvalControl: false;
  };
  notice: string;
}

export interface ProviderActivationSupportEntry {
  client: "Claude Code" | "Cursor" | "Codex" | "Trae";
  clientProtocol: ClientProtocol;
  defaultActivationMode: ProviderActivationMode;
  gatewayRouteSupported: boolean;
  gatewayRouteNotes: string;
  directClientConfigFallback: boolean;
  fallbackConfigPath: string;
  fallbackNotice: string;
  fullAuditGuaranteed: boolean;
  growthConversionGuaranteed: boolean;
  approvalControlGuaranteed: boolean;
}

export interface ProviderProfileService {
  createProviderProfile(input: ProviderProfileInput): StoredProviderProfile;
  listProviderProfiles(): StoredProviderProfile[];
  updateProviderProfile(
    id: ProviderProfileId | string,
    update: Partial<Omit<ProviderProfileInput, "id" | "credentialRef">> & {
      credentialRef?: CredentialRef | string;
    },
  ): StoredProviderProfile;
  selectActiveProviderProfile(id: ProviderProfileId | string): StoredProviderProfile;
  getActiveProviderProfile(): StoredProviderProfile | undefined;
  close(): void;
}

export function createProviderProfileService(options: { dbPath: string }): ProviderProfileService {
  initializeV2Database(options.dbPath);

  const db = new Database(options.dbPath);

  return {
    createProviderProfile(input) {
      const profile = normalizeProviderProfile(input);
      db.prepare(
        `INSERT INTO provider_profiles (id, profile_json, active, updated_at)
         VALUES (?, ?, 0, datetime('now'))`,
      ).run(String(profile.id), JSON.stringify(profile));

      return readProviderProfile(db, profile.id);
    },
    listProviderProfiles() {
      return listProviderProfiles(db);
    },
    updateProviderProfile(id, update) {
      const current = readProviderProfile(db, id);
      const next = normalizeProviderProfile({
        ...current,
        ...update,
        id: current.id,
        credentialRef: update.credentialRef ?? current.credentialRef ?? "",
      });

      db.prepare(
        `UPDATE provider_profiles
         SET profile_json = ?, updated_at = datetime('now')
         WHERE id = ?`,
      ).run(JSON.stringify(next), String(id));

      return readProviderProfile(db, id);
    },
    selectActiveProviderProfile(id) {
      const profile = readProviderProfile(db, id);

      const transaction = db.transaction(() => {
        db.prepare("UPDATE provider_profiles SET active = 0").run();
        db.prepare("UPDATE provider_profiles SET active = 1, updated_at = datetime('now') WHERE id = ?").run(
          String(id),
        );
      });
      transaction();

      return profile;
    },
    getActiveProviderProfile() {
      const row = db
        .prepare("SELECT profile_json, updated_at FROM provider_profiles WHERE active = 1 LIMIT 1")
        .get() as { profile_json: string; updated_at: string } | undefined;

      return row ? parseStoredProviderProfile(row) : undefined;
    },
    close() {
      db.close();
    },
  };
}

export function createDirectClientConfigFallback(input: {
  providerProfile: StoredProviderProfile;
  client: string;
  targetConfigPath: string;
}): DirectClientConfigFallback {
  return {
    activationMode: "direct-client-config",
    providerProfileId: String(input.providerProfile.id),
    providerProfileName: input.providerProfile.name,
    client: input.client,
    targetConfigPath: input.targetConfigPath,
    targetModel: input.providerProfile.targetModel,
    endpoint: input.providerProfile.endpoint,
    guarantees: {
      providerSwitching: true,
      fullAudit: false,
      growthConversion: false,
      approvalControl: false,
    },
    notice:
      "Direct Client Config fallback updates the client native configuration and does not guarantee full audit, growth, or approval control.",
  };
}

export function getProviderActivationSupportMatrix(): ProviderActivationSupportEntry[] {
  return [
    {
      client: "Claude Code",
      clientProtocol: "claude-messages",
      defaultActivationMode: "gateway-route",
      gatewayRouteSupported: true,
      gatewayRouteNotes:
        "Gateway Route is the preferred path for Claude Messages traffic because it can audit metadata, convert traffic into growth, and mediate controlled actions.",
      directClientConfigFallback: true,
      fallbackConfigPath: "~/.claude/settings.json",
      fallbackNotice:
        "Direct Client Config fallback can update Claude Code provider settings but has reduced guarantees for full audit, growth conversion, and approval control.",
      fullAuditGuaranteed: true,
      growthConversionGuaranteed: true,
      approvalControlGuaranteed: true,
    },
    {
      client: "Cursor",
      clientProtocol: "openai-chat",
      defaultActivationMode: "gateway-route",
      gatewayRouteSupported: true,
      gatewayRouteNotes:
        "Gateway Route is preferred for OpenAI-compatible Cursor traffic when the client can target the local Gateway endpoint.",
      directClientConfigFallback: true,
      fallbackConfigPath: "~/.cursor/settings.json",
      fallbackNotice:
        "Direct Client Config fallback can write Cursor provider settings but has reduced guarantees for full audit, growth conversion, and approval control.",
      fullAuditGuaranteed: true,
      growthConversionGuaranteed: true,
      approvalControlGuaranteed: true,
    },
    {
      client: "Codex",
      clientProtocol: "codex-responses",
      defaultActivationMode: "gateway-route",
      gatewayRouteSupported: true,
      gatewayRouteNotes:
        "Gateway Route is preferred for Codex Responses traffic when routed to the local Gateway.",
      directClientConfigFallback: true,
      fallbackConfigPath: "~/.codex/config.toml",
      fallbackNotice:
        "Direct Client Config fallback can update Codex provider settings but has reduced guarantees for full audit, growth conversion, and approval control.",
      fullAuditGuaranteed: true,
      growthConversionGuaranteed: true,
      approvalControlGuaranteed: true,
    },
    {
      client: "Trae",
      clientProtocol: "openai-chat",
      defaultActivationMode: "direct-client-config",
      gatewayRouteSupported: false,
      gatewayRouteNotes:
        "Gateway Route support is not claimed until Trae's local endpoint configuration and protocol behavior are verified.",
      directClientConfigFallback: true,
      fallbackConfigPath: "~/.trae/config.json",
      fallbackNotice:
        "Direct Client Config fallback is available with reduced guarantees for full audit, growth conversion, and approval control.",
      fullAuditGuaranteed: false,
      growthConversionGuaranteed: false,
      approvalControlGuaranteed: false,
    },
  ];
}

function normalizeProviderProfile(input: ProviderProfileInput): StoredProviderProfile {
  return {
    id: input.id,
    name: input.name,
    activationMode: input.activationMode,
    credentialRef: input.credentialRef,
    clientProtocol: input.clientProtocol,
    providerProtocol: input.providerProtocol,
    targetModel: input.targetModel,
    endpoint: input.endpoint,
    adapterSettings: input.adapterSettings ?? {},
    pricing: input.pricing,
    updatedAt: new Date(0).toISOString(),
  };
}

function listProviderProfiles(db: Database.Database): StoredProviderProfile[] {
  const rows = db
    .prepare("SELECT profile_json, updated_at FROM provider_profiles ORDER BY id ASC")
    .all() as Array<{ profile_json: string; updated_at: string }>;

  return rows.map(parseStoredProviderProfile);
}

function readProviderProfile(
  db: Database.Database,
  id: ProviderProfileId | string,
): StoredProviderProfile {
  const row = db
    .prepare("SELECT profile_json, updated_at FROM provider_profiles WHERE id = ?")
    .get(String(id)) as { profile_json: string; updated_at: string } | undefined;

  if (!row) {
    throw new Error(`Provider Profile not found: ${id}`);
  }

  return parseStoredProviderProfile(row);
}

function parseStoredProviderProfile(row: {
  profile_json: string;
  updated_at: string;
}): StoredProviderProfile {
  const profile = JSON.parse(row.profile_json) as StoredProviderProfile;

  return {
    ...profile,
    updatedAt: row.updated_at,
  };
}
