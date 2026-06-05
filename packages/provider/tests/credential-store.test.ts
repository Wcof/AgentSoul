import { describe, it, expect } from "vitest";
import {
  createCredentialStoreBridge,
  createMemoryNativeCredentialVault,
  createPortableProviderProfile,
  createRoutineCredentialExport,
} from "@agentsoul/provider";

describe("Credential Store bridge", () => {
  it("creates, references, and retrieves a Credential only through controlled access", async () => {
    const bridge = createCredentialStoreBridge({
      nativeVault: createMemoryNativeCredentialVault(),
    });

    const ref = await bridge.createCredential({
      label: "Anthropic primary",
      secret: "sk-ant-secret",
    });

    expect(ref).toMatch(/^credential:/);
    await expect(() => bridge.retrieveCredential(ref)).rejects.toThrow();

    const header = await bridge.withCredential(ref, (credential) => {
      return `Bearer ${credential.secret}`;
    });

    expect(header).toBe("Bearer sk-ant-secret");
  });

  it("excludes plaintext secrets and credential refs from routine export", async () => {
    const bridge = createCredentialStoreBridge({
      nativeVault: createMemoryNativeCredentialVault(),
    });
    const credentialRef = await bridge.createCredential({
      label: "OpenAI",
      secret: "sk-openai-secret",
    });

    const providerProfile = createPortableProviderProfile({
      id: "provider-openai",
      name: "OpenAI",
      credentialRef,
      endpoint: "https://api.openai.com/v1",
      targetModel: "gpt-4.1",
    });
    const routineExport = createRoutineCredentialExport([providerProfile]);

    expect(providerProfile.credentialRef).toBe(credentialRef);
    expect(JSON.stringify(providerProfile)).not.toMatch(/sk-openai-secret/);
    expect(JSON.stringify(routineExport)).not.toMatch(/sk-openai-secret/);
    expect(JSON.stringify(routineExport)).not.toMatch(/credential:openai/);
    expect("credentialRef" in (routineExport.providerProfiles[0] ?? {})).toBe(false);
    expect(routineExport.sensitiveCredentialsIncluded).toBe(false);
  });
});
