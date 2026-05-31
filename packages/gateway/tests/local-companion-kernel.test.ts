import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createLocalCompanionKernel } from "@agentsoul/gateway";
import { createMemoryStore } from "@agentsoul/memory";
import { createSkillSourceStore } from "@agentsoul/skills";

describe("local companion kernel", () => {
  it("wires SQLite memories and enabled SKILL.md files into the agent loop", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agentsoul-kernel-"));
    const dbPath = join(dir, "agentsoul.sqlite");
    const skillDir = join(dir, "skills", "concise-answer");
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), "# concise-answer\n先给结论，再给必要步骤。\n", "utf8");
    const memoryStore = createMemoryStore({ dbPath });
    const skillStore = createSkillSourceStore({ dbPath });
    memoryStore.write({ layer: "topic", content: "主人喜欢桌面伴侣", priority: "high", tags: ["桌面伴侣"] });
    skillStore.installSkillPack({
      id: "concise-answer",
      name: "concise-answer",
      source: { kind: "local-directory", uri: skillDir },
      globalDefaultEnabled: true,
      installedAt: "2026-05-31T00:00:00.000Z",
    });
    const directCaller = {
      call: vi.fn().mockResolvedValue({
        content: "结论：已接入。",
        usage: { inputTokens: 20, outputTokens: 8 },
      }),
    };
    const kernel = createLocalCompanionKernel({ memoryStore, skillStore, directCaller });

    try {
      await kernel.runConversation("桌面伴侣怎么样", [], "session-1");
      const prompt = directCaller.call.mock.calls[0][0].messages.map((message: any) => message.content).join("\n");
      expect(prompt).toContain("主人喜欢桌面伴侣");
      expect(prompt).toContain("concise-answer");
      expect(prompt).toContain("先给结论");
      expect(memoryStore.query({ layer: "day" }).some((entry) => entry.content.includes("结论：已接入。"))).toBe(true);
    } finally {
      skillStore.close();
      memoryStore.close();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
