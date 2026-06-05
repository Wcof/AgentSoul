import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import {
  createExtensionRuntime,
  retiredControlAreaCapabilityDeclarations,
} from "../../apps/desktop-v2/src/extension-runtime/index.ts";

const root = process.cwd();

export { createExtensionRuntime, retiredControlAreaCapabilityDeclarations };

export function readExtensionRuntimeSource() {
  return readFileSync(join(root, "apps", "desktop-v2", "src", "extension-runtime", "index.ts"), "utf8");
}

export function expectExtensionRuntimeAdapterSurface() {
  const source = readExtensionRuntimeSource();

  expect(source).toMatch(/createExtensionRuntime/);
  expect(source).toMatch(/ExtensionCapabilityAdapter/);
  expect(source).toMatch(/normalizeRegistration/);
  expect(source).toMatch(/"duplicate-capability-id"/);
  expect(source).toMatch(/"capability-not-found"/);
  expect(source).toMatch(/"handler-failed"/);
}

export function createAdapterRuntime(extensionId, capability) {
  const events = [];
  const runtime = createExtensionRuntime({
    onEvent: (event) => events.push(event),
  });

  runtime.register({
    extension: { id: extensionId, name: extensionId },
    capabilities: [capability],
  });

  return { runtime, events };
}

export function expectRetiredCapability(id, surface = "drawer") {
  expect(retiredControlAreaCapabilityDeclarations).toContainEqual(
    expect.objectContaining({ id, surface }),
  );
}
