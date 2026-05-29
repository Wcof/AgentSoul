import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  createCredentialStoreBridge,
  createMemoryNativeCredentialVault,
  createPortableProviderProfile,
  createRoutineCredentialExport,
} from "@agentsoul/security";

describe("Credential Store bridge", () => {
  it("creates, references, and retrieves a Credential only through controlled access", async () => {
    const bridge = createCredentialStoreBridge({
      nativeVault: createMemoryNativeCredentialVault(),
    });

    const ref = await bridge.createCredential({
      label: "Anthropic primary",
      secret: "sk-ant-secret",
    });

    assert.match(ref, /^credential:/);
    await assert.rejects(() => bridge.retrieveCredential(ref));

    const header = await bridge.withCredential(ref, (credential) => {
      return `Bearer ${credential.secret}`;
    });

    assert.equal(header, "Bearer sk-ant-secret");
  });

  it("excludes plaintext secrets from Provider Profiles and routine export", async () => {
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

    assert.equal(providerProfile.credentialRef, credentialRef);
    assert.doesNotMatch(JSON.stringify(providerProfile), /sk-openai-secret/);
    assert.doesNotMatch(JSON.stringify(routineExport), /sk-openai-secret/);
    assert.equal(routineExport.sensitiveCredentialsIncluded, false);
  });
});
