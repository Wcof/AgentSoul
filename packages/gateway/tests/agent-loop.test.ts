import { describe, it, expect, vi } from "vitest";

// ─── Step 4.1: AgentLoop basic — single turn ───

describe("AgentLoop", () => {
  it("prefetches relevant memory and injects enabled SKILL.md guidance", async () => {
    const { runConversation } = await import("../src/agent-loop.js");
    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "我会按你的偏好来。",
        usage: { inputTokens: 20, outputTokens: 8 },
      }),
    };
    const memoryProvider = {
      prefetch: vi.fn(() => [{ text: "主人偏好一步到位的回答" }]),
      syncTurn: vi.fn(),
      recall: vi.fn(() => []),
    };
    const skillProvider = {
      getPromptBlock: vi.fn(() => "## 已启用技能\n### concise-answer\n先给结论，再给必要步骤。"),
    };

    await runConversation("帮我检查项目", [], {
      directCaller: mockCaller,
      memoryProvider,
      skillProvider,
      sessionId: "session-1",
    });

    expect(memoryProvider.prefetch).toHaveBeenCalledWith("帮我检查项目", { sessionId: "session-1" });
    expect(mockCaller.call.mock.calls[0][0].messages[0].content).toContain("主人偏好一步到位的回答");
    expect(mockCaller.call.mock.calls[0][0].messages[0].content).toContain("concise-answer");
    expect(memoryProvider.syncTurn).toHaveBeenCalledWith("帮我检查项目", "我会按你的偏好来。", {
      sessionId: "session-1",
      messages: expect.any(Array),
    });
  });

  it("compresses long conversation history before calling the provider", async () => {
    const { runConversation } = await import("../src/agent-loop.js");
    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "收到。",
        usage: { inputTokens: 20, outputTokens: 4 },
      }),
    };
    const history = Array.from({ length: 8 }, (_, index) => ({
      role: index % 2 === 0 ? "user" : "assistant",
      content: `历史消息-${index}-${"x".repeat(40)}`,
    }));

    await runConversation("继续", history, {
      directCaller: mockCaller,
      compression: { maxCharacters: 180, preserveRecentMessages: 2 },
    });

    const sentMessages = mockCaller.call.mock.calls[0][0].messages;
    expect(sentMessages.length).toBeLessThan(history.length + 1);
    expect(sentMessages.some((message: any) => message.content.includes("已压缩的早期上下文"))).toBe(true);
    expect(sentMessages.at(-1)).toEqual({ role: "user", content: "继续" });
  });

  it("executes recall_memory through the configured memory provider", async () => {
    const { runConversation } = await import("../src/agent-loop.js");
    const memoryProvider = {
      prefetch: vi.fn(() => []),
      syncTurn: vi.fn(),
      recall: vi.fn(() => [{ text: "主人喜欢猫" }]),
    };
    const mockCaller = {
      call: vi.fn()
        .mockResolvedValueOnce({
          content: "",
          toolCalls: [{ name: "recall_memory", arguments: { query: "猫" } }],
        })
        .mockResolvedValueOnce({ content: "我记得你喜欢猫。" }),
    };

    const result = await runConversation("你还记得吗", [], {
      directCaller: mockCaller,
      memoryProvider,
    });

    expect(memoryProvider.recall).toHaveBeenCalledWith("猫", { sessionId: undefined });
    expect(result.toolCalls[0].result).toContain("主人喜欢猫");
    expect(mockCaller.call.mock.calls[1][0].messages.some((message: any) => message.role === "tool" && message.content.includes("主人喜欢猫"))).toBe(true);
  });

  it("executes update_master_model through the configured updater", async () => {
    const { runConversation } = await import("../src/agent-loop.js");
    const updateMasterModel = vi.fn(() => ({ updated: true }));
    const mockCaller = {
      call: vi.fn()
        .mockResolvedValueOnce({
          content: "",
          toolCalls: [{ name: "update_master_model", arguments: { field: "preferences.interests", value: ["编程"] } }],
        })
        .mockResolvedValueOnce({ content: "记住了。" }),
    };

    const result = await runConversation("我喜欢编程", [], {
      directCaller: mockCaller,
      updateMasterModel,
    });

    expect(updateMasterModel).toHaveBeenCalledWith({ field: "preferences.interests", value: ["编程"] });
    expect(result.toolCalls[0].result).toContain('"updated":true');
  });

  it("injects SoulDocument 3-layer prompt before conversation history", async () => {
    const { runConversation } = await import("../src/agent-loop.js");
    const { getDefaultSoul } = await import("@agentsoul/companion");

    const soul = getDefaultSoul(
      {
        id: "companion-1",
        displayName: "眠眠",
        soulId: "soul-1",
        petAppearance: { kind: "custom", skin: "yuanqi" },
        vitals: { level: 7, xp: 20, companionEnergy: 88 as any, hunger: 80, intimacy: 70 as any },
        mood: "positive" as any,
      },
      "眠眠",
    );
    soul.masterModel.basic.name = "主人";
    soul.masterModel.preferences.interests = ["TypeScript", "桌宠"];
    soul.masterModel.learningState.solidifiedFacts = [{
      id: "fact-1",
      stage: "solidified",
      source: "manual",
      claim: "主人希望伴侣主动但不打扰",
      evidence: ["用户明确表达"],
      confidence: 0.95,
      updatedAt: "2026-05-31T00:00:00Z",
    }];

    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "收到，主人。",
        usage: { inputTokens: 10, outputTokens: 8 },
      }),
    };

    await runConversation("你记得我喜欢什么吗？", [{ role: "assistant", content: "我在。" }], {
      directCaller: mockCaller,
      companionContext: {
        soul,
        pad: { pleasure: 0.4, arousal: 0.35, dominance: -0.2 },
        vitals: { energy: 88, hunger: 80, intimacy: 70 },
        memories: [{ text: "主人喜欢桌面宠物交互" }],
        sessionContext: "当前在验收伴侣内核",
        level: 7,
      },
    });

    const call = mockCaller.call.mock.calls[0][0];
    expect(call.messages[0].role).toBe("system");
    expect(call.messages[0].content).toContain("身份：眠眠");
    expect(call.messages[0].content).toContain("情感状态：pleasure=0.4");
    expect(call.messages[0].content).toContain("主人画像");
    expect(call.messages[0].content).toContain("主人希望伴侣主动但不打扰");
    expect(call.messages[0].content).toContain("相关记忆：主人喜欢桌面宠物交互");
    expect(call.messages[1]).toEqual({ role: "assistant", content: "我在。" });
    expect(call.messages[2]).toEqual({ role: "user", content: "你记得我喜欢什么吗？" });
  });

  it("returns LLM reply for simple message", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "你好！很高兴见到你。",
        usage: { inputTokens: 10, outputTokens: 8 },
      }),
    };

    const result = await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.reply).toContain("你好");
    expect(result.iterations).toBe(1);
    expect(result.toolCalls).toEqual([]);
  });

  it("respects maxIterations limit", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    // LLM always returns tool_calls (never pure text)
    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "",
        usage: { inputTokens: 10, outputTokens: 5 },
        toolCalls: [{ name: "think", arguments: { about: "life" } }],
      }),
    };

    const result = await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 3,
    });

    expect(result.iterations).toBe(3);
    expect(result.reply).toContain("最大思考轮次");
  });

  it("stops on first text response", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    let callCount = 0;
    const mockCaller = {
      call: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            usage: { inputTokens: 10, outputTokens: 5 },
            toolCalls: [{ name: "think", arguments: {} }],
          };
        }
        return {
          content: "我思考完了，这是回答。",
          usage: { inputTokens: 20, outputTokens: 15 },
        };
      }),
    };

    const result = await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.iterations).toBe(2);
    expect(result.reply).toContain("思考完了");
  });

  it("executes update_master_model tool call", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    let callCount = 0;
    const mockCaller = {
      call: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            usage: { inputTokens: 10, outputTokens: 5 },
            toolCalls: [{
              name: "update_master_model",
              arguments: { field: "preferences.interests", value: ["编程"] },
            }],
          };
        }
        return {
          content: "已更新主人模型。",
          usage: { inputTokens: 20, outputTokens: 10 },
        };
      }),
    };

    const result = await runConversation("我喜欢编程", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.iterations).toBe(2);
    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].name).toBe("update_master_model");
  });

  it("executes recall_memory tool call", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    let callCount = 0;
    const mockCaller = {
      call: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            usage: { inputTokens: 10, outputTokens: 5 },
            toolCalls: [{
              name: "recall_memory",
              arguments: { query: "猫" },
            }],
          };
        }
        return {
          content: "我记得你喜欢猫。",
          usage: { inputTokens: 20, outputTokens: 10 },
        };
      }),
    };

    const result = await runConversation("我的猫怎么样了", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.iterations).toBe(2);
    expect(result.toolCalls[0].name).toBe("recall_memory");
  });

  it("returns error for unknown tool", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    let callCount = 0;
    const mockCaller = {
      call: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            usage: { inputTokens: 10, outputTokens: 5 },
            toolCalls: [{
              name: "unknown_tool",
              arguments: {},
            }],
          };
        }
        return {
          content: "好的。",
          usage: { inputTokens: 20, outputTokens: 10 },
        };
      }),
    };

    const result = await runConversation("测试", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.toolCalls.length).toBe(1);
    expect(result.toolCalls[0].result).toContain("not available");
  });

  it("tracks token usage across iterations", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "回复",
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    };

    const result = await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.tokenUsage.input).toBe(100);
    expect(result.tokenUsage.output).toBe(50);
    expect(result.tokenUsage.total).toBe(150);
  });

  it("accumulates token usage across multiple iterations", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    let callCount = 0;
    const mockCaller = {
      call: vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          return {
            content: "",
            usage: { inputTokens: 100, outputTokens: 50 },
            toolCalls: [{ name: "think", arguments: {} }],
          };
        }
        return {
          content: "回答",
          usage: { inputTokens: 200, outputTokens: 80 },
        };
      }),
    };

    const result = await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 5,
    });

    expect(result.tokenUsage.input).toBe(300);
    expect(result.tokenUsage.output).toBe(130);
    expect(result.tokenUsage.total).toBe(430);
  });

  it("persists conversation history after completion", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "你好！",
        usage: { inputTokens: 10, outputTokens: 8 },
      }),
    };

    const mockSessionRepo = {
      save: vi.fn(),
    };

    await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 5,
      sessionRepository: mockSessionRepo,
    });

    expect(mockSessionRepo.save).toHaveBeenCalled();
    const saved = mockSessionRepo.save.mock.calls[0][0];
    expect(saved.messages).toBeDefined();
    expect(saved.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("converts token usage to companion growth", async () => {
    const { runConversation } = await import("../src/agent-loop.js");

    const mockCaller = {
      call: vi.fn().mockResolvedValue({
        content: "你好！",
        usage: { inputTokens: 100, outputTokens: 50 },
      }),
    };

    const mockGrowth = {
      applyGatewayTrafficGrowth: vi.fn(),
    };

    await runConversation("你好", [], {
      directCaller: mockCaller,
      maxIterations: 5,
      companionGrowth: mockGrowth,
    });

    expect(mockGrowth.applyGatewayTrafficGrowth).toHaveBeenCalledWith(
      expect.objectContaining({
        inputTokens: 100,
        outputTokens: 50,
      }),
    );
  });
});
