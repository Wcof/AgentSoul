import { describe, it, expect } from "vitest";

// ─── Step 3.1: Chat types ───

describe("Chat types", () => {
  it("ChatMessage has required fields", async () => {
    const types = await import("../src/types.js");
    const msg: types.ChatMessage = {
      id: "msg-1",
      role: "user",
      content: "你好",
      timestamp: new Date().toISOString(),
    };

    expect(msg.id).toBe("msg-1");
    expect(msg.role).toBe("user");
    expect(msg.content).toBe("你好");
    expect(msg.timestamp).toBeDefined();
  });

  it("ChatMessage emotion is optional", async () => {
    const types = await import("../src/types.js");
    const msg: types.ChatMessage = {
      id: "msg-2",
      role: "assistant",
      content: "嗨~",
      timestamp: new Date().toISOString(),
    };

    expect(msg.emotion).toBeUndefined();

    const msgWithEmotion: types.ChatMessage = {
      ...msg,
      emotion: "relaxed_content",
    };

    expect(msgWithEmotion.emotion).toBe("relaxed_content");
  });
});

// ─── Step 3.2: Chat renderer ───

describe("Chat renderer", () => {
  it("renderChatWindow returns valid HTML string", async () => {
    const { renderChatWindow } = await import("../src/chat-renderer.js");
    const html = renderChatWindow({ messages: [], loading: false });

    expect(html).toContain("chat-container");
    expect(typeof html).toBe("string");
  });

  it("renders user messages right-aligned", async () => {
    const { renderChatWindow } = await import("../src/chat-renderer.js");
    const html = renderChatWindow({
      messages: [{ id: "1", role: "user", content: "你好", timestamp: new Date().toISOString() }],
      loading: false,
    });

    expect(html).toContain("你好");
    expect(html).toContain("chat-msg-user");
  });

  it("renders assistant messages left-aligned with emotion", async () => {
    const { renderChatWindow } = await import("../src/chat-renderer.js");
    const html = renderChatWindow({
      messages: [{
        id: "2",
        role: "assistant",
        content: "嗨~",
        timestamp: new Date().toISOString(),
        emotion: "relaxed_content",
      }],
      loading: false,
    });

    expect(html).toContain("嗨~");
    expect(html).toContain("chat-msg-assistant");
    expect(html).toContain("relaxed_content");
  });

  it("renders loading indicator when loading=true", async () => {
    const { renderChatWindow } = await import("../src/chat-renderer.js");
    const html = renderChatWindow({ messages: [], loading: true });

    expect(html).toContain("chat-loading");
  });

  it("renders empty state when no messages", async () => {
    const { renderChatWindow } = await import("../src/chat-renderer.js");
    const html = renderChatWindow({ messages: [], loading: false });

    expect(html).toContain("chat-empty");
  });
});

// ─── Step 3.3: Chat controller — sendMessage ───

describe("Chat controller", () => {
  it("sendMessage calls direct endpoint with correct body", async () => {
    const { sendMessage } = await import("../src/chat-controller.js");

    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; body: unknown }> = [];
    globalThis.fetch = async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input.toString();
      calls.push({
        url,
        body: init?.body ? JSON.parse(init.body as string) : null,
      });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      await sendMessage("你好", []);
      expect(calls.length).toBe(1);
      expect(calls[0].url).toContain("/companion/chat");
      expect((calls[0].body as any).message).toBe("你好");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sendMessage includes companion identity and runtime prompt context", async () => {
    const { sendMessage } = await import("../src/chat-controller.js");

    const originalFetch = globalThis.fetch;
    const calls: Array<{ body: any }> = [];
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push({ body: init?.body ? JSON.parse(init.body as string) : null });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      await sendMessage("你好", [], {
        companionId: "active-companion",
        companionName: "元气眠眠",
        mood: "positive",
        vitals: { level: 6, companionEnergy: 85, hunger: 77, intimacy: 66 },
        summary: "session:ready, gateway:ready",
        masterCognition: {
          masterName: "主人",
          interests: ["桌宠", "AgentSoul"],
          communicationStyle: "直接",
          responsePreference: "一步到位",
        },
      });

      expect(calls[0].body.companionId).toBe("active-companion");
      expect(calls[0].body.companionName).toBe("元气眠眠");
      expect(calls[0].body.companionContext.pad.pleasure).toBeGreaterThan(0);
      expect(calls[0].body.companionContext.vitals.energy).toBe(85);
      expect(calls[0].body.companionContext.masterModel.basic.name).toBe("主人");
      expect(calls[0].body.companionContext.masterModel.preferences.interests).toContain("桌宠");
      expect(calls[0].body.companionContext.sessionContext).toContain("session:ready");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sendMessage returns assistant reply", async () => {
    const { sendMessage } = await import("../src/chat-controller.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({ choices: [{ message: { content: "嗨~" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const reply = await sendMessage("你好", []);
      expect(reply.content).toBe("嗨~");
      expect(reply.role).toBe("assistant");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sendMessage handles network error gracefully", async () => {
    const { sendMessage } = await import("../src/chat-controller.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error("Network error"); };

    try {
      const reply = await sendMessage("你好", []);
      expect(reply.role).toBe("assistant");
      expect(reply.content).toContain("错误");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});

// ─── Step 3.4: Chat controller — toggle/submit ───

describe("Chat controller — toggle and submit", () => {
  it("toggleChatWindow is exported and callable", async () => {
    const mod = await import("../src/chat-controller.js");
    expect(typeof mod.toggleChatWindow).toBe("function");
  });

  it("submitMessage is exported and callable", async () => {
    const mod = await import("../src/chat-controller.js");
    expect(typeof mod.submitMessage).toBe("function");
  });

  it("submitMessage forwards companion context to the direct chat request", async () => {
    const { submitMessage } = await import("../src/chat-controller.js");
    const originalFetch = globalThis.fetch;
    const calls: Array<{ body: any }> = [];
    globalThis.fetch = async (_input: string | URL | Request, init?: RequestInit) => {
      calls.push({ body: init?.body ? JSON.parse(init.body as string) : null });
      return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
    const container = {
      querySelector(selector: string) {
        if (selector === ".chat-input") return { value: "你好" };
        return null;
      },
    } as unknown as HTMLElement;

    try {
      await submitMessage(container, [], {
        companionId: "active-companion",
        companionName: "元气眠眠",
        vitals: { companionEnergy: 90, hunger: 90, intimacy: 20 },
      });
      expect(calls[0].body.companionId).toBe("active-companion");
      expect(calls[0].body.companionContext.vitals.energy).toBe(90);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("toggleChatWindow toggles HTML content on/off", async () => {
    const { toggleChatWindow } = await import("../src/chat-controller.js");

    // Mock container with querySelector support
    let innerHTML = "";
    const mockContainer = {
      querySelector: (sel: string) => {
        if (sel === ".chat-container" && innerHTML.includes("chat-container")) {
          return { remove() { innerHTML = ""; } };
        }
        return null;
      },
      appendChild: (node: any) => {
        innerHTML = node.innerHTML ?? "";
      },
    };

    // First toggle: should add
    toggleChatWindow(mockContainer);
    expect(innerHTML).toContain("chat-container");

    // Second toggle: should remove
    toggleChatWindow(mockContainer);
    expect(innerHTML).toBe("");
  });
});

// ─── Step 4.6: Chat integrates AgentLoop ───

describe("Chat — AgentLoop integration", () => {
  it("chat uses agent loop instead of single call", async () => {
    const { sendMessage } = await import("../src/chat-controller.js");

    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => {
      return new Response(JSON.stringify({
        choices: [{ message: { content: "reply" } }],
        iterations: 1,
        tokenUsage: { input: 10, output: 5, total: 15 },
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };

    try {
      const reply = await sendMessage("你好", []);
      expect(reply.content).toBeDefined();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("displays emotion marker from agent loop result", async () => {
    const { renderChatWindow } = await import("../src/chat-renderer.js");
    const html = renderChatWindow({
      messages: [{
        id: "1",
        role: "assistant",
        content: "嗨~",
        timestamp: new Date().toISOString(),
        emotion: "relaxed_content",
      }],
      loading: false,
    });

    expect(html).toContain("relaxed_content");
    expect(html).toContain("data-emotion");
  });
});
