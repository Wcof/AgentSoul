import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  createExtensionRuntime,
  type ExtensionCapabilityAdapter,
} from "../src/extension-runtime";

const appRoot = new URL("..", import.meta.url).pathname;

describe("extension runtime capability registry", () => {
  it("registers, lists, invokes, and emits capability events", async () => {
    const events: unknown[] = [];
    const runtime = createExtensionRuntime({
      onEvent: (event) => events.push(event),
    });

    runtime.register({
      id: "gateway",
      name: "Gateway",
      capabilities: [
        {
          id: "gateway.health",
          title: "Gateway Health",
          surface: "drawer",
          handler: async ({ input, emit }) => {
            emit({ type: "gateway.health.checked", payload: input });
            return { ok: true, input };
          },
        },
      ],
    });

    expect(runtime.listCapabilities()).toEqual([
      {
        id: "gateway.health",
        extensionId: "gateway",
        title: "Gateway Health",
        surface: "drawer",
      },
    ]);

    await expect(runtime.invoke("gateway.health", { requestId: "r1" })).resolves.toEqual({
      ok: true,
      input: { requestId: "r1" },
    });
    expect(events).toEqual([{ type: "gateway.health.checked", payload: { requestId: "r1" } }]);
  });

  it("rejects duplicate capability ids before replacing an existing handler", async () => {
    const runtime = createExtensionRuntime();

    runtime.register({
      id: "gateway",
      name: "Gateway",
      capabilities: [{ id: "shared.open", title: "Open Gateway", handler: () => "gateway" }],
    });

    expect(() =>
      runtime.register({
        id: "mcp",
        name: "MCP",
        capabilities: [{ id: "shared.open", title: "Open MCP", handler: () => "mcp" }],
      }),
    ).toThrow(/Duplicate extension capability id: shared\.open/);

    await expect(runtime.invoke("shared.open", undefined)).resolves.toBe("gateway");
  });

  it("wraps missing capability and handler failures in stable runtime errors", async () => {
    const runtime = createExtensionRuntime();
    runtime.register({
      id: "safety",
      name: "Safety",
      capabilities: [
        {
          id: "safety.approval.review",
          title: "Review Approval",
          handler: () => {
            throw new Error("approval store offline");
          },
        },
      ],
    });

    await expect(runtime.invoke("missing.capability", undefined)).rejects.toMatchObject({
      name: "ExtensionRuntimeError",
      capabilityId: "missing.capability",
      code: "capability-not-found",
    });
    await expect(runtime.invoke("safety.approval.review", undefined)).rejects.toMatchObject({
      name: "ExtensionRuntimeError",
      capabilityId: "safety.approval.review",
      code: "handler-failed",
      cause: expect.any(Error),
    });
  });

  it("accepts lightweight adapters for future migration from legacy bind helpers", async () => {
    const runtime = createExtensionRuntime();
    const sessionsAdapter: ExtensionCapabilityAdapter = {
      extension: { id: "sessions", name: "Sessions" },
      capabilities: [
        {
          id: "sessions.resume",
          title: "Resume Session",
          handler: ({ input }) => ({ resumed: (input as { id: string }).id }),
        },
      ],
    };

    runtime.register(sessionsAdapter);

    expect(runtime.listCapabilities()).toEqual([
      {
        id: "sessions.resume",
        extensionId: "sessions",
        title: "Resume Session",
      },
    ]);
    await expect(runtime.invoke("sessions.resume", { id: "sess-1" })).resolves.toEqual({ resumed: "sess-1" });
  });
});

describe("extension runtime owns retired product surfaces", () => {
  it("does not expose retired modules as Desktop Body data-control-area pages", () => {
    const desktopBodySources = [
      "main.ts",
      "renderers.ts",
      "controller.ts",
      "desktop-body/index.ts",
      "desktop-body/bootstrap.ts",
      "desktop-companion-surface.ts",
      "desktop-companion-experience.ts",
      "extension-runtime/index.ts",
    ]
      .map((file) => readFileSync(join(appRoot, "src", ...file.split("/")), "utf8"))
      .join("\n");

    for (const legacyArea of ["gateway", "costs", "sessions", "skills", "mcp", "prompts", "safety"]) {
      expect(desktopBodySources).not.toMatch(new RegExp(`data-control-area="${legacyArea}"`));
      expect(desktopBodySources).toMatch(new RegExp(`${legacyArea}\\.`));
    }
  });
});
